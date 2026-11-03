import { posix } from 'node:path';import { createHash } from 'node:crypto';import { remotePath } from './files.js';
export function remoteTarget(files) {
  return {
    alternative:(path,index) => {const extension=posix.extname(path);return posix.join(posix.dirname(path),`${posix.basename(path,extension)} (${index})${extension}`);},
    atomicReplace:files.channel._extensions?.['posix-rename@openssh.com'] === '1',
    partial:(path,id) => posix.join(posix.dirname(remotePath(path)),`.xscp-${id}.part`),
    stat:path => files.stat(path),remove:path => files.call('unlink',remotePath(path)),
    async hash(path,signal,limit=Infinity) {const hash=createHash('sha256');const handle=await files.call('open',path,'r');try {let position=0;while (position<limit) {signal?.throwIfAborted();const chunk=Buffer.alloc(65536);const count=await files.call('read',handle,chunk,0,Math.min(chunk.length,limit-position),position);if (!count) break;hash.update(chunk.subarray(0,count));position+=count;}} finally {await files.call('close',handle);}return hash.digest('hex');},
    async prepare(part,metadata) {if (metadata) {await files.call('setstat',part,{mode:metadata.mode & 0o777,atime:metadata.modified/1000,mtime:metadata.modified/1000});}},
    publish:(part,path,replace) => replace ? files.call('ext_openssh_rename',part,path):files.rename(part,path),
  };
}
