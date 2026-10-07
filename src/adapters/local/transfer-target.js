import { lstat,link,unlink,rename,open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';import { dirname,join,basename,extname } from 'node:path';import { createHash } from 'node:crypto';
import { localPath } from './files.js';
export const localTarget={
  atomicReplace:true,
  alternative:(path,index) => {const extension=extname(path),name=basename(path,extension);return join(dirname(path),`${name} (${index})${extension}`);},
  partial:(path,id) => join(dirname(localPath(path)),`.xscp-${id}.part`),
  async stat(path) {const s=await lstat(localPath(path));return {kind:s.isSymbolicLink() ? 'symlink':s.isFile() ? 'file':s.isDirectory() ? 'directory':'other',size:s.size,modified:s.mtimeMs,mode:s.mode,ino:s.ino,dev:s.dev};},
  async hash(path,signal) {const hash=createHash('sha256');for await (const chunk of createReadStream(localPath(path),{highWaterMark:65536,signal})) hash.update(chunk);return hash.digest('hex');},
  async prepare(part,metadata) {const handle=await open(part,'r+');try {if (metadata) {await handle.chmod(metadata.mode & 0o777);await handle.utimes(metadata.modified/1000,metadata.modified/1000);}await handle.sync();} finally {await handle.close();}},
  async publish(part,path,replace) {
    if (replace) await rename(part,path);else {await link(part,path);await unlink(part).catch(() => {});}
  },
};
