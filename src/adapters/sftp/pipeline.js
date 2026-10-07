import { createReadStream,createWriteStream,constants } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { Readable,Writable,Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { RemoteFiles,remotePath } from './files.js';
import { localPath } from '../local/files.js';
export const BUFFER_BYTES=65536;
/** Dedicated SFTP channel on a verified backend transport. Never closes the browser transport. */
export async function streamFile(session,{direction,local,remote,signal,onProgress=() => {}}) {
  local=localPath(local);remote=remotePath(remote);if (!['upload','download'].includes(direction)) throw new Error('Ungültige Transferrichtung.');
  const controller=new AbortController();const abort=() => controller.abort();signal?.addEventListener('abort',abort,{once:true});if (signal?.aborted) abort();
  let files,source,target,finished=false;
  session.closed.then(() => {if (!finished) abort();});
  const rpc=(method,...args) => new Promise((resolve,reject) => {
    controller.signal.throwIfAborted();const cancel=() => reject(controller.signal.reason);controller.signal.addEventListener('abort',cancel,{once:true});
    files.call(method,...args).then(resolve,reject).finally(() => controller.signal.removeEventListener('abort',cancel));
  });
  const stop=() => files?.close();controller.signal.addEventListener('abort',stop,{once:true});
  try {
    controller.signal.throwIfAborted();files=await RemoteFiles.open(session);controller.signal.throwIfAborted();
    const metadata=direction === 'upload' ? await lstat(local):await files.call('lstat',remote);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Nur reguläre Dateien werden gestreamt.');
    if (direction === 'upload') {
      const handle=await rpc('open',remote,'wx',0o600);let position=0;
      source=createReadStream(local,{highWaterMark:BUFFER_BYTES,flags:constants.O_RDONLY | constants.O_NOFOLLOW});
      target=new Writable({highWaterMark:BUFFER_BYTES,write(chunk,_,callback) {
        (async () => {for (let offset=0;offset < chunk.length;offset+=BUFFER_BYTES) {const count=Math.min(BUFFER_BYTES,chunk.length-offset);await rpc('write',handle,chunk,offset,count,position);position+=count;}})().then(() => callback(),callback);
      },final(callback) {rpc('close',handle).then(() => callback(),callback);}});
    } else {
      const handle=await rpc('open',remote,'r');
      source=Readable.from((async function* () {let position=0;try {while (true) {const buffer=Buffer.alloc(BUFFER_BYTES);const count=await rpc('read',handle,buffer,0,buffer.length,position);if (!count) break;position+=count;yield buffer.subarray(0,count);}} finally {if (!controller.signal.aborted) await rpc('close',handle);}})(),{objectMode:false,highWaterMark:BUFFER_BYTES});
      target=createWriteStream(local,{highWaterMark:BUFFER_BYTES,flags:'wx',mode:0o600});
    }
    const hash=createHash('sha256');let bytes=0;
    const meter=new Transform({highWaterMark:BUFFER_BYTES,transform(chunk,_,callback) {hash.update(chunk);bytes+=chunk.length;onProgress({bytes,chunkBytes:chunk.length});callback(null,chunk);}});
    await pipeline(source,meter,target,{signal:controller.signal});
    if (bytes !== metadata.size) throw new Error('Quelle wurde während des Transfers geändert.');
    const after=direction === 'upload' ? await lstat(local):await files.call('lstat',remote);
    if (after.size !== metadata.size || (direction === 'upload' ? after.mtimeMs !== metadata.mtimeMs : after.mtime !== metadata.mtime)) throw new Error('Quelle wurde während des Transfers geändert.');
    return {bytes,sha256:hash.digest('hex')};
  } finally {finished=true;signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',stop);source?.destroy();target?.destroy();files?.close();}
}
