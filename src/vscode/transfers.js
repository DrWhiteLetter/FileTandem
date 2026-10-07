import * as vscode from 'vscode';import { TransferEngine } from '../application/transfer-engine.js';import { localFileUri } from '../adapters/local/files.js';import { conflictDialog } from './transfer-conflicts.js';
export function registerTransfers(context,profileUI) {
  const changed=new vscode.EventEmitter();const ephemeral=new Map();
  const profiles={get:id => {try {return profileUI.profiles.get(id);} catch(error) {if (ephemeral.has(id)) return ephemeral.get(id);throw error;}}};
  const engine=new TransferEngine({sessions:profileUI.sessions,profiles,choose:conflictDialog,guard:profileUI.guard,onChange:() => changed.fire()});
  context.subscriptions.push(engine,changed);
  profileUI.transfers={engine,changed,remember:profile => {if (profile.ephemeral) ephemeral.set(profile.id,profile);}};
  profileUI.command('xscp.uploadFromExplorer',async (uri,uris) => {
    const list=Array.isArray(uris) && uris.length ? uris:[uri];if (!list.length || list.some(value => !value)) throw new Error('Bitte lokale Dateien/Ordner auswählen.');
    const paths=list.map(localFileUri);const profile=await profileUI.choose();if (!profile) return;
    if (profileUI.sessions.snapshot(profile.id).state !== 'connected') await profileUI.connect(profile);
    await engine.submit(profile.id,'upload',paths,profile.remotePath);profileUI.open(profile);
  });
  return {list:() => {profileUI.guard();return engine.queue.list();},submit:async (id,direction,paths,destination) => {profileUI.guard();return engine.submit(id,direction,paths,destination);}};
}
