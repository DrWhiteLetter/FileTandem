import { browserSettings } from '../shared/browser-settings.js';
import * as vscode from 'vscode';
import { randomUUID,randomBytes } from 'node:crypto';
import { planRemoteDelete,executeRemoteDelete } from '../application/remote-delete.js';
import { trashLocal } from './local-operations.js';
import { hasDesktopAccess } from '../application/access-policy.js';
import { executionLocation } from './local-proof.js';
import { createFolder,renameEntry } from '../application/file-operations.js';
import { fileName } from '../domain/file-name.js';
import { posix,join } from 'node:path';
import { openRemoteFiles } from '../application/remote-files.js';
import { LocalFiles,localFileUri,localPath,localParent,localStart } from '../adapters/local/files.js';
import { DirectoryBrowser } from '../application/directory-browser.js';
import { browserViewState } from '../shared/browser-view-state.js';
import { browserRequest } from '../shared/browser-messages.js';
export function registerBrowser(context,profileUI) {
  const files=new LocalFiles();let handshakes=0,diagnostics=false;const views=new Set();
  const open=(profile,restored={},panel) => {
    profileUI.guard();if (profile) profileUI.transfers.remember(profile);restored=browserViewState(restored);
    const sessionId=randomUUID();const assets=vscode.Uri.joinPath(context.extensionUri,'dist');
    panel ??= vscode.window.createWebviewPanel('xscp.browser','xScp',vscode.ViewColumn.One,{});
    panel.webview.options={enableScripts:true,localResourceRoots:[assets]};
    let alive=true;const recent=new Set();
    const model=() => ({version:1,type:'browserModel',sessionId,diagnostics,profileId:profile?.ephemeral ? undefined:profile?.id,queue:profileUI.transfers.engine.queue.list(profile?.id),queuePaused:profileUI.transfers.engine.queue.paused,local:local.state,remote:remote.state,...browserSettings(key => vscode.workspace.getConfiguration('xscp').get(key)),connection:profile ? {...profileUI.sessions.snapshot(profile.id),name:profile.name} : {state:'disconnected',name:'Kein Server'}});
    const publish=() => {if (alive) {panel.title=profile ? `xScp · ${profile.name}`:'xScp';void panel.webview.postMessage(model());}};
    let start;try {start=localStart(restored.paths?.local ?? profile?.localPath);} catch {start=localStart();}
    const local=new DirectoryBrowser({start,parent:localParent,list:path => files.list(vscode.Uri.file(localPath(path))),onChange:publish});
    let remoteFiles,remoteTransport,opening;
    const service=async () => {
      if (!profile) throw Object.assign(new Error('Nicht verbunden.'),{code:'NOT_CONNECTED'});
      if (!profileUI.sessions.matches(profile)) throw new Error('Profil wurde geändert; bitte erneut verbinden.');
      const transport=profileUI.sessions.transport(profile.id);
      if (transport !== remoteTransport) {
        if (opening?.transport === transport) return opening.promise;
        remoteFiles?.close();const pending=openRemoteFiles(transport,profile.protocol);opening={transport,promise:pending};
        const result=await pending;
        if (!alive || opening?.promise !== pending || profileUI.sessions.transport(profile.id) !== transport) {result.close();throw new Error('Verbindung wurde ersetzt.');}
        remoteFiles=result;remoteTransport=transport;
      }
      return remoteFiles;
    };
    const remote=new DirectoryBrowser({start:restored.paths.remote ?? profile?.remotePath ?? '/',parent:path => posix.dirname(path),list:async path => (await service()).list(path),onChange:publish});
    remote.state.status='disconnected';
    const view={model,panel,publish,navigate:async (side,path) => {profileUI.guard();if (!alive || !['local','remote'].includes(side)) throw new Error('Sitzung geschlossen.');await (side==='local' ? local:remote).navigate(path);}};views.add(view);
    const changes=profileUI.changed.event(() => {
      if (!alive) return;
      if (profile && !profile.ephemeral) {try {profile=profileUI.profiles.get(profile.id);} catch { /* deleted profile keeps disconnected view */ }}
      if (profileUI.sessions.snapshot(profile?.id).state !== 'connected') remote.invalidate();
      else if (remote.state.status === 'disconnected') void remote.refresh();
      publish();
    });
    const observedTerminal=new Set();
    const configuration=vscode.workspace.onDidChangeConfiguration(e => {if (e.affectsConfiguration('xscp')) publish();});
    const transferChanges=profileUI.transfers.changed.event(() => {
      publish();
      const newly=profileUI.transfers.engine.queue.list(profile?.id).filter(j => ['completed','failed','cancelled','skipped'].includes(j.state) && !observedTerminal.has(j.id));for (const job of newly) observedTerminal.add(job.id);
      if (newly.length && local.state.status !== 'loading') {void local.refresh();if (profileUI.sessions.snapshot(profile?.id).state === 'connected') void remote.refresh();}
    });
    const transfer=async message => {
      if (!profile || profileUI.sessions.snapshot(profile.id).state !== 'connected') throw new Error('Bitte ein Profil verbinden.');
      const browser=message.side === 'local' ? local:remote;
      if (browser.state.status !== 'ready') throw new Error('Bitte den Quellordner laden.');
      const selected=message.ids.map(id => browser.state.entries.find(e => e.id === id));if (!selected.length || selected.some(e => !e)) throw new Error('Auswahl ist veraltet.');
      let destination=message.side === 'local' ? remote.state.path:local.state.path;if (message.destinationPath && message.destinationPath!==destination) throw new Error('Transferziel wurde gewechselt; bitte erneut auswählen.');
      if (message.destination === 'choose') {const folders=await vscode.window.showOpenDialog({title:'Download nach',canSelectFolders:true,canSelectFiles:false,canSelectMany:false});if (!folders?.length) return;destination=localFileUri(folders[0]);}
      profileUI.guard();if (!alive) return;if (message.destination==='opposite' && destination!==(message.side==='local' ? remote.state.path:local.state.path)) throw new Error('Transferziel wurde gewechselt.');
      await profileUI.transfers.engine.submit(profile.id,message.side === 'local' ? 'upload':'download',selected.map(e => e.path),destination);
    };
    let busy=false;
    const action=async message => {
      if (busy) throw new Error('Eine Dateiaktion läuft bereits.'); busy=true;
      try {
        const browser=message.side === 'local' ? local:remote;
        if (browser.state.status !== 'ready') throw new Error('Bitte erst einen Ordner laden.');
        const selected=message.ids.map(id => browser.state.entries.find(entry => entry.id === id));
        if (selected.some(entry => !entry)) throw new Error('Auswahl ist veraltet; bitte aktualisieren.');
        if (message.action==='open') {if (selected.length!==1 || selected[0].kind!=='file') throw new Error('Bitte eine reguläre Datei auswählen.');if (message.side==='local') await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(selected[0].path)));else await profileUI.editor.show(profile,selected[0].path,() => transfer({side:'remote',ids:message.ids,destination:'choose'}));return;}
        const parent=browser.state.path;const windows=message.side === 'local' && process.platform === 'win32';
        const options={windows,join:message.side === 'local' ? join:posix.join};
        const adapter=message.side === 'local' ? {
          stat:path => files.stat(vscode.Uri.file(localPath(path))),
          mkdir:path => files.mkdir(path),
          chmod:(path,mode) => files.chmod(path,mode),
          rename:(source,target) => vscode.workspace.fs.rename(vscode.Uri.file(localPath(source)),vscode.Uri.file(localPath(target)),{overwrite:false}),
        } : await service();
        if (['delete','properties','chmod'].includes(message.action)) {
          if (!selected.length || (message.action !== 'delete' && selected.length !== 1)) throw new Error('Bitte passende Einträge auswählen.');
          const allowed=() => alive && browser.state.path === parent && hasDesktopAccess(executionLocation(context),vscode.workspace.isTrusted);
          if (message.action === 'properties') {
            const info=await adapter.stat(selected[0].path);
            await vscode.window.showInformationMessage(`Eigenschaften: ${info.name}`,{modal:true,detail:`Pfad: ${info.path}\nTyp: ${info.kind}\nGröße: ${info.size} Bytes\nGeändert: ${new Date(info.modified).toLocaleString()}\nRechte: ${info.mode.toString(8).padStart(3,'0')}${info.kind === 'symlink' ? `\nLinkziel: ${info.linkTarget}`:''}`},'Schließen');return;
          }
          if (message.action === 'chmod') {
            if (selected[0].kind === 'symlink') throw new Error('Symlink-Rechte werden nicht geändert.');
            const mode=await vscode.window.showInputBox({title:`xScp: Rechte für ${selected[0].name} (oktal, z. B. 644)`,value:selected[0].mode.toString(8).padStart(3,'0'),validateInput:value => /^[0-7]{3}$/.test(value) ? undefined:'Drei Oktalziffern 000–777 eingeben.'});
            if (mode === undefined) return;if (!allowed()) throw new Error('Freigabe ungültig.');if (!/^[0-7]{3}$/.test(mode)) throw new Error('Ungültige Rechte.');await adapter.chmod(selected[0].path,parseInt(mode,8));
          } else {
            const plan=message.side === 'remote' ? await planRemoteDelete(adapter,selected.map(e => e.path)) : undefined;
            const choice=message.side === 'remote' ? 'Endgültig löschen':'In Papierkorb verschieben';
            const count=plan?.length ?? selected.length;
            const confirmed=await vscode.window.showWarningMessage(message.side === 'remote' ? `Remote: ${count} Einträge endgültig löschen?`:`Lokal: ${count} ausgewählte Einträge in den Papierkorb verschieben?`,{modal:true,detail:`Ordner: ${parent}\n${selected.slice(0,10).map(e => e.name).join('\n')}${selected.length > 10 ? '\n…':''}\n${message.side === 'remote' ? 'Unterordner eingeschlossen; Symlink-Ziele werden nicht gelöscht.':'Unterordner eingeschlossen. Bei Papierkorbfehler wird nicht endgültig gelöscht.'}`},choice);
            if (confirmed !== choice) return;if (!allowed()) throw new Error('Freigabe ungültig.');
            try {if (plan) await executeRemoteDelete(adapter,plan,allowed);else await trashLocal(selected.map(e => e.path),allowed);}
            finally {if (alive) await browser.refresh();}
          }
          await browser.refresh();return;
        }
        if (message.action === 'rename'  && selected.length !== 1) throw new Error('Bitte genau einen Eintrag zum Umbenennen auswählen.');
        const name=await vscode.window.showInputBox({title:message.action === 'mkdir' ? 'xScp: Neuen Ordner anlegen':'xScp: Eintrag umbenennen',value:message.action === 'rename' ? selected[0].name:'',ignoreFocusOut:true,validateInput:value => {try {fileName(value,windows);return undefined;} catch(error) {return error.message;}}});
        if (name === undefined) return;
        profileUI.guard();if (!alive || browser.state.path !== parent) throw new Error('Ordner wurde während des Dialogs gewechselt.');
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
        if (message.type === 'ready') {handshakes++;await Promise.all([local.refresh(),...(profile && profileUI.sessions.snapshot(profile.id).state === 'connected' ? [remote.refresh()] : [])]);publish();}
        else if (message.type === 'connect') {
          const chosen=await profileUI.choose();if (chosen && alive) {await profileUI.connect(chosen);if (!alive) return;profile=chosen;remoteFiles?.close();remoteTransport=undefined;opening=undefined;remote.history=[chosen.remotePath];remote.index=0;await remote.navigate(chosen.remotePath,{history:false});}
        } else if (message.type==='renderProof') {view.renderProof={rows:message.rows,height:message.height,rowHeight:message.rowHeight,scrollHeight:message.scrollHeight,theme:message.theme,focusColor:message.focusColor};}
        else if (message.type === 'newSession') {open(profile);}
        else if (message.type === 'disconnect') {if (profile) await profileUI.disconnect(profile);}
        else if (message.type === 'reconnect') {if (profile) {await profileUI.connect(profile);remoteFiles?.close();remoteTransport=undefined;opening=undefined;await remote.refresh();}}
        else if (message.type === 'queuePause') profileUI.transfers.engine.queue.pause(message.paused);
        else if (message.type === 'queueAction') {
          const owned=profileUI.transfers.engine.queue.list(profile?.id);if (message.ids.some(id => !owned.some(j => j.id === id))) throw new Error('Fremder Queue-Auftrag.');
          if (message.action === 'cancel') for (const id of message.ids) profileUI.transfers.engine.queue.cancel(id);
          else if (message.action==='retry') await profileUI.transfers.retry(message.ids);
          else if (message.action==='resume') await profileUI.transfers.resume(message.ids);
          else {const job=owned.find(j => j.id===message.ids[0]);if (!job?.attempt) throw new Error('Keine eigene Teil-Datei verfügbar.');if (await vscode.window.showWarningMessage('Eigene Teil-Datei bereinigen?',{modal:true,detail:job.attempt.part},'Teil-Datei löschen')==='Teil-Datei löschen') {profileUI.guard();await profileUI.transfers.cleanup(job.id);}}
        }
        else if (message.type === 'selectUpload') {
          if (!profile) throw new Error('Bitte ein Profil verbinden.');
          const uris=await vscode.window.showOpenDialog({defaultUri:vscode.Uri.file(localStart()),canSelectFiles:true,canSelectFolders:true,canSelectMany:true,title:'Dateien/Ordner hochladen'});
          if (uris?.length && alive) await profileUI.transfers.engine.submit(profile.id,'upload',uris.map(localFileUri),remote.state.path);
        }
        else if (message.type === 'transfer') await transfer(message);
        else if (message.type === 'action') await action(message);
        else if (message.type === 'navigate') await browser.navigate(message.path);
        else if (message.type === 'refresh') await browser.refresh();
        else if (message.type === 'history') await browser[message.direction]();
      } catch(error) {if (alive) void vscode.window.showErrorMessage(error.code === 'EEXIST' || error.code === 'FileExists' ? 'xScp: Ziel existiert bereits; nichts überschrieben.':`xScp: ${error.message}`);}
    });
    panel.onDidDispose(() => {alive=false;views.delete(view);changes.dispose();configuration.dispose();transferChanges.dispose();receive.dispose();local.invalidate();remote.invalidate();remoteFiles?.close();});
    const script=panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.js'));const style=panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.css'));const nonce=randomBytes(24).toString('base64');
    panel.webview.html=`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="xscp-session" content="${sessionId}"><meta name="xscp-mode" content="browser"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; font-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    context.subscriptions.push(panel);return panel;
  };
  profileUI.open=profile => open(profile);
  profileUI.command('xscp.openManager',() => open());
  profileUI.command('xscp.newSession',async id => {const p=typeof id==='string' ? profileUI.profiles.get(id):await profileUI.choose();if (!p) return;if (profileUI.sessions.snapshot(p.id).state!=='connected') await profileUI.connect(p);return open(p);});
  profileUI.command('xscp.showTransfers',() => open());
  profileUI.command('xscp.openProfile',async arg => {
    const id=typeof arg === 'string' ? arg:arg?.profileId;
    const profile=id ? profileUI.profiles.get(id):await profileUI.choose();if (!profile) return;
    if (profileUI.sessions.snapshot(profile.id).state !== 'connected') await profileUI.connect(profile);
    return open(profile);
  });
  profileUI.command('xscp.quickConnect',async () => {const profile=await profileUI.edit(undefined,{quick:true});if (profile) {await profileUI.connect(profile);return open(profile);}});
  profileUI.command('xscp.favoriteProfile',async arg => {const id=typeof arg === 'string' ? arg:arg?.profileId;const p=id ? profileUI.profiles.get(id):await profileUI.choose();if (p) {await profileUI.profiles.save({...p,favorite:!p.favorite});profileUI.changed.fire();}});
  profileUI.command('xscp.reconnectProfile',async arg => {const id=typeof arg === 'string' ? arg:arg?.profileId;const p=id ? profileUI.profiles.get(id):await profileUI.choose();if (p) {await profileUI.connect(p);return open(p);}});
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('xscp.browser',{async deserializeWebviewPanel(panel,state) {try {const restored=browserViewState(state);let profile;if (restored.profileId) {try {profile=profileUI.profiles.get(restored.profileId);} catch { /* removed profile */ }}open(profile,restored,panel);} catch {panel.dispose();}}}));
  return {open,diagnostics:value => {profileUI.guard();diagnostics=value===true;for (const v of views) v.publish();},navigate:async (sessionId,side,path) => {const view=[...views].find(v => v.model().sessionId===sessionId);if (!view) throw new Error('Sitzung geschlossen.');return view.navigate(side,path);},status:() => ({handshakes,views:[...views].map(v => {const m=v.model();return {sessionId:m.sessionId,renderProof:v.renderProof,connection:m.connection,local:{path:m.local.path,status:m.local.status,count:m.local.entries.length},remote:{path:m.remote.path,status:m.remote.status,count:m.remote.entries.length}};})})};
}
