import { open,realpath,unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { join,basename,relative,isAbsolute,sep } from 'node:path';
import { LocalFiles,localPath } from '../adapters/local/files.js';
import { localTarget } from '../adapters/local/transfer-target.js';
import { discoverTree } from './transfer-tree.js';
import { transferFile,targetSnapshot } from './transfer-file.js';
export const LOCAL_PROFILE_ID='local-files';
const inside=(root,path) => {const rel=relative(root,path);return !rel || rel!=='..' && !rel.startsWith('..'+sep) && !isAbsolute(rel);};
export async function localCopyPlan(paths,destination,policy) {
  if (!Array.isArray(paths) || !paths.length || paths.length>1000) throw new Error('Invalid transfer selection.');
  destination=await realpath(localPath(destination));
  if ((await localTarget.stat(destination)).kind!=='directory' || policy.excludes(destination,'directory')) throw new Error('Selected destination is excluded or is not a folder.');
  const files=new LocalFiles(),source={stat:p => files.stat({scheme:'file',fsPath:p}),listNoFollow:p => files.listNoFollow(p)},plan=[],counter={count:0};
  for (const value of paths) {
    const path=localPath(value),info=await source.stat(path),target=join(destination,basename(path));
    if (policy.excludes(path,info.kind)) throw new Error('Selected entry is excluded by FileTandem settings.');
    if (!['symlink','other'].includes(info.kind)) {
      const canonical=await realpath(path),sourceInfo=await localTarget.stat(path),existing=await targetSnapshot(localTarget,target);
      if (canonical===target || existing && sourceInfo.ino===existing.ino && sourceInfo.dev===existing.dev || info.kind==='directory' && inside(canonical,target)) throw new Error('Cannot copy an entry onto itself or into its own folder.');
    }
    for await (const node of discoverTree(source,path,'',0,counter,policy.excludes)) plan.push({...node,target:node.relative ? join(target,...node.relative.split('/')):target,root:path});
  }
  return plan;
}
/** Bounded local streaming, with the same hash and publication checks as SSH transfers. */
export async function copyLocalFile(job,{replace,signal,onProgress,beforePublish}) {
  let created;
  const part=localTarget.partial(job.target,job.id);
  const stream=async (_session,{local,remote,direction}) => {
    const source=direction==='upload' ? local:remote,destination=direction==='upload' ? remote:local;
    const reader=await open(source,constants.O_RDONLY | constants.O_NOFOLLOW);let writer;
    try {
      if (!(await reader.stat()).isFile()) throw new Error('Select a regular file.');
      signal.throwIfAborted();writer=await open(destination,'wx',0o600);created=await writer.stat();
      const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let bytes=0;
      while (true) {
        signal.throwIfAborted();const {bytesRead}=await reader.read(buffer,0,buffer.length,null);if (!bytesRead) break;
        hash.update(buffer.subarray(0,bytesRead));let offset=0;
        while (offset<bytesRead) {signal.throwIfAborted();const {bytesWritten}=await writer.write(buffer,offset,bytesRead-offset,null);if (!bytesWritten) throw new Error('Local write failed.');offset+=bytesWritten;}
        bytes+=bytesRead;onProgress?.({bytes});
      }
      await writer.sync();return {bytes,sha256:hash.digest('hex')};
    } finally {await writer?.close();await reader.close();}
  };
  try {return await transferFile(undefined,job,{target:localTarget,source:localTarget,replace,signal,onProgress,stream,beforePublish});}
  catch(error) {
    if (created) {const current=await targetSnapshot(localTarget,part).catch(()=>undefined);if (current?.ino===created.ino && current?.dev===created.dev) await unlink(part).catch(()=>{});}
    throw error;
  }
}
