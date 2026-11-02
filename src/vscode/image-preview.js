import { registerFileOpeningProgress } from './file-opening-progress.js';
import { mkdtemp,rm,chmod,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const IMAGE_PREVIEW_LIMIT=10*1024*1024;
export const isPreviewImage=path => /\.(?:jpe?g|png|gif|webp|bmp|ico)$/i.test(path);

/** Read-only remote snapshots, owned only for the lifetime of their image tabs. */
export function registerImagePreviews(context,ui,{vscode,openRemoteFiles,t=value=>value,onChange=()=>{},progress=registerFileOpeningProgress(context,{vscode,t,onChange})}) {
  const copies=new Map();let disposed=false;
  const remove=async key => {const folder=copies.get(key);if (folder) {await rm(folder,{recursive:true,force:true});copies.delete(key);}};
  const visible=()=>new Set(vscode.window.tabGroups.all.flatMap(group=>group.tabs.map(tab=>tab.input?.uri?.toString())).filter(Boolean));
  const cleanup=async()=>{const open=visible();await Promise.allSettled([...copies.keys()].filter(key=>!open.has(key)).map(remove));};
  context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(()=>{void cleanup();}),{dispose(){disposed=true;for (const key of copies.keys()) void remove(key).catch(()=>{});}});
  const api={
    state(profile,path) {return progress.state(profile,path);},
    async openLocal(path) {ui.guard();await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.file(path),'imagePreview.previewEditor');},
    openRemote(profile,path,download) {
      return progress.run(profile,path,report=>openRemote(profile,path,download,report),'Preparing preview …');
    },
  };
  async function openRemote(profile,path,download,report) {
      ui.guard();if (disposed) throw new Error('Image preview closed.');
      const files=await openRemoteFiles(ui.sessions.transport(profile.id),profile.protocol);
      try {const info=await files.stat(path);if (info.kind!=='file') throw new Error('Select a regular file.');if (info.size>IMAGE_PREVIEW_LIMIT) {if (await vscode.window.showInformationMessage('Image preview limit: 10 MiB. Download this file.','Download')==='Download') return download();return;}} finally {files.close();}
      const folder=await mkdtemp(join(tmpdir(),'filetandem-preview-'));
      try {
        const batch=await ui.transfers.engine.submit(profile.id,'download',[path],folder);
        const job=await new Promise((resolve,reject)=>{
          let listener;const check=()=>{const jobs=ui.transfers.engine.queue.list().filter(job=>batch.ids.includes(job.id));report(jobs.some(job=>job.state==='running') ? 'Loading image …':jobs.some(job=>job.state==='queued') ? ui.transfers.engine.queue.paused ? 'Preview waiting – transfers paused':'Waiting for transfer …':'Opening image …');if (jobs.length!==batch.ids.length || jobs.some(job=>['queued','running'].includes(job.state))) return;listener?.dispose();if (jobs.length!==1 || jobs[0].state!=='completed') reject(new Error('Image download did not complete. Check the queue.'));else resolve(jobs[0]);};listener=ui.transfers.changed.event(check);check();
        });
        if (disposed) throw new Error('Image preview closed.');ui.guard();
        if ((await stat(job.finalTarget)).size>IMAGE_PREVIEW_LIMIT) throw new Error('Image preview limit: 10 MiB. Download this file.');
        await chmod(job.finalTarget,0o400);
        const uri=vscode.Uri.file(job.finalTarget);
        // Register after opening: tab events during opening must not remove the file.
        await vscode.commands.executeCommand('vscode.openWith',uri,'imagePreview.previewEditor');
        if (disposed) {await rm(folder,{recursive:true,force:true});return;}
        copies.set(uri.toString(),folder);await cleanup();return uri;
      } catch(error) {await rm(folder,{recursive:true,force:true});throw error;}
  }
  return api;
}
