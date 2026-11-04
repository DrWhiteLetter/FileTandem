import {readBlocks} from './read-blocks.js';
import { posix } from 'node:path';import { createHash } from 'node:crypto';import { remotePath } from './files.js';
export function remoteTarget(files) {
  return {
    alternative:(path,index) => {const extension=posix.extname(path);return posix.join(posix.dirname(path),`${posix.basename(path,extension)} (${index})${extension}`);},
    atomicReplace:files.channel._extensions?.['posix-rename@openssh.com'] === '1',
    partial:(path,id) => posix.join(posix.dirname(remotePath(path)),`.xscp-${id}.part`),
    stat:path => files.stat(path),remove:path => files.call('unlink',remotePath(path)),
    async hash(path,signal,limit=Infinity,knownSize) {
      const hash=createHash('sha256'),handle=await files.call('open',path,'r');
      try {
        const size=knownSize ?? (await files.call('fstat',handle)).size;
        for await(const chunk of readBlocks(files.call.bind(files),handle,{end:Math.min(size,limit),signal})) hash.update(chunk);
        // A full hash must also detect a file that grew after the size snapshot.
        if(limit===Infinity && await files.call('read',handle,Buffer.alloc(1),0,1,size)) throw Object.assign(new Error('SFTP file grew during verification.'),{code:'TRANSFER_INTEGRITY'});
      } finally {await files.call('close',handle);}
      return hash.digest('hex');
    },
    async prepare(part,metadata) {if (metadata) {await files.call('setstat',part,{mode:metadata.mode & 0o777,atime:metadata.modified/1000,mtime:metadata.modified/1000});}},
    publish:(part,path,replace) => replace ? files.call('ext_openssh_rename',part,path):files.rename(part,path),
  };
}
