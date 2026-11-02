import { registerFileOpeningProgress } from './file-opening-progress.js';
import { isPreviewImage,registerImagePreviews } from './image-preview.js';
import {LOCAL_PROFILE_ID} from '../application/local-transfer.js';
import {currentFilePolicy} from './file-options.js';
import {isBackupPath} from '../application/file-policy.js';
import {planRemoteBackup,executeRemoteBackup,restoreRemoteBackup} from '../application/remote-backup.js';
import {serverIdentity} from '../adapters/ssh/host-keys.js';
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
  profileUI.command('filetandem.openSettings',()=>vscode.commands.executeCommand('workbench.action.openSettings','@ext:xscp-dev.xscp'));
  const openingProgress=registerFileOpeningProgress(context,{vscode,t,onChange:()=>{for (const view of views) view.publish();}});
  const images=registerImagePreviews(context,profileUI,{vscode,openRemoteFiles,progress:openingProgress});
  const annotations=new WeakMap();
  const annotate=(state,policy)=>{let cached=annotations.get(state.entries);if(!cached || cached.signature!==policy.signature) {cached={signature:policy.signature,entries:state.entries.map(entry=>({...entry,excluded:policy.excludes(entry.path,entry.kind),backup:isBackupPath(entry.path)}))};annotations.set(state.entries,cached);}return {...state,entries:cached.entries};};
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
    const localSide=side => side==='local' || !profile;
    const queueOwner=()=>profile?.id ?? LOCAL_PROFILE_ID;
    const model=() => {const policy=currentFilePolicy();return ({version:1,type:'browserModel',mode:profile ? 'remote':'local',sessionId,diagnostics,autoUpload:profileUI.transfers.autoUpload.state(profile?.id),pathFavorites:favorites.get(profile?.id),locale:language(),profileId:profile?.ephemeral ? undefined:profile?.id,queue:profileUI.transfers.engine.queue.list(queueOwner()),queuePaused:profileUI.transfers.engine.queue.paused,local:{...annotate(local.state,policy),canBack:local.index>0,canForward:local.index+1<local.history.length},remote:{...annotate(remote.state,policy),entries:annotate(remote.state,policy).entries.map(entry=>({...entry,previewStatus:profile ? openingProgress.state(profile,entry.path):undefined})),canBack:remote.index>0,canForward:remote.index+1<remote.history.length},...browserSettings(key => vscode.workspace.getConfiguration('filetandem').get(key)),connection:profile ? {...profileUI.sessions.snapshot(profile.id),name:profile.name} : {state:'disconnected'}});};
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
    let rightStart;try {rightStart=profile ? restored.paths.remote ?? profile.remotePath:localStart(restored.paths.remote);} catch {rightStart=localStart();}
    const remote=new DirectoryBrowser({start:rightStart,parent:value => profile ? posix.dirname(value):localParent(value),list:async value => profile ? (await service()).list(value):files.list(vscode.Uri.file(localPath(value))),onChange:publish});
    if (profile) remote.state.status='disconnected';
    const view={model,panel,publish,navigate:async (side,path) => {profileUI.guard();if (!alive || !['local','remote'].includes(side)) throw new Error("Session closed.");profileUI.transfers.engine.assertManual(profile?.id);await (side==='local' ? local:remote).navigate(path);}};views.add(view);
    const changes=profileUI.changed.event(() => {
      if (!alive) return;
      if (profile && !profile.ephemeral) {try {profile=profileUI.profiles.get(profile.id);} catch { /* deleted profile keeps disconnected view */ }}
      if (!profile) {publish();return;}
      if (profileUI.sessions.snapshot(profile.id).state !== 'connected') remote.invalidate();
      else if (remote.state.status === 'disconnected') void remote.refresh();
      publish();
    });
    const observedTerminal=new Set();let observedAuto='';
    const transferRefresh=coalescedRefresh(() => Promise.allSettled([
      local.refresh(),...(!profile || profileUI.sessions.snapshot(profile.id).state==='connected' ? [remote.refresh()]:[])
    ]));
    const configuration=vscode.workspace.onDidChangeConfiguration(e => {if (e.affectsConfiguration('filetandem')) publish();});
    const transferChanges=profileUI.transfers.changed.event(() => {
      publish();
      const newly=profileUI.transfers.engine.queue.list(queueOwner()).filter(j => ['completed','failed','cancelled','skipped'].includes(j.state) && !observedTerminal.has(j.id));for (const job of newly) observedTerminal.add(job.id);
      const auto=profileUI.transfers.autoUpload.state(profile?.id),autoKey=JSON.stringify([auto.localRoot,auto.remoteRoot,auto.starting,auto.uploaded,auto.deleted,auto.directories]),autoChanged=autoKey!==observedAuto;observedAuto=autoKey;
      if (newly.length || autoChanged) transferRefresh.request();
    });
    const transfer=async message => {
      const owner=profile;
      profileUI.transfers.engine.assertManual(profile?.id);
      if (profile && profileUI.sessions.snapshot(profile.id).state !== 'connected') throw new Error("Connect a profile first.");
      const browser=message.side === 'local' ? local:remote;
      if (browser.state.status !== 'ready') throw new Error("Load the source folder first.");
      const selected=message.ids.map(id => browser.state.entries.find(e => e.id === id));if (!selected.length || selected.some(e => !e)) throw new Error("Selection is outdated.");
      const opposite=message.side==='local' ? remote:local;if (opposite.state.status!=='ready' && message.destination!=='choose') throw new Error('Load the destination folder first.');
      let destination=message.side === 'local' ? remote.state.path:local.state.path;if (message.destinationPath && message.destinationPath!==destination) throw new Error("Transfer destination changed; select again.");
      if (message.destination === 'choose') {const folders=await vscode.window.showOpenDialog({title:"Download to",canSelectFolders:true,canSelectFiles:false,canSelectMany:false});if (!folders?.length) return;destination=localFileUri(folders[0]);}
      profileUI.guard();if (!alive) return;if (profile!==owner) throw new Error("Transfer destination changed.");if (message.destination==='opposite' && destination!==(message.side==='local' ? remote.state.path:local.state.path)) throw new Error("Transfer destination changed.");
      if (!profile) await profileUI.transfers.engine.submitLocal(message.side==='local' ? 'upload':'download',selected.map(e=>e.path),destination);
      else await profileUI.transfers.engine.submit(profile.id,message.side === 'local' ? 'upload':'download',selected.map(e => e.path),destination);
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
        const policy=currentFilePolicy();
        if(policy.excludes(local.state.path,'directory') || policy.excludes(remote.state.path,'directory')) throw new Error('Selected folder is excluded by FileTandem settings.');
        const roots={local:local.state.path,remote:remote.state.path},owner=profile,transport=profileUI.sessions.transport(profile.id);
        const valid=() => {profileUI.guard();if (currentFilePolicy().signature!==policy.signature || !alive || profile!==owner || local.state.path!==roots.local || remote.state.path!==roots.remote || profileUI.sessions.transport(owner.id)!==transport || !profileUI.sessions.matches(owner)) throw new Error("Synchronization destination changed; recreate the preview.");};
        const remoteAdapter=await service();
        const localAdapter={stat:p => files.stat(vscode.Uri.file(p)),listNoFollow:p => files.listNoFollow(p)};
        const upload=direction.value==='upload';
        const options={exclude:policy.excludes,source:upload ? localAdapter:remoteAdapter,target:upload ? remoteAdapter:localAdapter,sourceRoot:upload ? roots.local:roots.remote,targetRoot:upload ? roots.remote:roots.local,sourcePath:upload ? path:posix,targetPath:upload ? posix:path,windowsTarget:!upload && process.platform==='win32'};
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
${t('New and changed local files are uploaded automatically after saving, replacing existing destination files. The local folder is authoritative, including removals. Excluded entries and existing .bak backups are preserved. Manual transfers and folder navigation are disabled while monitoring is active. Stopping, disconnecting or closing this session ends monitoring.')}
${currentFilePolicy().backupRemoteDeletes ? t('Removed remote files are renamed to .bak backups. Folders containing backups or excluded entries are retained. Backups beside website files may be publicly downloadable; block access on the web server.'):t('Deletion backups are disabled: removed remote entries are permanently deleted.')}`},"Start monitoring");
        if (confirmed!=="Start monitoring") return;allowed();if (busy || syncing) throw new Error("A folder operation is already in progress.");
        await profileUI.transfers.autoUpload.start({profileId:owner,localRoot:roots.local,remoteRoot:roots.remote,owner:sessionId,allowed});
      } finally {startingAuto=false;}
    };
    let busy=false;
    const action=async message => {
      if (message.side==='remote' && profile && ['open','edit'].includes(message.action) && message.ids.length===1) {const entry=remote.state.entries.find(entry=>entry.id===message.ids[0]);if (entry && openingProgress.state(profile,entry.path)) return;}
      if (busy) throw new Error("A file action is already running."); busy=true;
      try {
        const browser=message.side==='local' ? local:remote;
        if (browser.state.status !== 'ready') throw new Error("Load a folder first.");
        const selected=message.ids.map(id => browser.state.entries.find(entry => entry.id === id));
        if (selected.some(entry => !entry)) throw new Error("Selection is outdated; refresh first.");
        if (['open','edit'].includes(message.action)) {if (selected.length!==1 || selected[0].kind!=='file') throw new Error("Select a regular file.");if (isPreviewImage(selected[0].path)) {if (localSide(message.side)) await images.openLocal(selected[0].path);else await images.openRemote(profile,selected[0].path,() => transfer({side:'remote',ids:message.ids,destination:'choose'}));return;}if (localSide(message.side)) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(selected[0].path)));else {const uri=await openingProgress.run(profile,selected[0].path,report=>profileUI.editor.show(profile,selected[0].path,() => transfer({side:'remote',ids:message.ids,destination:'choose'}),report));if (message.action==='edit' && uri?.scheme==='filetandem') await profileUI.editor.enable(uri);}return;}
        const parent=browser.state.path;const windows=localSide(message.side) && process.platform === 'win32';
        const options={windows,join:localSide(message.side) ? join:posix.join};
        const adapter=localSide(message.side) ? {
          stat:path => files.stat(vscode.Uri.file(localPath(path))),
          mkdir:path => files.mkdir(path),
          chmod:(path,mode) => files.chmod(path,mode),
          rename:(source,target) => vscode.workspace.fs.rename(vscode.Uri.file(localPath(source)),vscode.Uri.file(localPath(target)),{overwrite:false}),
        } : await service();
        if (['delete','properties','chmod','restoreBackup'].includes(message.action)) {
          if (!selected.length || (message.action !== 'delete' && selected.length !== 1)) throw new Error("Select suitable entries.");
          const actionProfile=profile,actionTransport=!localSide(message.side) ? profileUI.sessions.transport(profile.id):undefined;
          const sameConnection=()=>localSide(message.side) || profile===actionProfile && profileUI.sessions.snapshot(actionProfile.id).state==='connected' && profileUI.sessions.matches(actionProfile) && profileUI.sessions.transport(actionProfile.id)===actionTransport;
          const allowed=() => sameConnection() && !profileUI.transfers.engine.autoUploads.has(profile?.id) && alive && browser.state.path === parent && hasDesktopAccess(executionLocation(context),vscode.workspace.isTrusted);
          if(message.action==='restoreBackup') {
            if(localSide(message.side) || !isBackupPath(selected[0].path)) throw new Error('Select a remote .bak backup to restore.');
            const original=selected[0].path.replace(/\.bak(?:\.\d+)?$/i,'');
            if(await vscode.window.showWarningMessage('Restore this backup?',{modal:true,detail:original},'Restore backup')!=='Restore backup') return;
            const key=profileUI.transfers.engine.key({direction:'upload',server:serverIdentity(profile.host,profile.port).id},original);
            await profileUI.transfers.engine.queue.maintain(key,()=>restoreRemoteBackup(adapter,selected[0].path,allowed));await browser.refresh();return;
          }
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
            const policy=currentFilePolicy(),paths=selected.map(entry=>entry.path),owner=profile;
            const backupSelections=selected.filter(entry=>isBackupPath(entry.path));
            if(!localSide(message.side) && backupSelections.length && backupSelections.length!==selected.length) throw new Error('Delete backup files separately to remove them permanently.');
            const backup=!localSide(message.side) && policy.backupRemoteDeletes && !backupSelections.length;
            const plan=!localSide(message.side) ? backup ? await planRemoteBackup(adapter,paths):await planRemoteDelete(adapter,paths):undefined;
            const choice=localSide(message.side) ? 'Move to Trash':backup ? 'Create .bak backups':'Delete permanently';
            const count=backup ? plan.length:plan?.length ?? selected.length;
            const detail=backup ? t('Selected files and folders are renamed beside the originals. Existing backups are kept with numbered names. Backups are excluded from transfers and automatic deletion. Backups beside website files may be publicly downloadable; block access on the web server.'):!localSide(message.side) ? t('Includes subfolders; symlink targets are not deleted.'):t('Includes subfolders. Trash errors do not trigger permanent deletion.');
            const title=localSide(message.side) ? `Local: Move ${count} selected entries to Trash?`:backup ? `Remote: Back up ${count} selected entries instead of deleting them?`:`Remote: Permanently delete ${count} entries?`;
            const confirmed=await vscode.window.showWarningMessage(title,{modal:true,detail:`${parent}\n${selected.slice(0,10).map(entry=>entry.name).join('\n')}\n${detail}`},choice);
            const permitted=()=>allowed() && profile===owner && currentFilePolicy().signature===policy.signature;
            if(confirmed!==choice) return;if(!permitted()) throw new Error('Permission is no longer valid.');
            try {
              if(localSide(message.side)) await trashLocal(paths,permitted);
              else {
                const roots=paths.slice().sort().filter((path,index,all)=>!all.slice(0,index).some(parent=>path.startsWith(parent+'/')));
                const locked=async index=>index===roots.length ? backup ? executeRemoteBackup(adapter,plan,permitted):executeRemoteDelete(adapter,plan,permitted):profileUI.transfers.engine.queue.maintain(profileUI.transfers.engine.key({direction:'upload',server:serverIdentity(profile.host,profile.port).id},roots[index]),()=>locked(index+1));
                await locked(0);
              }
            } finally {if(alive) await browser.refresh();}
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
        if(message.type==='settings') await vscode.commands.executeCommand('filetandem.openSettings');
        else if (message.type === 'autoUploadStart') await startAutoUpload();
        else if (message.type === 'autoUploadStop') profileUI.transfers.autoUpload.stop(profile?.id);
        else if (message.type === 'ready') {handshakes++;await Promise.all([local.refresh(),...(!profile || profileUI.sessions.snapshot(profile.id).state === 'connected' ? [remote.refresh()] : [])]);publish();}
        else if (message.type === 'pathFavorite') {await favorites.set(message.side,profile?.id,message.path,message.favorite);for (const view of views) view.publish();}
        else if (message.type === 'connect') {
          const chosen=await profileUI.choose();if (chosen && alive) {await profileUI.connect(chosen);if (!alive) return;profile=chosen;remoteFiles?.close();remoteTransport=undefined;opening=undefined;remote.history=[chosen.remotePath];remote.index=0;await remote.navigate(chosen.remotePath,{history:false});}
        } else if (message.type==='renderProof') {view.renderProof={rows:message.rows,height:message.height,rowHeight:message.rowHeight,scrollHeight:message.scrollHeight,theme:message.theme,focusColor:message.focusColor};}
        else if (message.type === 'newSession') {open(profile);}
        else if (message.type === 'disconnect') {if (profile) await profileUI.disconnect(profile);}
        else if (message.type === 'reconnect') {if (profile) {await profileUI.connect(profile);remoteFiles?.close();remoteTransport=undefined;opening=undefined;await remote.refresh();}}
        else if (message.type === 'queuePause') profileUI.transfers.engine.queue.pause(message.paused);
        else if (message.type === 'queueAction') {
          const owned=profileUI.transfers.engine.queue.list(queueOwner());if (message.ids.some(id => !owned.some(j => j.id === id))) throw new Error("Queue job belongs to another profile.");
          if (message.action === 'cancel') for (const id of message.ids) profileUI.transfers.engine.queue.cancel(id);
          else if (message.action==='retry') await profileUI.transfers.retry(message.ids);
          else if (message.action==='resume') await profileUI.transfers.resume(message.ids);
          else {const job=owned.find(j => j.id===message.ids[0]);if (!job?.attempt) throw new Error("No owned partial file available.");if (await vscode.window.showWarningMessage("Clean up your partial file?",{modal:true,detail:job.attempt.part},"Delete partial file")==="Delete partial file") {profileUI.guard();await profileUI.transfers.cleanup(job.id);}}
        }
        else if (message.type === 'selectUpload') {
          profileUI.transfers.engine.assertManual(profile?.id);
          const owner=profile,destination=remote.state.path;
          const uris=await vscode.window.showOpenDialog({defaultUri:vscode.Uri.file(localStart()),canSelectFiles:true,canSelectFolders:true,canSelectMany:true,title:profile ? "Upload files/folders":"Copy files/folders …"});
          if (profile!==owner || remote.state.path!==destination) throw new Error('Transfer destination changed.');
          if (uris?.length && alive) {if (!profile) await profileUI.transfers.engine.submitLocal('upload',uris.map(localFileUri),remote.state.path);else await profileUI.transfers.engine.submit(profile.id,'upload',uris.map(localFileUri),remote.state.path);}
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
  return {open,diagnostics:value => {profileUI.guard();diagnostics=value===true;for (const v of views) v.publish();},navigate:async (sessionId,side,path) => {const view=[...views].find(v => v.model().sessionId===sessionId);if (!view) throw new Error("Session closed.");return view.navigate(side,path);},status:() => ({handshakes,views:[...views].map(v => {const m=v.model();return {sessionId:m.sessionId,mode:m.mode,renderProof:v.renderProof,connection:m.connection,local:{path:m.local.path,status:m.local.status,count:m.local.entries.length},remote:{path:m.remote.path,status:m.remote.status,count:m.remote.entries.length}};})})};
}
