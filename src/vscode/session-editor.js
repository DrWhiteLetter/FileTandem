import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { RemoteFiles } from '../adapters/sftp/files.js';
import { openEditorFile, EDITOR_LIMIT } from '../adapters/sftp/editor-file.js';

/** Authorities are opaque capabilities bound to an existing desktop transport. */
export function registerSessionEditor(context, ui) {
  const bindings=new Map();const changes=new vscode.EventEmitter();
  const resolve=uri => {
    ui.guard();const b=bindings.get(uri.authority);
    if (uri.scheme!=='xscp' || uri.query || uri.fragment || !b || !uri.path.startsWith('/') || uri.path.includes('\0') || posix.normalize(uri.path)!==uri.path) throw vscode.FileSystemError.Unavailable('Editor-Sitzung geschlossen. Datei erneut öffnen.');
    if (!ui.sessions.matches(b.profile) || ui.sessions.transport(b.profile.id)!==b.transport) throw vscode.FileSystemError.Unavailable('Verbindung ersetzt oder getrennt. Datei erneut öffnen.');
    return b;
  };
  const translated=async action => {try {return await action();} catch(e) {if (e.code===2 || e.code==='ENOENT') throw vscode.FileSystemError.FileNotFound();if (e.code===3 || e.code==='EACCES') throw vscode.FileSystemError.NoPermissions();throw e;}};
  const resource=async uri => {
    const b=resolve(uri);let file=b.files.get(uri.path);
    if (!file) {file=await openEditorFile(b.transport,uri.path,{closeSession:false});if (resolve(uri)!==b) {await file.close();throw vscode.FileSystemError.Unavailable();}b.files.set(uri.path,file);}
    return file;
  };
  const provider={onDidChangeFile:changes.event,watch:() => new vscode.Disposable(() => {}),
    stat:uri => translated(async () => {const s=await resolve(uri).metadata.stat(uri.path);return {type:s.kind==='directory' ? vscode.FileType.Directory:s.kind==='symlink' ? vscode.FileType.SymbolicLink:vscode.FileType.File,ctime:0,mtime:s.modified,size:s.size,permissions:vscode.FilePermission.Readonly};}),
    readDirectory:uri => translated(async () => (await resolve(uri).metadata.list(uri.path)).entries.map(e => [e.name,e.kind==='directory' ? vscode.FileType.Directory:e.kind==='symlink' ? vscode.FileType.SymbolicLink:vscode.FileType.File])),
    readFile:uri => translated(async () => (await resource(uri)).read()),
    writeFile:() => {throw vscode.FileSystemError.NoPermissions('Bearbeitung zuerst ausdrücklich freigeben.');},
    createDirectory:() => {throw vscode.FileSystemError.NoPermissions();},delete:() => {throw vscode.FileSystemError.NoPermissions();},rename:() => {throw vscode.FileSystemError.NoPermissions();},
  };
  const api={
    async open(profile,path) {
      ui.guard();if (profile.protocol!=='sftp') throw vscode.FileSystemError.Unavailable('SCP-Dateien benötigen eine lokale Kopie mit ausdrücklichem Upload.');
      const transport=ui.sessions.transport(profile.id);const metadata=await RemoteFiles.open(transport);const id=randomUUID();
      bindings.set(id,{profile,transport,metadata,files:new Map()});const uri=vscode.Uri.from({scheme:'xscp',authority:id,path});
      try {const s=await provider.stat(uri);if (s.size>EDITOR_LIMIT) throw Object.assign(new Error('Editor-Limit: 10 MiB. Datei herunterladen.'),{code:'EDITOR_LIMIT'});await resource(uri);return uri;} catch(e) {await api.close(uri);throw e;}
    },
    async show(profile,path,download) {let uri;try {uri=await api.open(profile,path);await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));} catch(e) {if (uri) await api.close(uri);if (e.code==='EDITOR_LIMIT' && await vscode.window.showInformationMessage(e.message,'Herunterladen')==='Herunterladen') return download();throw e;}},
    async close(uri) {const b=bindings.get(uri.authority);if (!b) return;bindings.delete(uri.authority);b.metadata.close();await Promise.allSettled([...b.files.values()].map(f => f.close()));},
  };
  context.subscriptions.push(changes,vscode.workspace.registerFileSystemProvider('xscp',provider,{isCaseSensitive:true}),vscode.workspace.onDidCloseTextDocument(doc => {if (doc.uri.scheme==='xscp') void api.close(doc.uri);}),ui.changed.event(() => {for (const [id,b] of bindings) {if (!ui.sessions.matches(b.profile) || ui.sessions.snapshot(b.profile.id).state!=='connected') void api.close(vscode.Uri.from({scheme:'xscp',authority:id,path:'/'}));}}),{dispose() {for (const id of bindings.keys()) void api.close(vscode.Uri.from({scheme:'xscp',authority:id,path:'/'}));}});
  return api;
}
