import { coalescedRefresh } from '../application/coalesced-refresh.js';
import { browserSettings } from '../shared/browser-settings.js';
import { vscode,language,t } from './localized-vscode.js';
import { randomUUID,randomBytes } from 'node:crypto';
import { planRemoteDelete,executeRemoteDelete } from '../application/remote-delete.js';
import { trashLocal } from './local-operations.js';
import { hasDesktopAccess } from '../application/access-policy.js';
import { executionLocation } from './local-proof.js';
import { createFolder,renameEntry } from '../application/file-operations.js';
import { fileName } from '../domain/file-name.js';
import path,{ posix,join } from 'node:path';
import { planDirectorySync } from '../application/directory-sync.js';
import { openRemoteFiles } from '../application/remote-files.js';
import { LocalFiles,localFileUri,localPath,localParent,localStart } from '../adapters/local/files.js';
import { DirectoryBrowser } from '../application/directory-browser.js';
import { browserViewState } from '../shared/browser-view-state.js';
import { pathFavorites } from '../application/path-favorites.js';
import { browserRequest } from '../shared/browser-messages.js';
export function registerBrowser(context,profileUI) {
  // The workbench must consume forwarded Commander keys instead of debugging.
  profileUI.command('filetandem.consumeCommanderKey',() => {});
  const favorites=pathFavorites(context.globalState);
  const files=new LocalFiles();let handshakes=0,diagnostics=false;const views=new Set();
  profileUI.command('filetandem.copySelection',() => {
    profileUI.guard();if (!vscode.workspace.getConfiguration('filetandem').get('commanderKeys')) return;
    const view=[...views].find(v => v.panel.active);
    if (view) return view.panel.webview.postMessage({version:1,type:'commanderCopy',id:randomUUID(),sessionId:view.model().sessionId});
  });
  const open=(profile,restored={},panel) => {
    profileUI.guard();if (profile) profileUI.transfers.remember(profile);restored=browserViewState(restored);
    const sessionId=randomUUID();const assets=vscode.Uri.joinPath(context.extensionUri,'dist');
    panel ??= vscode.window.createWebviewPanel('filetandem.browser','FileTandem',vscode.ViewColumn.One,{});
    panel.webview.options={enableScripts:true,localResourceRoots:[assets]};
    let alive=true;const recent=new Set();
    const model=() => ({version:1,type:'browserModel',sessionId,diagnostics,autoUpload:profileUI.transfers.autoUpload.state(profile?.id),pathFavorites:favorites.get(profile?.id),locale:language(),profileId:profile?.ephemeral ? undefined:profile?.id,queue:profileUI.transfers.engine.queue.list(profile?.id),queuePaused:profileUI.transfers.engine.queue.paused,local:{...local.state,canBack:local.index>0,canForward:local.index+1<local.history.length},remote:{...remote.state,canBack:remote.index>0,canForward:remote.index+1<remote.history.length},...browserSettings(key => vscode.workspace.getConfiguration('filetandem').get(key)),connection:profile ? {...profileUI.sessions.snapshot(profile.id),name:profile.name} : {state:'disconnected'}});
    const publish=() => {if (alive) {panel.title=profile ? `FileTandem · ${profile.name}`:'FileTandem';void panel.webview.postMessage(model());}};
    let start;try {start=localStart(restored.paths?.local ?? profile?.localPath);} catch {start=localStart();}
    const local=new DirectoryBrowser({start,parent:localParent,list:path => files.list(vscode.Uri.file(localPath(path))),onChange:publish});
    let remoteFiles,remoteTransport,opening;
    const service=async () => {
      if (!profile) throw Object.assign(new Error("Not connected."),{code:'NOT_CONNECTED'});
      if (!profileUI.sessions.matches(profile)) throw new Error("Profile changed; reconnect first.");
      const transport=profileUI.sessions.transport(profile.id);
      if (transport !== remoteTransport) {
        if (opening?.transport === transport) return opening.promise;
        remoteFiles?.close();const pending=openRemoteFiles(transport,profile.protocol);opening={transport,promise:pending};
        const result=await pending;
        if (!alive || opening?.promise !== pending || profileUI.sessions.transport(profile.id) !== transport) {result.close();throw new Error("Connection replaced.");}
        remoteFiles=result;remoteTransport=transport;
      }
      return remoteFiles;
    };
    const remote=new DirectoryBrowser({start:restored.paths.remote ?? profile?.remotePath ?? '/',parent:path => posix.dirname(path),list:async path => (await service()).list(path),onChange:publish});
    remote.state.status='disconnected';
    const view={model,panel,publish,navigate:async (side,path) => {profileUI.guard();if (!alive || !['local','remote'].includes(side)) throw new Error("Session closed.");profileUI.transfers.engine.assertManual(profile?.id);await (side==='local' ? local:remote).navigate(path);}};views.add(view);
    const changes=profileUI.changed.event(() => {
      if (!alive) return;
      if (profile && !profile.ephemeral) {try {profile=profileUI.profiles.get(profile.id);} catch { /* deleted profile keeps disconnected view */ }}
      if (profileUI.sessions.snapshot(profile?.id).state !== 'connected') remote.invalidate();
      else if (remote.state.status === 'disconnected') void remote.refresh();
      publish();
    });
    const observedTerminal=new Set();let observedAuto='';
    const transferRefresh=coalescedRefresh(() => Promise.allSettled([
      local.refresh(),...(profileUI.sessions.snapshot(profile?.id).state==='connected' ? [remote.refresh()]:[])
    ]));
    const configuration=vscode.workspace.onDidChangeConfiguration(e => {if (e.affectsConfiguration('filetandem')) publish();});
    const transferChanges=profileUI.transfers.changed.event(() => {
      publish();
      const newly=profileUI.transfers.engine.queue.list(profile?.id).filter(j => ['completed','failed','cancelled','skipped'].includes(j.state) && !observedTerminal.has(j.id));for (const job of newly) observedTerminal.add(job.id);
      const auto=profileUI.transfers.autoUpload.state(profile?.id),autoKey=JSON.stringify([auto.localRoot,auto.remoteRoot,auto.starting,auto.uploaded,auto.deleted,auto.directories]),autoChanged=autoKey!==observedAuto;observedAuto=autoKey;
      if (newly.length || autoChanged) transferRefresh.request();
    });
    const transfer=async message => {
      profileUI.transfers.engine.assertManual(profile?.id);
      if (!profile || profileUI.sessions.snapshot(profile.id).state !== 'connected') throw new Error("Connect a profile first.");
      const browser=message.side === 'local' ? local:remote;
      if (browser.state.status !== 'ready') throw new Error("Load the source folder first.");
      const selected=message.ids.map(id => browser.state.entries.find(e => e.id === id));if (!selected.length || selected.some(e => !e)) throw new Error("Selection is outdated.");
      let destination=message.side === 'local' ? remote.state.path:local.state.path;if (message.destinationPath && message.destinationPath!==destination) throw new Error("Transfer destination changed; select again.");
      if (message.destination === 'choose') {const folders=await vscode.window.showOpenDialog({title:"Download to",canSelectFolders:true,canSelectFiles:false,canSelectMany:false});if (!folders?.length) return;destination=localFileUri(folders[0]);}
      profileUI.guard();if (!alive) return;if (message.destination==='opposite' && destination!==(message.side==='local' ? remote.state.path:local.state.path)) throw new Error("Transfer destination changed.");
      await profileUI.transfers.engine.submit(profile.id,message.side === 'local' ? 'upload':'download',selected.map(e => e.path),destination);
    };
    let syncing=false;
    const synchronize=async () => {
      profileUI.transfers.engine.assertManual(profile?.id);
      if (syncing || startingAuto) throw new Error("Synchronization is already in progress.");
      syncing=true;
      try {
        if (!profile || profileUI.sessions.snapshot(profile.id).state!=='connected' || local.state.status!=='ready' || remote.state.status!=='ready') throw new Error("Connect and load both folders first.");
        const direction=await vscode.window.showQuickPick([{label:"Local → Remote",value:'upload'},{label:"Remote → Local",value:'download'}],{title:'FileTandem: Synchronization direction'});
        if (!direction || !alive) return;
        const roots={local:local.state.path,remote:remote.state.path},owner=profile,transport=profileUI.sessions.transport(profile.id);
        const valid=() => {profileUI.guard();if (!alive || profile!==owner || local.state.path!==roots.local || remote.state.path!==roots.remote || profileUI.sessions.transport(owner.id)!==transport || !profileUI.sessions.matches(owner)) throw new Error("Synchronization destination changed; recreate the preview.");};
        const remoteAdapter=await service();
        const localAdapter={stat:p => files.stat(vscode.Uri.file(p)),listNoFollow:p => files.listNoFollow(p)};
        const upload=direction.value==='upload';
        const options={source:upload ? localAdapter:remoteAdapter,target:upload ? remoteAdapter:localAdapter,sourceRoot:upload ? roots.local:roots.remote,targetRoot:upload ? roots.remote:roots.local,sourcePath:upload ? path:posix,targetPath:upload ? posix:path,windowsTarget:!upload && process.platform==='win32'};
        const plan=await planDirectorySync(options);valid();
        if (!plan.operations.length) {await vscode.window.showInformationMessage(`Synchronization: no transfers required. Skipped: ${plan.skipped.length}. Comparison uses size and modification time.`);return;}
        const selected=await vscode.window.showQuickPick(plan.operations.map(operation => ({label:operation.relative,description:operation.kind==='directory' ? "Folder including subfolders":"File",picked:true,operation})),{title:`Synchronization: ${direction.label} · ${plan.skipped.length} skipped`,placeHolder:"Size and modification time; no deletions. Select transfers.",canPickMany:true,ignoreFocusOut:true});
        if (!selected?.length) return;valid();
        const confirmed=await vscode.window.showWarningMessage("Start the selected synchronization transfers?",{modal:true,detail:`${direction.label}
${roots.local}
${roots.remote}
${selected.length} selections; folders are recursive. Comparison uses size and modification time, not file contents. Extra destination files are preserved. Symbolic links and special files are skipped. Existing files use the normal conflict dialogs.`},'Start transfers');
        if (confirmed!=='Start transfers') return;valid();
        const fresh=await planDirectorySync(options);valid();
        if (fresh.fingerprint!==plan.fingerprint) throw new Error("Files changed since the preview; restart synchronization.");
        for (const {operation} of selected) {valid();await profileUI.transfers.engine.submit(owner.id,direction.value,[operation.source],operation.destination);}
      } finally {syncing=false;}
    };
    let startingAuto=false;
    const startAutoUpload=async () => {
      if (startingAuto || syncing || busy) throw new Error("A folder operation is already in progress.");
      startingAuto=true;
      try {
        if (!profile || profileUI.sessions.snapshot(profile.id).state!=='connected' || local.state.status!=='ready' || remote.state.status!=='ready') throw new Error("Connect and load both folders first.");
        const owner=profile.id,roots={local:local.state.path,remote:remote.state.path};
        const allowed=() => {if (!alive || profile?.id!==owner || local.state.path!==roots.local || remote.state.path!==roots.remote) throw new Error("Monitored folder or session changed.");};
        const confirmed=await vscode.window.showWarningMessage("Keep the remote folder up to date automatically?",{modal:true,detail:`Local: ${roots.local}
Remote: ${roots.remote}
New and changed local files are uploaded automatically after saving, replacing existing destination files. Monitoring includes subfolders and changes from other applications. On activation, the remote folder is fully synchronized to match the local folder: missing and different files are uploaded, and remote-only files and folders are permanently deleted. The local folder is authoritative. Locally deleted files are permanently deleted remotely as well. Manual transfers and folder navigation are disabled while monitoring is active. Stopping, disconnecting or closing this session ends monitoring.`},"Start monitoring");
        if (confirmed!=="Start monitoring") return;allowed();if (busy || syncing) throw new Error("A folder operation is already in progress.");
        await profileUI.transfers.autoUpload.start({profileId:owner,localRoot:roots.local,remoteRoot:roots.remote,owner:sessionId,allowed});
      } finally {startingAuto=false;}
    };
    let busy=false;
    const action=async message => {
      if (busy) throw new Error("A file action is already running."); busy=true;
      try {
        const browser=message.side === 'local' ? local:remote;
        if (browser.state.status !== 'ready') throw new Error("Load a folder first.");
        const selected=message.ids.map(id => browser.state.entries.find(entry => entry.id === id));
        if (selected.some(entry => !entry)) throw new Error("Selection is outdated; refresh first.");
        if (['open','edit'].includes(message.action)) {if (selected.length!==1 || selected[0].kind!=='file') throw new Error("Select a regular file.");if (message.side==='local') await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(selected[0].path)));else {const uri=await profileUI.editor.show(profile,selected[0].path,() => transfer({side:'remote',ids:message.ids,destination:'choose'}));if (message.action==='edit' && uri?.scheme==='filetandem') await profileUI.editor.enable(uri);}return;}
        const parent=browser.state.path;const windows=message.side === 'local' && process.platform === 'win32';
        const options={windows,join:message.side === 'local' ? join:posix.join};
        const adapter=message.side === 'local' ? {
          stat:path => files.stat(vscode.Uri.file(localPath(path))),
          mkdir:path => files.mkdir(path),
          chmod:(path,mode) => files.chmod(path,mode),
          rename:(source,target) => vscode.workspace.fs.rename(vscode.Uri.file(localPath(source)),vscode.Uri.file(localPath(target)),{overwrite:false}),
        } : await service();
        if (['delete','properties','chmod'].includes(message.action)) {
          if (!selected.length || (message.action !== 'delete' && selected.length !== 1)) throw new Error("Select suitable entries.");
          const allowed=() => !profileUI.transfers.engine.autoUploads.has(profile?.id) && alive && browser.state.path === parent && hasDesktopAccess(executionLocation(context),vscode.workspace.isTrusted);
          if (message.action === 'properties') {
            const info=await adapter.stat(selected[0].path);
            await vscode.window.showInformationMessage(`Properties: ${info.name}`,{modal:true,detail:`Path: ${info.path}
Type: ${t({file:'File',directory:'Folder',symlink:'Symlink',other:'Other'}[info.kind])}
Size: ${info.size} bytes
Modified: ${new Date(info.modified).toLocaleString(language())}
Permissions: ${info.mode.toString(8).padStart(3,'0')}${info.kind === 'symlink' ? `\nLink target: ${info.linkTarget}`:''}`},"Close");return;
          }
          if (message.action === 'chmod') {
            if (selected[0].kind === 'symlink') throw new Error("Symlink permissions are not modified.");
            const mode=await vscode.window.showInputBox({title:`FileTandem: Permissions for ${selected[0].name} (octal, e.g. 644)`,value:selected[0].mode.toString(8).padStart(3,'0'),validateInput:value => /^[0-7]{3}$/.test(value) ? undefined:"Enter three octal digits 000–777."});
            if (mode === undefined) return;if (!allowed()) throw new Error("Permission is no longer valid.");if (!/^[0-7]{3}$/.test(mode)) throw new Error("Invalid permissions.");await adapter.chmod(selected[0].path,parseInt(mode,8));
          } else {
            const plan=message.side === 'remote' ? await planRemoteDelete(adapter,selected.map(e => e.path)) : undefined;
            const choice=message.side === 'remote' ? "Delete permanently":"Move to Trash";
            const count=plan?.length ?? selected.length;
            const confirmed=await vscode.window.showWarningMessage(message.side === 'remote' ? `Remote: Permanently delete ${count} entries?`:`Local: Move ${count} selected entries to Trash?`,{modal:true,detail:`Folder: ${parent}
${selected.slice(0,10).map(e => e.name).join('\n')}${selected.length > 10 ? '\n…':''}
${message.side === 'remote' ? 'Includes subfolders; symlink targets are not deleted.':'Includes subfolders. Trash errors do not trigger permanent deletion.'}`},choice);
            if (confirmed !== choice) return;if (!allowed()) throw new Error("Permission is no longer valid.");
            try {if (plan) await executeRemoteDelete(adapter,plan,allowed);else await trashLocal(selected.map(e => e.path),allowed);}
            finally {if (alive) await browser.refresh();}
          }
          await browser.refresh();return;
        }
        if (message.action === 'rename'  && selected.length !== 1) throw new Error("Select exactly one entry to rename.");
        const name=await vscode.window.showInputBox({title:message.action === 'mkdir' ? "FileTandem: Create new folder":"FileTandem: Rename entry",value:message.action === 'rename' ? selected[0].name:'',ignoreFocusOut:true,validateInput:value => {try {fileName(value,windows);return undefined;} catch(error) {return error.message;}}});
        if (name === undefined) return;
        profileUI.guard();if (!alive || browser.state.path !== parent) throw new Error("The folder changed while the dialog was open.");
        profileUI.transfers.engine.assertManual(profile?.id);
        if (message.action === 'mkdir') await createFolder(adapter,parent,name,options);
        else await renameEntry(adapter,selected[0].path,parent,name,options);
        await browser.refresh();
      } finally {busy=false;}
    };
    const receive=panel.webview.onDidReceiveMessage(async message => {
      if (!alive || !browserRequest(message,sessionId) || recent.has(message.id)) return;
      recent.add(message.id);if (recent.size > 256) recent.delete(recent.values().next().value);
      try {
        profileUI.guard();const browser=message.side === 'remote' ? remote : local;
        const watching=profileUI.transfers.autoUpload.state(profile?.id);
        if (watching.active || watching.starting) {
          if (['transfer','selectUpload','synchronize','connect','reconnect','navigate','history'].includes(message.type) || (message.type==='action' && (message.action!=='properties' && !(message.action==='open' && message.side==='local')))) throw new Error("Automatic upload is active; stop monitoring first.");
        }
        if (message.type === 'autoUploadStart') await startAutoUpload();
        else if (message.type === 'autoUploadStop') profileUI.transfers.autoUpload.stop(profile?.id);
        else if (message.type === 'ready') {handshakes++;await Promise.all([local.refresh(),...(profile && profileUI.sessions.snapshot(profile.id).state === 'connected' ? [remote.refresh()] : [])]);publish();}
        else if (message.type === 'pathFavorite') {await favorites.set(message.side,profile?.id,message.path,message.favorite);for (const view of views) view.publish();}
        else if (message.type === 'connect') {
          const chosen=await profileUI.choose();if (chosen && alive) {await profileUI.connect(chosen);if (!alive) return;profile=chosen;remoteFiles?.close();remoteTransport=undefined;opening=undefined;remote.history=[chosen.remotePath];remote.index=0;await remote.navigate(chosen.remotePath,{history:false});}
        } else if (message.type==='renderProof') {view.renderProof={rows:message.rows,height:message.height,rowHeight:message.rowHeight,scrollHeight:message.scrollHeight,theme:message.theme,focusColor:message.focusColor};}
        else if (message.type === 'newSession') {open(profile);}
        else if (message.type === 'disconnect') {if (profile) await profileUI.disconnect(profile);}
        else if (message.type === 'reconnect') {if (profile) {await profileUI.connect(profile);remoteFiles?.close();remoteTransport=undefined;opening=undefined;await remote.refresh();}}
        else if (message.type === 'queuePause') profileUI.transfers.engine.queue.pause(message.paused);
        else if (message.type === 'queueAction') {
          const owned=profileUI.transfers.engine.queue.list(profile?.id);if (message.ids.some(id => !owned.some(j => j.id === id))) throw new Error("Queue job belongs to another profile.");
          if (message.action === 'cancel') for (const id of message.ids) profileUI.transfers.engine.queue.cancel(id);
          else if (message.action==='retry') await profileUI.transfers.retry(message.ids);
          else if (message.action==='resume') await profileUI.transfers.resume(message.ids);
          else {const job=owned.find(j => j.id===message.ids[0]);if (!job?.attempt) throw new Error("No owned partial file available.");if (await vscode.window.showWarningMessage("Clean up your partial file?",{modal:true,detail:job.attempt.part},"Delete partial file")==="Delete partial file") {profileUI.guard();await profileUI.transfers.cleanup(job.id);}}
        }
        else if (message.type === 'selectUpload') {
          profileUI.transfers.engine.assertManual(profile?.id);
          if (!profile) throw new Error("Connect a profile first.");
          const uris=await vscode.window.showOpenDialog({defaultUri:vscode.Uri.file(localStart()),canSelectFiles:true,canSelectFolders:true,canSelectMany:true,title:"Upload files/folders"});
          if (uris?.length && alive) await profileUI.transfers.engine.submit(profile.id,'upload',uris.map(localFileUri),remote.state.path);
        }
        else if (message.type === 'synchronize') await synchronize();
        else if (message.type === 'transfer') await transfer(message);
        else if (message.type === 'action') await action(message);
        else if (message.type === 'navigate') await browser.navigate(message.path);
        else if (message.type === 'refresh') await browser.refresh();
        else if (message.type === 'history') await browser[message.direction]();
      } catch(error) {if (alive) void vscode.window.showErrorMessage(error.code === 'EEXIST' || error.code === 'FileExists' ? "FileTandem: Destination already exists; nothing overwritten.":`FileTandem: ${error.message}`);}
    });
    panel.onDidDispose(() => {profileUI.transfers.autoUpload.stop(profile?.id,sessionId);alive=false;transferRefresh.dispose();views.delete(view);changes.dispose();configuration.dispose();transferChanges.dispose();receive.dispose();local.invalidate();remote.invalidate();remoteFiles?.close();});
    const script=panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.js'));const style=panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.css'));const nonce=randomBytes(24).toString('base64');
    panel.webview.html=`<!DOCTYPE html><html lang="${language()}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="filetandem-session" content="${sessionId}"><meta name="filetandem-mode" content="browser"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; font-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    context.subscriptions.push(panel);return panel;
  };
  profileUI.open=profile => open(profile);
  profileUI.command('filetandem.openManager',() => open());
  profileUI.command('filetandem.newSession',async id => {const p=typeof id==='string' ? profileUI.profiles.get(id):await profileUI.choose();if (!p) return;if (profileUI.sessions.snapshot(p.id).state!=='connected') await profileUI.connect(p);return open(p);});
  profileUI.command('filetandem.showTransfers',() => open());
  profileUI.command('filetandem.openProfile',async arg => {
    const id=typeof arg === 'string' ? arg:arg?.profileId;
    const profile=id ? profileUI.profiles.get(id):await profileUI.choose();if (!profile) return;
    if (profileUI.sessions.snapshot(profile.id).state !== 'connected') await profileUI.connect(profile);
    return open(profile);
  });
  profileUI.command('filetandem.quickConnect',async () => {const profile=await profileUI.edit(undefined,{quick:true});if (profile) {await profileUI.connect(profile);return open(profile);}});
  profileUI.command('filetandem.favoriteProfile',async arg => {const id=typeof arg === 'string' ? arg:arg?.profileId;const p=id ? profileUI.profiles.get(id):await profileUI.choose();if (p) {await profileUI.profiles.save({...p,favorite:!p.favorite});profileUI.changed.fire();}});
  profileUI.command('filetandem.reconnectProfile',async arg => {const id=typeof arg === 'string' ? arg:arg?.profileId;const p=id ? profileUI.profiles.get(id):await profileUI.choose();if (p) {await profileUI.connect(p);return open(p);}});
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('filetandem.browser',{async deserializeWebviewPanel(panel,state) {try {const restored=browserViewState(state);let profile;if (restored.profileId) {try {profile=profileUI.profiles.get(restored.profileId);} catch { /* removed profile */ }}open(profile,restored,panel);} catch {panel.dispose();}}}));
  return {open,diagnostics:value => {profileUI.guard();diagnostics=value===true;for (const v of views) v.publish();},navigate:async (sessionId,side,path) => {const view=[...views].find(v => v.model().sessionId===sessionId);if (!view) throw new Error("Session closed.");return view.navigate(side,path);},status:() => ({handshakes,views:[...views].map(v => {const m=v.model();return {sessionId:m.sessionId,renderProof:v.renderProof,connection:m.connection,local:{path:m.local.path,status:m.local.status,count:m.local.entries.length},remote:{path:m.remote.path,status:m.remote.status,count:m.remote.entries.length}};})})};
}
