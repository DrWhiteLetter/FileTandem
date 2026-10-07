import { serverIdentity } from '../adapters/ssh/host-keys.js';
import { profileIdentity } from '../application/transfer-resume.js';
import { join } from 'node:path';import { TransferJournal } from '../application/transfer-journal.js';
import { randomUUID,randomBytes } from 'node:crypto';
import * as vscode from 'vscode';import { TransferEngine } from '../application/transfer-engine.js';import { localFileUri } from '../adapters/local/files.js';import { conflictDialog } from './transfer-conflicts.js';
export function registerTransfers(context,profileUI) {
  const changed=new vscode.EventEmitter();const ephemeral=new Map();
  const profiles={get:id => {try {return profileUI.profiles.get(id);} catch(error) {if (ephemeral.has(id)) return ephemeral.get(id);throw error;}}};
  let warned=false;const journal=new TransferJournal(join(context.globalStorageUri.fsPath,'transfers-v1.json'),message => {if (!warned) {warned=true;void vscode.window.showWarningMessage(message);}});
  journal.ready=(async () => {let key=await context.secrets.get('xscp.journal.integrity.v1');if (!key) {key=randomBytes(32).toString('hex');await context.secrets.store('xscp.journal.integrity.v1',key);}if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Journal-Schlüssel ist ungültig.');journal.key=Buffer.from(key,'hex');})().catch(() => {journal.disabled=true;journal.onError('Transferjournal nicht verfügbar: VS-Code-SecretStorage prüfen. Keine gespeicherten Aufträge werden gestartet oder verändert.');});
  const engine=new TransferEngine({sessions:profileUI.sessions,profiles,choose:conflictDialog,guard:profileUI.guard,onChange:jobs => {journal.update(jobs);changed.fire();}});
  engine.ready=journal.load().then(jobs => engine.queue.restore(jobs));
  context.subscriptions.push(engine,changed);
  const prepare=async (ids,resume=false) => {
    await engine.ready;profileUI.guard();const jobs=engine.queue.validateRetry(ids,{resume});
    for (const id of new Set(jobs.map(j => j.profileId))) {
      const profile=profiles.get(id);if (jobs.some(j => j.profileId===id && (j.server!==serverIdentity(profile.host,profile.port).id || (j.profileKey && j.profileKey!==profileIdentity(profile)) || (j.attempt && j.attempt.identity!==profileIdentity(profile))))) throw new Error('Profil wurde geändert; neuen Auftrag anlegen.');
      if (profileUI.sessions.snapshot(id).state!=='connected' || !profileUI.sessions.matches(profile)) await profileUI.connect(profile);
    }profileUI.guard();
  };
  const retry=async ids => {await prepare(ids);return engine.queue.retry(ids,randomUUID);};
  const resume=async ids => {await prepare(ids,true);return engine.resume(ids);};
  profileUI.transfers={engine,changed,resume,retry,cleanup:id => engine.cleanup(id),remember:profile => {if (profile.ephemeral) ephemeral.set(profile.id,profile);}};
  profileUI.command('xscp.uploadFromExplorer',async (uri,uris) => {
    const list=Array.isArray(uris) && uris.length ? uris:[uri];if (!list.length || list.some(value => !value)) throw new Error('Bitte lokale Dateien/Ordner auswählen.');
    const paths=list.map(localFileUri);const profile=await profileUI.choose();if (!profile) return;
    if (profileUI.sessions.snapshot(profile.id).state !== 'connected') await profileUI.connect(profile);
    await engine.submit(profile.id,'upload',paths,profile.remotePath);profileUI.open(profile);
  });
  return {ready:engine.ready,flush:() => journal.flush(),resume,cleanup:id => {profileUI.guard();return engine.cleanup(id);},pause:value => {profileUI.guard();engine.queue.pause(value);},cancel:id => {profileUI.guard();engine.queue.cancel(id);},retry,list:() => {profileUI.guard();return engine.queue.list();},submit:async (id,direction,paths,destination) => {profileUI.guard();return engine.submit(id,direction,paths,destination);}};
}
