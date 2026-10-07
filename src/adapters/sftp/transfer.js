import { createReadStream, createWriteStream } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline, finished } from 'node:stream/promises';

export const TRANSFER_BUFFER_BYTES = 64 * 1024;

/** One-shot transfer on a verified connectSsh session; always closes that session.
 * Destinations must be new files (exclusive creation). Interrupted partial files
 * remain for inspection; overwrite, atomic publication and resume belong to M3.
 * onProgress counts bytes passing through the pipeline, not durable remote writes.
 */
export async function transferSftp(session, { direction, localPath, remotePath, signal, onProgress } = {}) {
  let sftp;
  let source;
  let target;
  let meter;
  let removeChannelError;
  const completions = [];
  const controller = new AbortController();
  const closeOnAbort = () => { void session.close(); };
  controller.signal.addEventListener('abort', closeOnAbort, { once: true });
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  // Also interrupt a stalled stream on transport loss.
  session.closed.then(abort);
  try {
    if (!['upload', 'download'].includes(direction)
      || typeof localPath !== 'string' || !isAbsolute(localPath) || localPath.includes('\0')
      || typeof remotePath !== 'string' || !remotePath.startsWith('/') || remotePath.includes('\0')
      || (onProgress !== undefined && typeof onProgress !== 'function')) {
      throw new TypeError('SFTP-Transfer benötigt Richtung und absolute lokale/entfernte Dateipfade.');
    }
    controller.signal.throwIfAborted();
    sftp = await new Promise((resolve, reject) => {
      const interrupted = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', interrupted, { once: true });
      try {
        session.sftp((error, channel) => {
          controller.signal.removeEventListener('abort', interrupted);
          if (error) reject(error);
          else if (controller.signal.aborted) { channel.end(); reject(controller.signal.reason); }
          else resolve(channel);
        });
      } catch (error) {
        controller.signal.removeEventListener('abort', interrupted);
        reject(error);
      }
    });
    const channelError = () => controller.abort();
    sftp.on('error', channelError);
    removeChannelError = () => sftp.removeListener('error', channelError);
    controller.signal.throwIfAborted();
    const track = (stream, local = false) => {
      // Install error observers before opening the next stream. Local close
      // is awaited separately because finished() may reject before fd cleanup.
      completions.push(finished(stream, { cleanup: true }).catch(() => {}));
      if (local) completions.push(new Promise(resolve => stream.once('close', resolve)));
      return stream;
    };
    const readOptions = { highWaterMark: TRANSFER_BUFFER_BYTES, autoClose: true };
    const writeOptions = { ...readOptions, flags: 'wx', mode: 0o600 };
    source = track(direction === 'upload' ? createReadStream(localPath, readOptions) : sftp.createReadStream(remotePath, readOptions), direction === 'upload');
    target = track(direction === 'upload' ? sftp.createWriteStream(remotePath, writeOptions) : createWriteStream(localPath, writeOptions), direction === 'download');
    const hash = createHash('sha256');
    let bytes = 0;
    meter = track(new Transform({ highWaterMark: TRANSFER_BUFFER_BYTES,
      transform(chunk, encoding, callback) {
        try {
          hash.update(chunk);
          bytes += chunk.length;
          onProgress?.({ bytes, chunkBytes: chunk.length });
          callback(null, chunk);
        } catch (error) { callback(error); }
      },
    }));
    await pipeline(source, meter, target, { signal: controller.signal });
    return { bytes, sha256: hash.digest('hex') };
  } finally {
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', closeOnAbort);
    source?.destroy();
    meter?.destroy();
    target?.destroy();
    // On abort, close the transport too: a nonresponsive server must not keep
    // the remote CLOSE request (and thus pipeline destruction) pending forever.
    const closing = session.close();
    await Promise.all([...completions, closing]);
    sftp?.end();
    removeChannelError?.();
  }
}
