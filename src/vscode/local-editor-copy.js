import { vscode } from './localized-vscode.js';
import { randomUUID } from 'node:crypto';import { mkdir,rm,readFile } from 'node:fs/promises';import { createHash } from 'node:crypto';import { join,dirname,basename,posix } from 'node:path';
import { profileIdentity } from '../application/transfer-resume.js';import { openRemoteFiles } from '../application/remote-files.js';import { EDITOR_LIMIT } from '../adapters/sftp/editor-file.js';
/** SCP uses ordinary desktop files. No filesystem watcher ever submits uploads. */
export function registerLocalEditorCopies(context,ui) {
  const root=join(context.globalStorageUri.fsPath,'editor-copies');const records=new Map();const key='filetandem.editorCopies.v1';
  const valid=r => r?.version===1 && typeof r.local==='string' && r.local.length<=4096 && typeof r.remote==='string' && r.remote.length<=4096 && Object.keys(r).length===6 && Object.keys(r).every(key => ['version','profileId','identity','baseline','remote','local'].includes(key)) && /^[a-zA-Z0-9-]{1,64}$/.test(r.profileId) && /^[a-f0-9]{64}$/.test(r.identity) && /^[a-f0-9]{64}$/.test(r.baseline) && /^[a-f0-9-]{36}$/.test(basename(dirname(r.local ?? ''))) && dirname(dirname(r.local ?? ''))===root && basename(r.local)===posix.basename(r.remote ?? '') && typeof r.remote==='string' && r.remote.startsWith('/') && !/[\x00-\x1f]/.test(r.remote);
  for (const r of (Array.isArray(context.globalState.get(key)) ? context.globalState.get(key):[]).slice(0,64)) if (valid(r)) records.set(vscode.Uri.file(r.local).toString(),r);
  let saving=Promise.resolve();const persist=() => {const pending=saving.then(() => context.globalState.update(key,[...records.values()]));saving=pending.catch(() => {});return pending;};
  const lookup=uri => {ui.guard();const r=records.get(uri?.toString());if (!r || uri.scheme!=='file' || !valid(r)) throw new Error("Open an owned SCP editor copy first.");return r;};
  const wait=async (batch,report=()=>{}) => {
    const check=() => ui.transfers.engine.queue.list().filter(j => batch.ids.includes(j.id));
    return new Promise((resolve,reject) => {let listener;const done=() => {const jobs=check();report(jobs.some(j=>j.state==='running') ? 'Loading file …':jobs.some(j=>j.state==='queued') ? ui.transfers.engine.queue.paused ? 'File waiting – transfers paused':'Waiting for transfer …':'Opening file …');if (jobs.length!==batch.ids.length || jobs.some(j => ['queued','running'].includes(j.state))) return;listener?.dispose();if (jobs.some(j => j.state!=='completed')) reject(new Error("Editor copy transfer did not complete. Check the queue."));else resolve(jobs[0]);};listener=ui.transfers.changed.event(done);done();});
  };
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right,22);
  const refresh=() => {const r=records.get(vscode.window.activeTextEditor?.document.uri.toString());void vscode.commands.executeCommand('setContext','filetandem.editorCopyActive',!!r);if (!r) return status.hide();status.text="$(cloud-upload) FileTandem: Local SCP copy";status.tooltip=`${r.remote}
Auto Save saves locally only. Upload using this command explicitly.`;status.command='filetandem.uploadEditorCopy';status.show();};
  const api={
    async open(profile,path,download,report=()=>{}) {
      ui.guard();if (profile.protocol!=='scp' || records.size>=64) throw new Error("SCP editor copy unavailable; clean up saved copies.");
      const files=await openRemoteFiles(ui.sessions.transport(profile.id),'scp');try {const info=await files.stat(path);if (info.kind!=='file') throw new Error("Select a regular file.");if (info.size>EDITOR_LIMIT) {if (download) {if (await vscode.window.showInformationMessage("Editor limit: 10 MiB. Download this file.","Download")==="Download") return download();return;}throw new Error("Editor limit: 10 MiB. Transfer this file.");}} finally {files.close();}
      const folder=join(root,randomUUID());await mkdir(folder,{recursive:true,mode:0o700});
      try {const job=await wait(await ui.transfers.engine.submit(profile.id,'download',[path],folder),report);const uri=vscode.Uri.file(job.finalTarget);const record={version:1,profileId:profile.id,identity:profileIdentity(profile),baseline:job.sha256,remote:path,local:uri.fsPath};if (!valid(record)) throw new Error("Invalid local editor copy.");records.set(uri.toString(),record);await persist();await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri),{preview:false});refresh();return uri;} catch(e) {await rm(folder,{recursive:true,force:true});throw e;}
    },
    async upload(uri,confirm=async detail => await vscode.window.showWarningMessage("Explicitly upload the local SCP copy?",{modal:true,detail},"Upload copy")==="Upload copy") {
      const r=lookup(uri);const p=ui.profiles.get(r.profileId);if (p.protocol!=='scp' || profileIdentity(p)!==r.identity) throw new Error("Profile destination changed; download the copy again.");
      if (await confirm(`${p.name}: ${r.remote}
Auto Save saves locally only. After verification, this job replaces the originally downloaded server version.`)!==true) return;
      ui.guard();if (!ui.sessions.matches(p) || ui.sessions.snapshot(p.id).state!=='connected') await ui.connect(p);
      const doc=vscode.workspace.textDocuments.find(d => d.uri.toString()===uri.toString());if (doc?.isDirty && !await doc.save()) throw new Error("Save the local copy first.");
      const batch=await ui.transfers.engine.submit(p.id,'upload',[r.local],posix.dirname(r.remote),{reviewedReplacement:r.baseline});
      void wait(batch).then(async job => {r.baseline=job.sha256;await persist();refresh();}).catch(() => {});return batch;
    },
    async remove(uri,confirm=async detail => await vscode.window.showWarningMessage("Delete your local editor copy?",{modal:true,detail},"Delete copy")==="Delete copy") {
      const r=lookup(uri);if (vscode.workspace.textDocuments.some(d => d.uri.toString()===uri.toString() && d.isDirty)) throw new Error("Save or discard the unsaved copy first.");
      if (ui.transfers.engine.queue.list().some(j => j.source===r.local && ['queued','running'].includes(j.state))) throw new Error("The copy upload is still running.");
      if (await confirm(r.local)!==true) return false;lookup(uri);await rm(dirname(r.local),{recursive:true,force:true});records.delete(uri.toString());await persist();refresh();return true;
    },
    status:() => ({copies:records.size}),
  };
  // Uploaded copies can be discarded on close only if they still match the
  // uploaded bytes. Unsent drafts survive restart in private desktop storage.
  context.subscriptions.push(status,vscode.window.onDidChangeActiveTextEditor(refresh),vscode.workspace.onDidCloseTextDocument(doc => {const r=records.get(doc.uri.toString());if (r) void readFile(r.local).then(data => {if (createHash('sha256').update(data).digest('hex')===r.baseline) return api.remove(doc.uri,async () => true);}).catch(() => {});}));
  const choose=async () => {const uri=vscode.window.activeTextEditor?.document.uri;if (records.has(uri?.toString())) return uri;const selected=await vscode.window.showQuickPick([...records.values()].map(r => ({label:posix.basename(r.remote),description:r.remote,record:r})),{title:"Select saved SCP editor copy"});return selected && vscode.Uri.file(selected.record.local);};
  ui.command('filetandem.openEditorCopy',async () => {const uri=await choose();if (uri) {lookup(uri);await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));}});ui.command('filetandem.uploadEditorCopy',async () => {const uri=await choose();if (uri) return api.upload(uri);});ui.command('filetandem.removeEditorCopy',async () => {const uri=await choose();if (uri) return api.remove(uri);});
  return api;
}
