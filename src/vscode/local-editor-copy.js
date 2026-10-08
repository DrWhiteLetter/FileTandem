import { vscode } from './localized-vscode.js';
import { randomUUID } from 'node:crypto';import { mkdir,rm,readFile } from 'node:fs/promises';import { createHash } from 'node:crypto';import { join,dirname,basename,posix } from 'node:path';
import { profileIdentity } from '../application/transfer-resume.js';import { openRemoteFiles } from '../application/remote-files.js';import { EDITOR_LIMIT } from '../adapters/sftp/editor-file.js';
/** SCP uses ordinary desktop files. No filesystem watcher ever submits uploads. */
export function registerLocalEditorCopies(context,ui) {
  const root=join(context.globalStorageUri.fsPath,'editor-copies');const records=new Map();const key='filetandem.editorCopies.v1';
  const valid=r => r?.version===1 && typeof r.local==='string' && r.local.length<=4096 && typeof r.remote==='string' && r.remote.length<=4096 && Object.keys(r).length===6 && Object.keys(r).every(key => ['version','profileId','identity','baseline','remote','local'].includes(key)) && /^[a-zA-Z0-9-]{1,64}$/.test(r.profileId) && /^[a-f0-9]{64}$/.test(r.identity) && /^[a-f0-9]{64}$/.test(r.baseline) && /^[a-f0-9-]{36}$/.test(basename(dirname(r.local ?? ''))) && dirname(dirname(r.local ?? ''))===root && basename(r.local)===posix.basename(r.remote ?? '') && typeof r.remote==='string' && r.remote.startsWith('/') && !/[\x00-\x1f]/.test(r.remote);
  for (const r of (Array.isArray(context.globalState.get(key)) ? context.globalState.get(key):[]).slice(0,64)) if (valid(r)) records.set(vscode.Uri.file(r.local).toString(),r);
  let saving=Promise.resolve();const persist=() => {const pending=saving.then(() => context.globalState.update(key,[...records.values()]));saving=pending.catch(() => {});return pending;};
  const lookup=uri => {ui.guard();const r=records.get(uri?.toString());if (!r || uri.scheme!=='file' || !valid(r)) throw new Error('Zuerst eine eigene SCP-Editorkopie öffnen.');return r;};
  const wait=async batch => {
    const check=() => ui.transfers.engine.queue.list().filter(j => batch.ids.includes(j.id));
    return new Promise((resolve,reject) => {let listener;const done=() => {const jobs=check();if (jobs.length!==batch.ids.length || jobs.some(j => ['queued','running'].includes(j.state))) return;listener?.dispose();if (jobs.some(j => j.state!=='completed')) reject(new Error('Editor-Kopie konnte nicht vollständig übertragen werden. Queue prüfen.'));else resolve(jobs[0]);};listener=ui.transfers.changed.event(done);done();});
  };
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right,22);
  const refresh=() => {const r=records.get(vscode.window.activeTextEditor?.document.uri.toString());void vscode.commands.executeCommand('setContext','filetandem.editorCopyActive',!!r);if (!r) return status.hide();status.text='$(cloud-upload) FileTandem: Lokale SCP-Kopie';status.tooltip=`${r.remote}\nAuto Save speichert nur lokal. Upload ausschließlich über diesen Befehl.`;status.command='filetandem.uploadEditorCopy';status.show();};
  const api={
    async open(profile,path,download) {
      ui.guard();if (profile.protocol!=='scp' || records.size>=64) throw new Error('SCP-Editorkopie nicht verfügbar; gespeicherte Kopien bereinigen.');
      const files=await openRemoteFiles(ui.sessions.transport(profile.id),'scp');try {const info=await files.stat(path);if (info.kind!=='file') throw new Error('Bitte eine reguläre Datei auswählen.');if (info.size>EDITOR_LIMIT) {if (download) {if (await vscode.window.showInformationMessage('Editor-Limit: 10 MiB. Datei herunterladen.','Herunterladen')==='Herunterladen') return download();return;}throw new Error('Editor-Limit: 10 MiB. Bitte die Datei übertragen.');}} finally {files.close();}
      const folder=join(root,randomUUID());await mkdir(folder,{recursive:true,mode:0o700});
      try {const job=await wait(await ui.transfers.engine.submit(profile.id,'download',[path],folder));const uri=vscode.Uri.file(job.finalTarget);const record={version:1,profileId:profile.id,identity:profileIdentity(profile),baseline:job.sha256,remote:path,local:uri.fsPath};if (!valid(record)) throw new Error('Ungültige lokale Editorkopie.');records.set(uri.toString(),record);await persist();await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri),{preview:false});refresh();return uri;} catch(e) {await rm(folder,{recursive:true,force:true});throw e;}
    },
    async upload(uri,confirm=async detail => await vscode.window.showWarningMessage('Lokale SCP-Kopie ausdrücklich hochladen?',{modal:true,detail},'Kopie hochladen')==='Kopie hochladen') {
      const r=lookup(uri);const p=ui.profiles.get(r.profileId);if (p.protocol!=='scp' || profileIdentity(p)!==r.identity) throw new Error('Profilziel wurde geändert; Kopie erneut herunterladen.');
      if (await confirm(`${p.name}: ${r.remote}\nAuto Save speichert nur lokal. Dieser Auftrag ersetzt nach Prüfung den ursprünglich heruntergeladenen Serverstand.`)!==true) return;
      ui.guard();if (!ui.sessions.matches(p) || ui.sessions.snapshot(p.id).state!=='connected') await ui.connect(p);
      const doc=vscode.workspace.textDocuments.find(d => d.uri.toString()===uri.toString());if (doc?.isDirty && !await doc.save()) throw new Error('Lokale Kopie zuerst speichern.');
      const batch=await ui.transfers.engine.submit(p.id,'upload',[r.local],posix.dirname(r.remote),{reviewedReplacement:r.baseline});
      void wait(batch).then(async job => {r.baseline=job.sha256;await persist();refresh();}).catch(() => {});return batch;
    },
    async remove(uri,confirm=async detail => await vscode.window.showWarningMessage('Eigene lokale Editorkopie löschen?',{modal:true,detail},'Kopie löschen')==='Kopie löschen') {
      const r=lookup(uri);if (vscode.workspace.textDocuments.some(d => d.uri.toString()===uri.toString() && d.isDirty)) throw new Error('Ungespeicherte Kopie zuerst speichern oder verwerfen.');
      if (ui.transfers.engine.queue.list().some(j => j.source===r.local && ['queued','running'].includes(j.state))) throw new Error('Upload der Kopie läuft noch.');
      if (await confirm(r.local)!==true) return false;lookup(uri);await rm(dirname(r.local),{recursive:true,force:true});records.delete(uri.toString());await persist();refresh();return true;
    },
    status:() => ({copies:records.size}),
  };
  // Uploaded copies can be discarded on close only if they still match the
  // uploaded bytes. Unsent drafts survive restart in private desktop storage.
  context.subscriptions.push(status,vscode.window.onDidChangeActiveTextEditor(refresh),vscode.workspace.onDidCloseTextDocument(doc => {const r=records.get(doc.uri.toString());if (r) void readFile(r.local).then(data => {if (createHash('sha256').update(data).digest('hex')===r.baseline) return api.remove(doc.uri,async () => true);}).catch(() => {});}));
  const choose=async () => {const uri=vscode.window.activeTextEditor?.document.uri;if (records.has(uri?.toString())) return uri;const selected=await vscode.window.showQuickPick([...records.values()].map(r => ({label:posix.basename(r.remote),description:r.remote,record:r})),{title:'Gespeicherte SCP-Editorkopie auswählen'});return selected && vscode.Uri.file(selected.record.local);};
  ui.command('filetandem.openEditorCopy',async () => {const uri=await choose();if (uri) {lookup(uri);await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));}});ui.command('filetandem.uploadEditorCopy',async () => {const uri=await choose();if (uri) return api.upload(uri);});ui.command('filetandem.removeEditorCopy',async () => {const uri=await choose();if (uri) return api.remove(uri);});
  return api;
}
