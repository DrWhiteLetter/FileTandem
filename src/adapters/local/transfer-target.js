import { lstat,link,unlink,rename,open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';import { dirname,join } from 'node:path';import { createHash } from 'node:crypto';
import { localPath } from './files.js';
export const localTarget={
  atomicReplace:true,
  partial:(path,id) => join(dirname(localPath(path)),`.xscp-${id}.part`),
  async stat(path) {const s=await lstat(localPath(path));return {kind:s.isSymbolicLink() ? 'symlink':s.isFile() ? 'file':s.isDirectory() ? 'directory':'other',size:s.size,modified:s.mtimeMs,mode:s.mode,ino:s.ino,dev:s.dev};},
  async hash(path,signal) {const hash=createHash('sha256');for await (const chunk of createReadStream(localPath(path),{highWaterMark:65536,signal})) hash.update(chunk);return hash.digest('hex');},
  async publish(part,path,replace) {
    const handle=await open(part,'r');try {await handle.sync();} finally {await handle.close();}
    if (replace) await rename(part,path);else {await link(part,path);await unlink(part).catch(() => {});}
  },
};
