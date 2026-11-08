import { posix } from 'node:path';import { probeScp,statScp,collectExec } from './metadata.js';import { listScp } from './list.js';import { remotePath,shellQuote } from './protocol.js';
/** GNU/Linux POSIX-shell file service. Every mutation uses validated literal paths. */
export class ScpFiles {
 constructor(session,signal) {this.session=session;this.signal=signal;this.closed=false;this.capabilities={browse:true,mkdir:true,rename:true,delete:true,chmod:true,symlinks:true};}
 static async open(session,{signal}={}) {await probeScp(session,{signal});return new ScpFiles(session,signal);}
 check() {if (this.closed) throw Object.assign(new Error('SCP-Dateidienst geschlossen.'),{code:'NOT_CONNECTED'});this.signal?.throwIfAborted();}
 execute(command,options={}) {this.check();return collectExec(this.session,command,{signal:this.signal,...options});}
 stat(path) {this.check();return statScp(this.session,path,{signal:this.signal});}
 async list(path,{follow=true}={}) {
  this.check();path=remotePath(path,true);const values=await listScp(this.session,{path,follow,signal:this.signal,closeSession:false});
  return {path,entries:values.map(v => {const full=posix.join(path,v.name);return {id:full,path:full,name:v.name,kind:v.type==='f' ? 'file':v.type==='d' ? 'directory':v.type==='l' ? 'symlink':'other',size:v.size,modified:v.mtime*1000,mode:parseInt(v.mode,8)&0o777,linkTarget:v.linkTarget,transferable:v.transferable || v.type==='d'};})};
 }
 listNoFollow(path) {return this.list(path,{follow:false});}
 mkdir(path) {return this.execute(`umask 022; mkdir -m 755 -- ${shellQuote(remotePath(path))}`);}
 async rename(source,target) {
  source=remotePath(source);target=remotePath(target);try {await this.execute(`mv -T -n -- ${shellQuote(source)} ${shellQuote(target)} || exit $?; if test -e ${shellQuote(source)} || test -L ${shellQuote(source)}; then exit 73; fi`);} catch(error) {if (error.status===73) throw Object.assign(new Error('Ziel existiert oder Umbenennen fehlgeschlagen.'),{code:'EEXIST'});throw error;}
 }
 async chmod(path,mode) {if (!Number.isInteger(mode) || mode<0 || mode>0o777 || (await this.stat(path)).kind==='symlink') throw new Error('Ungültige oder Symlink-Rechte.');return this.execute(`chmod ${mode.toString(8)} -- ${shellQuote(remotePath(path))}`);}
 async call(method,path) {path=remotePath(path);if (!['unlink','rmdir'].includes(method)) throw new Error('Nicht freigegebene SCP-Operation.');return this.execute(`${method==='unlink' ? 'rm -f':'rmdir'} -- ${shellQuote(path)}`);}
 close() {this.closed=true;}
}
export function scpTarget(files) {
 return {
  atomicReplace:true,stat:path => files.stat(path),remove:path => files.call('unlink',path),alternative:(path,index) => {const ext=posix.extname(path);return posix.join(posix.dirname(path),`${posix.basename(path,ext)} (${index})${ext}`);},partial:(path,id) => posix.join(posix.dirname(remotePath(path)),`.filetandem-${id}.part`),
  async hash(path,signal) {const data=await files.execute(`sha256sum -- ${shellQuote(remotePath(path))}`,{signal,maxBytes:8192,timeout:300000});const match=/^([a-f0-9]{64})  /.exec(data.toString('utf8'));if (!match) throw new Error('Ungültige SHA-256-Ausgabe.');return match[1];},
  async prepare(part,metadata) {if (metadata) {await files.chmod(part,metadata.mode&0o777);if (!Number.isFinite(metadata.modified)) throw new Error('Ungültige Änderungszeit.');await files.execute(`touch -m -d ${shellQuote('@'+metadata.modified/1000)} -- ${shellQuote(remotePath(part))}`);}},
  publish:(part,path,replace) => replace ? files.execute(`mv -T -f -- ${shellQuote(remotePath(part))} ${shellQuote(remotePath(path))}`):files.execute(`ln -T -- ${shellQuote(remotePath(part))} ${shellQuote(remotePath(path))} && { rm -f -- ${shellQuote(part)} || :; }`),
 };
}
