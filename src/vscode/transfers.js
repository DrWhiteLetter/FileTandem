import {currentFilePolicy} from './file-options.js';
import { AutoUploadService } from '../application/auto-upload-service.js';
import { serverIdentity } from '../adapters/ssh/host-keys.js';
import { profileIdentity } from '../application/transfer-resume.js';
import { join } from 'node:path';import { TransferJournal } from '../application/transfer-journal.js';
import { randomUUID,randomBytes } from 'node:crypto';
import { vscode } from './localized-vscode.js';import { TransferEngine } from '../application/transfer-engine.js';import { localFileUri } from '../adapters/local/files.js';import { conflictDialog } from './transfer-conflicts.js';
export function registerTransfers(context,profileUI) {
  const changed=new vscode.EventEmitter();const ephemeral=new Map();
  const profiles={get:id => {try {return profileUI.profiles.get(id);} catch(error) {if (ephemeral.has(id)) return ephemeral.get(id);throw error;}}};
  let warned=false;const journal=new TransferJournal(join(context.globalStorageUri.fsPath,'transfers-v1.json'),message => {if (!warned) {warned=true;void vscode.window.showWarningMessage(message);}});
  journal.ready=(async () => {let key=await context.secrets.get('filetandem.journal.integrity.v1');if (!key) {key=randomBytes(32).toString('hex');await context.secrets.store('filetandem.journal.integrity.v1',key);}if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid journal key.");journal.key=Buffer.from(key,'hex');})().catch(() => {journal.disabled=true;journal.onError("Transfer journal unavailable: Check VS Code SecretStorage. Stored jobs will not be started or modified.");});
  const engine=new TransferEngine({getSftpUploadVerification:()=>vscode.workspace.getConfiguration('filetandem').get('sftpUploadVerification','size'),notifyInterval:100,sessions:profileUI.sessions,profiles,choose:conflictDialog,getPolicy:currentFilePolicy,guard:profileUI.guard,onChange:jobs => {journal.update(jobs);changed.fire();}});
  engine.ready=journal.load().then(jobs => engine.queue.restore(jobs));
  const autoUpload=new AutoUploadService({getPolicy:currentFilePolicy,engine,sessions:profileUI.sessions,profiles,guard:profileUI.guard,onChange:() => changed.fire()});
  const autoChanges=profileUI.changed.event(() => autoUpload.validate());
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event=>{if(['excludedExtensions','excludedNames','excludeHidden','backupRemoteDeletes'].some(key=>event.affectsConfiguration('filetandem.'+key))) autoUpload.validate();}));
  context.subscriptions.push(autoUpload,autoChanges,engine,changed);
  const prepare=async (ids,resume=false) => {
    await engine.ready;profileUI.guard();const jobs=engine.queue.validateRetry(ids,{resume});
    for (const id of new Set(jobs.map(j => j.profileId))) {
      engine.assertManual(id);
      if (jobs.filter(j=>j.profileId===id).every(j=>j.protocol==='local')) continue;
      const profile=profiles.get(id);if (jobs.some(j => j.profileId===id && (j.server!==serverIdentity(profile.host,profile.port).id || (j.profileKey && j.profileKey!==profileIdentity(profile)) || (j.attempt && j.attempt.identity!==profileIdentity(profile))))) throw new Error("Profile changed; create a new job.");
      if (profileUI.sessions.snapshot(id).state!=='connected' || !profileUI.sessions.matches(profile)) await profileUI.connect(profile);
    }profileUI.guard();
  };
  const retry=async ids => {await prepare(ids);return engine.queue.retry(ids,randomUUID);};
  const resume=async ids => {await prepare(ids,true);return engine.resume(ids);};
  profileUI.transfers={engine,changed,autoUpload,resume,retry,cleanup:id => engine.cleanup(id),remember:profile => {if (profile.ephemeral) ephemeral.set(profile.id,profile);}};
  profileUI.command('filetandem.uploadFromExplorer',async (uri,uris) => {
    const list=Array.isArray(uris) && uris.length ? uris:[uri];if (!list.length || list.some(value => !value)) throw new Error("Select local files or folders.");
    const paths=list.map(localFileUri);const profile=await profileUI.choose();if (!profile) return;
    if (profileUI.sessions.snapshot(profile.id).state !== 'connected') await profileUI.connect(profile);
    await engine.submit(profile.id,'upload',paths,profile.remotePath);profileUI.open(profile);
  });
  return {ready:engine.ready,flush:() => journal.flush(),resume,cleanup:id => {profileUI.guard();return engine.cleanup(id);},pause:value => {profileUI.guard();engine.queue.pause(value);},cancel:id => {profileUI.guard();engine.queue.cancel(id);},retry,list:() => {profileUI.guard();return engine.queue.list();},submit:async (id,direction,paths,destination) => {profileUI.guard();return engine.submit(id,direction,paths,destination);}};
}
