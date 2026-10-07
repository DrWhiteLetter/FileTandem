import { withExec } from './exec.js';import { ScpError,remotePath,shellQuote } from './protocol.js';
const probes=new WeakMap();
export async function collectExec(session,command,{signal,maxBytes=32*1024*1024,timeout=30000}={}) {
 return withExec(session,command,async channel => {channel.end();const chunks=[];let bytes=0;for await (const chunk of channel) {bytes+=chunk.length;if (bytes>maxBytes) throw new ScpError('SCP_OUTPUT_LIMIT','Shell-Ausgabe überschreitet die sichere Grenze.');chunks.push(chunk);}return Buffer.concat(chunks);},{signal,timeout,closeSession:false});
}
export async function probeScp(session,{signal}={}) {
 if (!probes.has(session)) {
  const promise=collectExec(session,"export LC_ALL=C; command -v scp >/dev/null || exit 126; for tool in find stat mv ln chmod touch rm rmdir mkdir sha256sum; do \"$tool\" --version 2>/dev/null | grep -q GNU || exit 126; done; printf ready",{signal,maxBytes:1024}).then(data => {if (data.toString() !== 'ready') throw new Error();return {browse:true,mkdir:true,rename:true,delete:true,chmod:true,symlinks:true};}).catch(() => {probes.delete(session);signal?.throwIfAborted();throw Object.assign(new ScpError('SCP_CAPABILITIES','SCP benötigt eine POSIX-Shell, scp sowie GNU find/coreutils (stat, mv, ln, chmod, touch, rm, rmdir, mkdir, sha256sum).'),{publicMessage:'SCP benötigt eine POSIX-Shell, scp und GNU find/coreutils; bitte SFTP verwenden oder die Serverwerkzeuge ergänzen.'});});probes.set(session,promise);
 }return probes.get(session);
}
export async function statScp(session,path,{signal}={}) {
 path=remotePath(path,true);
 try {
 const data=await collectExec(session,`export LC_ALL=C; if ! test -e ${shellQuote(path)} && ! test -L ${shellQuote(path)}; then exit 44; fi; stat --printf='%F\\0%s\\0%Y\\0%a\\0%i\\0%d\\0' -- ${shellQuote(path)}`,{signal,maxBytes:8192});
 const fields=new TextDecoder('utf-8',{fatal:true}).decode(data).split('\0');if (fields.length!==7 || fields[6]!=='' || !/^\d+$/.test(fields[1]) || !Number.isSafeInteger(Number(fields[1])) || !/^-?\d+$/.test(fields[2]) || !/^[0-7]{1,4}$/.test(fields[3]) || !fields.slice(4,6).every(v => /^\d+$/.test(v))) throw new ScpError('INVALID_STAT','Ungültige GNU-stat-Ausgabe.');
 const kind=fields[0]==='directory' ? 'directory':fields[0]==='symbolic link' ? 'symlink':fields[0].startsWith('regular') ? 'file':'other';return {id:path,path,name:path.split('/').at(-1),kind,size:Number(fields[1]),modified:Number(fields[2])*1000,mode:parseInt(fields[3],8)&0o777,ino:fields[4],dev:fields[5],linkTarget:''};
 } catch(error) {if (error.status===44) throw Object.assign(new Error('Eintrag existiert nicht.'),{code:'ENOENT'});throw error;}
}
