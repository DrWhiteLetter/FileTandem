import {readBlocks,SFTP_REQUEST_WINDOW} from './read-blocks.js';
import { createReadStream,createWriteStream,constants } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { Readable,Writable,Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { RemoteFiles,remotePath } from './files.js';
import { localPath } from '../local/files.js';
export const BUFFER_BYTES=65536;
/** Dedicated SFTP channel on a verified backend transport. Never closes the browser transport. */
export async function streamFile(session,{direction,local,remote,signal,onProgress=() => {},offset=0,resume=false,files:borrowedFiles}) {
  if (!Number.isSafeInteger(offset) || offset<0 || (!resume && offset)) throw new Error('Ungültiger Fortsetzungsoffset.');
  local=localPath(local);remote=remotePath(remote);if (!['upload','download'].includes(direction)) throw new Error('Ungültige Transferrichtung.');
  const controller=new AbortController();const abort=() => controller.abort();signal?.addEventListener('abort',abort,{once:true});if (signal?.aborted) abort();
  let files,source,target,finished=false;
  // Borrowed channels already reject pending calls when their transport closes.
  // Do not retain a per-file closure on a long-lived pooled session.
  if(!borrowedFiles) session.closed.then(() => {if (!finished) abort();});
  const rpc=(method,...args) => new Promise((resolve,reject) => {
    controller.signal.throwIfAborted();const cancel=() => reject(controller.signal.reason);controller.signal.addEventListener('abort',cancel,{once:true});
    files.call(method,...args).then(resolve,reject).finally(() => controller.signal.removeEventListener('abort',cancel));
  });
  const stop=() => files?.close();controller.signal.addEventListener('abort',stop,{once:true});
  try {
    controller.signal.throwIfAborted();files=borrowedFiles ?? await RemoteFiles.open(session,{signal:controller.signal});controller.signal.throwIfAborted();
    const metadata=direction === 'upload' ? await lstat(local):await files.call('lstat',remote);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Nur reguläre Dateien werden gestreamt.');
    const hash=createHash('sha256');let bytes=offset;
    if (offset>metadata.size) throw new Error('Fortsetzung überschreitet die Quelle.');
    if (offset) {if (direction==='upload') {for await (const chunk of createReadStream(local,{highWaterMark:BUFFER_BYTES,end:offset-1,flags:constants.O_RDONLY | constants.O_NOFOLLOW,signal:controller.signal})) hash.update(chunk);}else {const handle=await rpc('open',remote,'r');try {for await(const chunk of readBlocks(rpc,handle,{end:offset,signal:controller.signal})) hash.update(chunk);} finally {await rpc('close',handle);}}}
    if (direction === 'upload') {
      const handle=await rpc('open',remote,resume ? 'r+':'wx',0o600);let position=offset;
      if (resume) {const info=await rpc('fstat',handle);if (!info.isFile() || info.size!==offset) throw new Error('Teil-Datei wurde geändert.');}
      source=createReadStream(local,{highWaterMark:BUFFER_BYTES,flags:constants.O_RDONLY | constants.O_NOFOLLOW,start:offset});
      const pending=new Set();let failure;
      target=new Writable({highWaterMark:BUFFER_BYTES,write(chunk,_,callback) {
        if(failure) {callback(failure);return;}
        const at=position;position+=chunk.length;
        const request=rpc('write',handle,chunk,0,chunk.length,at).catch(error=>{failure ??= error;}).finally(()=>pending.delete(request));
        pending.add(request);
        if(pending.size>=SFTP_REQUEST_WINDOW) Promise.race(pending).then(()=>callback(failure));else callback();
      },final(callback) {
        Promise.all(pending).then(()=>{if(failure) throw failure;return rpc('close',handle);}).then(()=>callback(),callback);
      }});
    } else {
      const handle=await rpc('open',remote,'r');
      source=Readable.from((async function* () {try {yield* readBlocks(rpc,handle,{start:offset,end:metadata.size,signal:controller.signal});} finally {if (!controller.signal.aborted) await rpc('close',handle);}})(),{objectMode:false,highWaterMark:BUFFER_BYTES});
      target=createWriteStream(local,{highWaterMark:BUFFER_BYTES,flags:resume ? constants.O_WRONLY | constants.O_NOFOLLOW:'wx',start:offset,mode:0o600});
    }
    const meter=new Transform({highWaterMark:BUFFER_BYTES,transform(chunk,_,callback) {try {hash.update(chunk);bytes+=chunk.length;onProgress({bytes,chunkBytes:chunk.length,resumedBytes:offset});callback(null,chunk);} catch(error) {callback(error);}}});
    await pipeline(source,meter,target,{signal:controller.signal});
    if (bytes !== metadata.size) throw new Error('Quelle wurde während des Transfers geändert.');
    const after=direction === 'upload' ? await lstat(local):await files.call('lstat',remote);
    if (after.size !== metadata.size || (direction === 'upload' ? after.mtimeMs !== metadata.mtimeMs : after.mtime !== metadata.mtime)) throw new Error('Quelle wurde während des Transfers geändert.');
    return {bytes,resumedBytes:offset,sha256:hash.digest('hex')};
  } finally {finished=true;signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',stop);source?.destroy();target?.destroy();if(!borrowedFiles || controller.signal.aborted) files?.close();}
}
