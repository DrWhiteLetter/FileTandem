import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { serverIdentity } from '../adapters/ssh/host-keys.js';
import { RemoteFiles } from '../adapters/sftp/files.js';
import { openEditorFile, EDITOR_LIMIT } from '../adapters/sftp/editor-file.js';

/** Authorities are opaque capabilities bound to an existing desktop transport. */
export function registerSessionEditor(context, ui) {
  const bindings=new Map();const changes=new vscode.EventEmitter();
  const resolve=uri => {
    ui.guard();const b=bindings.get(uri.authority);
    if (uri.scheme!=='xscp' || uri.query || uri.fragment || !b || !uri.path.startsWith('/') || uri.path.includes('\0') || posix.normalize(uri.path)!==uri.path) throw vscode.FileSystemError.Unavailable('Editor-Sitzung geschlossen. Datei erneut öffnen.');
    if (!ui.sessions.matches(b.profile) || ui.sessions.snapshot(b.profile.id).state!=='connected' || ui.sessions.transport(b.profile.id)!==b.transport) throw vscode.FileSystemError.Unavailable('Verbindung ersetzt oder getrennt. Datei erneut öffnen.');
    return b;
  };
  const translated=async action => {try {return await action();} catch(e) {if (e.code==='EEXIST') throw vscode.FileSystemError.FileExists();if (e.code==='NOT_CONNECTED') throw vscode.FileSystemError.Unavailable();if (e.code===2 || e.code==='ENOENT') throw vscode.FileSystemError.FileNotFound();if (e.code===3 || e.code==='EACCES') throw vscode.FileSystemError.NoPermissions();throw e;}};
  const resource=async uri => {
    const b=resolve(uri);let file=b.files.get(uri.path);
    if (!file) {file=openEditorFile(b.transport,uri.path,{closeSession:false}).then(async value => {try {if (resolve(uri)!==b) throw vscode.FileSystemError.Unavailable();return value;} catch(e) {await value.close();throw e;}});b.files.set(uri.path,file);file.catch(() => {if (b.files.get(uri.path)===file) b.files.delete(uri.path);});}
    return file;
  };
  const provider={onDidChangeFile:changes.event,watch:() => new vscode.Disposable(() => {}),
    stat:uri => translated(async () => {const s=await resolve(uri).metadata.stat(uri.path);return {type:s.kind==='directory' ? vscode.FileType.Directory:s.kind==='symlink' ? vscode.FileType.SymbolicLink:vscode.FileType.File,ctime:0,mtime:s.modified,size:s.size,...(resolve(uri).grants.has(uri.path) ? {}:{permissions:vscode.FilePermission.Readonly})};}),
    readDirectory:uri => translated(async () => (await resolve(uri).metadata.list(uri.path)).entries.map(e => [e.name,e.kind==='directory' ? vscode.FileType.Directory:e.kind==='symlink' ? vscode.FileType.SymbolicLink:vscode.FileType.File])),
    readFile:uri => translated(async () => (await resource(uri)).read()),
    writeFile:(uri,data,options) => translated(async () => {
      const b=resolve(uri);if (!b.grants.has(uri.path)) throw vscode.FileSystemError.NoPermissions('Bearbeitung zuerst ausdrücklich freigeben.');
      const file=await resource(uri);const allowed=() => {try {return resolve(uri)===b && b.grants.has(uri.path);} catch {return false;}};
      const job={server:serverIdentity(b.profile.host,b.profile.port).id,direction:'upload'};
      await ui.transfers.engine.queue.maintain(ui.transfers.engine.key(job,uri.path),async () => {if (!allowed()) throw vscode.FileSystemError.NoPermissions();await file.write(Buffer.from(data),allowed,options);});
      changes.fire([{type:vscode.FileChangeType.Changed,uri}]);refresh();
    }),
    createDirectory:() => {throw vscode.FileSystemError.NoPermissions();},delete:() => {throw vscode.FileSystemError.NoPermissions();},rename:() => {throw vscode.FileSystemError.NoPermissions();},
  };
  const api={
    write:(uri,data,options) => provider.writeFile(uri,data,options),
    async open(profile,path,{create=false}={}) {
      ui.guard();if (profile.protocol!=='sftp') throw vscode.FileSystemError.Unavailable('SCP-Dateien benötigen eine lokale Kopie mit ausdrücklichem Upload.');
      const transport=ui.sessions.transport(profile.id);const metadata=await RemoteFiles.open(transport);const id=randomUUID();
      bindings.set(id,{profile,transport,metadata,files:new Map(),grants:new Set()});const uri=vscode.Uri.from({scheme:'xscp',authority:id,path});
      try {if (create) {const b=resolve(uri);b.files.set(uri.path,await openEditorFile(transport,path,{closeSession:false,allowCreate:true}));return uri;}const s=await provider.stat(uri);if (s.size>EDITOR_LIMIT) throw Object.assign(new Error('Editor-Limit: 10 MiB. Datei herunterladen.'),{code:'EDITOR_LIMIT'});await resource(uri);return uri;} catch(e) {await api.close(uri);throw e;}
    },
    async show(profile,path,download) {let uri;try {uri=await api.open(profile,path);await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));} catch(e) {if (uri) await api.close(uri);if (e.code==='EDITOR_LIMIT' && await vscode.window.showInformationMessage(e.message,'Herunterladen')==='Herunterladen') return download();throw e;}},
    async enable(uri,confirm=async detail => await vscode.window.showWarningMessage('Remote-Datei zum Bearbeiten freigeben?',{modal:true,detail},'Bearbeitung freigeben')==='Bearbeitung freigeben') {
      const b=resolve(uri);if (await confirm(`${b.profile.name}: ${uri.path}\nSpeichern und Auto Save schreiben direkt auf den Server. Nur diese Datei in dieser Sitzung.`)!==true) return false;
      if (resolve(uri)!==b) return false;b.grants.add(uri.path);changes.fire([{type:vscode.FileChangeType.Changed,uri}]);refresh();return true;
    },
    lock(uri) {resolve(uri).grants.delete(uri.path);changes.fire([{type:vscode.FileChangeType.Changed,uri}]);refresh();},
    async close(uri) {const b=bindings.get(uri.authority);if (!b) return;bindings.delete(uri.authority);b.grants.clear();b.metadata.close();await Promise.allSettled([...b.files.values()].map(async f => (await f).close()));},
  };
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right,21);
  const refresh=() => {const uri=vscode.window.activeTextEditor?.document.uri;const b=uri?.scheme==='xscp' && bindings.get(uri.authority);if (!b) return status.hide();status.text=b.grants.has(uri.path) ? '$(edit) xScp: Bearbeitung freigegeben':'$(lock) xScp: Schreibgeschützt';status.tooltip=`${b.profile.name}: ${uri.path}\nAuto Save schreibt nur nach Freigabe.`;status.command=b.grants.has(uri.path) ? 'xscp.lockEditorFile':'xscp.enableEditorEditing';status.show();};
  ui.command('xscp.newRemoteFile',async () => {const p=await ui.choose();if (!p) return;const path=await vscode.window.showInputBox({title:'Neue SFTP-Datei: absoluter Pfad',value:p.remotePath+'/neu.txt'});if (!path) return;const uri=await api.open(p,path,{create:true});try {if (!await api.enable(uri)) {await api.close(uri);return;}await provider.writeFile(uri,Buffer.alloc(0),{create:true,overwrite:false});await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));} catch(e) {await api.close(uri);throw e;}});
  context.subscriptions.push(status,vscode.window.onDidChangeActiveTextEditor(refresh),changes,vscode.workspace.registerFileSystemProvider('xscp',provider,{isCaseSensitive:true}),vscode.workspace.onDidCloseTextDocument(doc => {if (doc.uri.scheme==='xscp') void api.close(doc.uri);}),ui.changed.event(() => {for (const [id,b] of bindings) {if (!ui.sessions.matches(b.profile) || ui.sessions.snapshot(b.profile.id).state!=='connected') void api.close(vscode.Uri.from({scheme:'xscp',authority:id,path:'/'}));}}),{dispose() {for (const id of bindings.keys()) void api.close(vscode.Uri.from({scheme:'xscp',authority:id,path:'/'}));}});
  return api;
}
