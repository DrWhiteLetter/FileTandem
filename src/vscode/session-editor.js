import { vscode,t } from './localized-vscode.js';
import { randomUUID,createHash } from 'node:crypto';
import { posix } from 'node:path';
import { serverIdentity } from '../adapters/ssh/host-keys.js';
import { RemoteFiles } from '../adapters/sftp/files.js';
import { openEditorFile, EDITOR_LIMIT } from '../adapters/sftp/editor-file.js';

/** Authorities are opaque capabilities bound to an existing desktop transport. */
export function registerSessionEditor(context, ui) {
  const digest=data => createHash('sha256').update(data).digest('hex');let timer,polling=false,disposed=false;const reviews=new Map();const bindings=new Map();const changes=new vscode.EventEmitter();
  const resolve=uri => {
    ui.guard();const b=bindings.get(uri.authority);
    if (uri.scheme!=='filetandem' || uri.query || uri.fragment || !b || !uri.path.startsWith('/') || uri.path.includes('\0') || posix.normalize(uri.path)!==uri.path) throw vscode.FileSystemError.Unavailable("Editor session closed. Open the file again.");
    if (!ui.sessions.matches(b.profile) || ui.sessions.snapshot(b.profile.id).state!=='connected' || ui.sessions.transport(b.profile.id)!==b.transport) throw vscode.FileSystemError.Unavailable("Connection replaced or disconnected. Open the file again.");
    return b;
  };
  const translated=async action => {try {return await action();} catch(e) {if (e.code==='EEXIST') throw vscode.FileSystemError.FileExists();if (e.code==='NOT_CONNECTED') throw vscode.FileSystemError.Unavailable();if (e.code===2 || e.code==='ENOENT') throw vscode.FileSystemError.FileNotFound();if (e.code===3 || e.code==='EACCES') throw vscode.FileSystemError.NoPermissions();e.message=t(e.message);throw e;}};
  const resource=async uri => {
    const b=resolve(uri);let file=b.files.get(uri.path);
    if (!file) {if ([...bindings.values()].reduce((n,b) => n+b.files.size,0)>=32) throw vscode.FileSystemError.Unavailable("Open at most 32 editor files at once.");file=openEditorFile(b.transport,uri.path,{closeSession:false}).then(async value => {try {if (resolve(uri)!==b) throw vscode.FileSystemError.Unavailable();return value;} catch(e) {await value.close();throw e;}});b.files.set(uri.path,file);file.catch(() => {if (b.files.get(uri.path)===file) b.files.delete(uri.path);});}
    return file;
  };
  const provider={onDidChangeFile:changes.event,watch:() => new vscode.Disposable(() => {}),
    stat:uri => translated(async () => {const s=await resolve(uri).metadata.stat(uri.path);return {type:s.kind==='directory' ? vscode.FileType.Directory:s.kind==='symlink' ? vscode.FileType.SymbolicLink:vscode.FileType.File,ctime:0,mtime:s.modified,size:s.size,...(resolve(uri).grants.has(uri.path) ? {}:{permissions:vscode.FilePermission.Readonly})};}),
    readDirectory:uri => translated(async () => (await resolve(uri).metadata.list(uri.path)).entries.map(e => [e.name,e.kind==='directory' ? vscode.FileType.Directory:e.kind==='symlink' ? vscode.FileType.SymbolicLink:vscode.FileType.File])),
    readFile:uri => translated(async () => {const file=await resource(uri);const data=await file.read();const doc=vscode.workspace.textDocuments.find(d => d.uri.toString()===uri.toString());const b=resolve(uri);b.loaded.set(uri.path,data);if (!doc || (!doc.isDirty && doc.getText()===data.toString('utf8'))) {await file.rebase(data);b.observed=digest(data);}return data;}),
    writeFile:(uri,data,options) => translated(async () => {
      const b=resolve(uri);ui.transfers.engine.assertManual(b.profile.id);if (!b.grants.has(uri.path)) throw vscode.FileSystemError.NoPermissions("Explicitly enable editing first.");
      const file=await resource(uri);const allowed=() => {try {ui.transfers.engine.assertManual(b.profile.id);return resolve(uri)===b && b.grants.has(uri.path);} catch {return false;}};
      const job={server:serverIdentity(b.profile.host,b.profile.port).id,direction:'upload'};
      await ui.transfers.engine.queue.maintain(ui.transfers.engine.key(job,uri.path),async () => {if (!allowed()) throw vscode.FileSystemError.NoPermissions();try {await file.write(Buffer.from(data),allowed,options);} catch(e) {
        if (e.code==='EDITOR_CONFLICT' && !b.notice) {b.notice=true;void vscode.window.showWarningMessage("Remote file changed. Local changes remain unsaved.","Compare changes").then(async choice => {if (choice==="Compare changes") await api.diff(uri);}).catch(() => {}).finally(() => {b.notice=false;});}throw e;
      }});
      b.loaded.set(uri.path,Buffer.from(data));b.observed=digest(data);changes.fire([{type:vscode.FileChangeType.Changed,uri}]);refresh();
    }),
    createDirectory:() => {throw vscode.FileSystemError.NoPermissions();},delete:() => {throw vscode.FileSystemError.NoPermissions();},rename:() => {throw vscode.FileSystemError.NoPermissions();},
  };
  const snapshot=(source,data,kind) => {
    const uri=vscode.Uri.from({scheme:'filetandem-review',authority:randomUUID(),path:source.path});reviews.set(uri.authority,{source,data:Buffer.from(data),kind});
    while (reviews.size>24 || [...reviews.values()].reduce((n,r) => n+r.data.length,0)>64*1024*1024) reviews.delete(reviews.keys().next().value);
    return uri;
  };
  const poll=async () => {
    const uri=vscode.window.activeTextEditor?.document.uri;if (polling || disposed || uri?.scheme!=='filetandem' || !bindings.has(uri.authority)) return false;
    polling=true;try {const b=resolve(uri);const data=await (await resource(uri)).read();const value=digest(data);if (b.observed && b.observed!==value) changes.fire([{type:vscode.FileChangeType.Changed,uri}]);b.observed=value;return true;} catch {return false;} finally {polling=false;}
  };
  const schedule=() => {clearTimeout(timer);timer=undefined;const uri=vscode.window.activeTextEditor?.document.uri;if (disposed || uri?.scheme!=='filetandem' || !bindings.has(uri.authority)) return;const raw=vscode.workspace.getConfiguration('filetandem').get('editorPollInterval',5);const interval=Number.isInteger(raw) && raw>=2 && raw<=60 ? raw:5;timer=setTimeout(async () => {await poll();schedule();},interval*1000);timer.unref?.();};
  const api={
    poll,changes:changes.event,status:() => ({sessions:bindings.size,polling:!!timer || polling,snapshots:reviews.size,bytes:[...reviews.values()].reduce((n,r) => n+r.data.length,0)}),
    async diff(uri) {
      const b=resolve(uri);const file=await resource(uri);const data=await file.read();const original=file.baseline() ?? Buffer.alloc(0);
      const doc=vscode.workspace.textDocuments.find(d => d.uri.toString()===uri.toString());
      const remote=snapshot(uri,data,'remote'),local=snapshot(uri,doc ? Buffer.from(doc.getText()):original,'local'),baseline=snapshot(uri,original,'baseline');b.review=remote;
      await vscode.commands.executeCommand('vscode.diff',remote,local,`${b.profile.name}: ${uri.path} · Server ↔ Editor`);return {remote,local,baseline};
    },
    async review(uri) {
      const b=resolve(uri);const file=await resource(uri);const data=await file.read();const review=snapshot(uri,data,'remote');b.review=review;
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(review),{preview:false});return review;
    },
    async acceptReview(uri,confirm=async detail => await vscode.window.showWarningMessage("Accept the reviewed server version as the new save baseline?",{modal:true,detail},"Accept baseline")==="Accept baseline") {
      const b=resolve(uri);const review=b.review && reviews.get(b.review.authority);if (!review) throw new Error("Review the current server version first.");
      if (await confirm(`${b.profile.name}: ${uri.path}
Local unsaved changes are preserved. The next save replaces the reviewed server version.`)!==true) return false;
      resolve(uri);await (await resource(uri)).rebase(review.data);return true;
    },
    write:(uri,data,options) => provider.writeFile(uri,data,options),
    async open(profile,path,{create=false}={}) {
      ui.guard();if (profile.protocol!=='sftp') throw vscode.FileSystemError.Unavailable("SCP files require a local copy with an explicit upload.");
      const transport=ui.sessions.transport(profile.id);const metadata=await RemoteFiles.open(transport);if (bindings.size>=32) {metadata.close();throw vscode.FileSystemError.Unavailable("Open at most 32 editor files at once.");}const id=randomUUID();
      bindings.set(id,{profile,transport,metadata,files:new Map(),grants:new Set(),loaded:new Map()});const uri=vscode.Uri.from({scheme:'filetandem',authority:id,path});
      try {if (create) {const b=resolve(uri);b.files.set(uri.path,await openEditorFile(transport,path,{closeSession:false,allowCreate:true}));return uri;}const s=await provider.stat(uri);if (s.size>EDITOR_LIMIT) throw Object.assign(new Error("Editor limit: 10 MiB. Download this file."),{code:'EDITOR_LIMIT'});await resource(uri);return uri;} catch(e) {await api.close(uri);throw e;}
    },
    async show(profile,path,download,report=()=>{}) {if (profile.protocol==='scp') return ui.editorCopies.open(profile,path,download,report);let uri;try {uri=await api.open(profile,path);report('Loading file …');const document=await vscode.workspace.openTextDocument(uri);report('Opening file …');await vscode.window.showTextDocument(document);return uri;} catch(e) {if (uri) await api.close(uri);if (e.code==='EDITOR_LIMIT') {if (await vscode.window.showInformationMessage(e.message,"Download")==="Download") return download();return;}throw e;}},
    async enable(uri,confirm=async detail => await vscode.window.showWarningMessage("Enable editing of this remote file?",{modal:true,detail},"Enable editing")==="Enable editing") {
      const b=resolve(uri);if (await confirm(`${b.profile.name}: ${uri.path}
Save and Auto Save write directly to the server. Only this file in this session.`)!==true) return false;
      if (resolve(uri)!==b) return false;b.grants.add(uri.path);changes.fire([{type:vscode.FileChangeType.Changed,uri}]);refresh();return true;
    },
    lock(uri) {resolve(uri).grants.delete(uri.path);changes.fire([{type:vscode.FileChangeType.Changed,uri}]);refresh();},
    async release(uri) {const b=bindings.get(uri.authority);if (!b) return;const file=b.files.get(uri.path);b.files.delete(uri.path);b.loaded.delete(uri.path);b.grants.delete(uri.path);for (const [id,r] of reviews) if (r.source.toString()===uri.toString()) reviews.delete(id);if (file) await Promise.resolve(file).then(f => f.close()).catch(() => {});if (!b.files.size) await api.close(uri);schedule();refresh();},
    async close(uri) {const b=bindings.get(uri.authority);if (!b) return;bindings.delete(uri.authority);for (const [id,r] of reviews) if (r.source.authority===uri.authority) reviews.delete(id);b.grants.clear();b.loaded.clear();b.metadata.close();await Promise.allSettled([...b.files.values()].map(async f => (await f).close()));schedule();refresh();},
  };
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right,21);
  const refresh=() => {const uri=vscode.window.activeTextEditor?.document.uri;const b=uri?.scheme==='filetandem' && bindings.get(uri.authority);if (!b) return status.hide();status.text=b.grants.has(uri.path) ? "$(edit) FileTandem: Editing enabled":"$(lock) FileTandem: Read-only";status.tooltip=`${b.profile.name}: ${uri.path}
Auto Save writes only after explicit permission.`;status.command=b.grants.has(uri.path) ? 'filetandem.lockEditorFile':'filetandem.enableEditorEditing';status.show();};
  const active=() => {const uri=vscode.window.activeTextEditor?.document.uri;if (uri?.scheme==='filetandem-review') {const source=reviews.get(uri.authority)?.source;if (source) return source;}if (uri?.scheme==='filetandem') return uri;throw new Error("Open a FileTandem file first.");};
  ui.command('filetandem.reviewRemoteFile',() => api.review(active()));ui.command('filetandem.diffRemoteFile',() => api.diff(active()));ui.command('filetandem.acceptEditorReview',() => api.acceptReview(active()));
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('filetandem-review',{provideTextDocumentContent:uri => {const review=reviews.get(uri.authority);if (!review) throw vscode.FileSystemError.Unavailable();return review.data.toString('utf8');}}));
  ui.command('filetandem.newRemoteFile',async () => {const p=await ui.choose();if (!p) return;if (ui.sessions.snapshot(p.id).state!=='connected') await ui.connect(p);const path=await vscode.window.showInputBox({title:"New SFTP file: absolute path",value:p.remotePath+'/neu.txt'});if (!path) return;const uri=await api.open(p,path,{create:true});try {if (!await api.enable(uri)) {await api.close(uri);return;}await provider.writeFile(uri,Buffer.alloc(0),{create:true,overwrite:false});await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));return uri;} catch(e) {await api.close(uri);throw e;}});
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {const doc=event.document,b=doc.uri.scheme==='filetandem' && bindings.get(doc.uri.authority),data=b && b.loaded.get(doc.uri.path);if (data && !doc.isDirty && doc.getText()===data.toString('utf8')) void resource(doc.uri).then(file => file.rebase(data)).then(() => {b.observed=digest(data);}).catch(() => {});}),status,vscode.window.onDidChangeActiveTextEditor(() => {refresh();schedule();}),vscode.workspace.onDidChangeConfiguration(e => {if (e.affectsConfiguration('filetandem.editorPollInterval')) schedule();}),changes,vscode.workspace.registerFileSystemProvider('filetandem',provider,{isCaseSensitive:true}),vscode.workspace.onDidCloseTextDocument(doc => {if (doc.uri.scheme==='filetandem') void api.release(doc.uri).catch(() => {});else if (doc.uri.scheme==='filetandem-review') reviews.delete(doc.uri.authority);}),ui.changed.event(() => {for (const [id,b] of bindings) {if (!ui.sessions.matches(b.profile) || ui.sessions.snapshot(b.profile.id).state!=='connected') void api.close(vscode.Uri.from({scheme:'filetandem',authority:id,path:'/'}));}}),{dispose() {disposed=true;clearTimeout(timer);reviews.clear();for (const id of bindings.keys()) void api.close(vscode.Uri.from({scheme:'filetandem',authority:id,path:'/'}));}});
  return api;
}
