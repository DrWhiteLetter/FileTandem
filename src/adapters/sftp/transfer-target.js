import { posix } from 'node:path';import { createHash } from 'node:crypto';import { remotePath } from './files.js';
export function remoteTarget(files) {
  return {
    alternative:(path,index) => {const extension=posix.extname(path);return posix.join(posix.dirname(path),`${posix.basename(path,extension)} (${index})${extension}`);},
    atomicReplace:files.channel._extensions?.['posix-rename@openssh.com'] === '1',
    partial:(path,id) => posix.join(posix.dirname(remotePath(path)),`.xscp-${id}.part`),
    stat:path => files.stat(path),
    async hash(path,signal) {const hash=createHash('sha256');const handle=await files.call('open',path,'r');try {let position=0;while (true) {signal?.throwIfAborted();const chunk=Buffer.alloc(65536);const count=await files.call('read',handle,chunk,0,chunk.length,position);if (!count) break;hash.update(chunk.subarray(0,count));position+=count;}} finally {await files.call('close',handle);}return hash.digest('hex');},
    async prepare(part,metadata) {if (metadata) {await files.call('chmod',part,metadata.mode & 0o777);await files.call('utimes',part,metadata.modified/1000,metadata.modified/1000);}},
    publish:(part,path,replace) => replace ? files.call('ext_openssh_rename',part,path):files.rename(part,path),
  };
}
