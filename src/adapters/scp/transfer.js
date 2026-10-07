import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { CHUNK_BYTES, MAX_PROOF_BYTES, ScpError, ScpReader, remotePath, shellQuote, writeChannel } from './protocol.js';
import { withExec } from './exec.js';

/** Single regular file, one verified SSH session, no SFTP and no recursive SCP.
 * New destinations only. Failed transfers leave their own partial destination.
 */
export async function transferScp(session, { direction, localPath, remotePath: path, signal, onProgress, timeout, closeSession=true } = {}) {
  let file;
  try {
    remotePath(path);
    if (!['upload', 'download'].includes(direction) || typeof localPath !== 'string' || !isAbsolute(localPath)
      || localPath.includes('\0') || (onProgress !== undefined && typeof onProgress !== 'function')) throw new TypeError('Ungültige SCP-Transferoptionen.');
    signal?.throwIfAborted();
    file = await open(localPath, direction === 'upload' ? constants.O_RDONLY | constants.O_NOFOLLOW : 'wx', 0o600);
    const info = await file.stat();
    if (!info.isFile()) throw new ScpError('SCP_NOT_REGULAR', 'SCP-Prototyp unterstützt nur reguläre Dateien.');
    if (!Number.isSafeInteger(info.size) || info.size > MAX_PROOF_BYTES) throw new ScpError('INVALID_SCP_SIZE', 'SCP-Dateigröße ist keine sichere Ganzzahl.');
    const name = posix.basename(path);
    // POSIX noclobber reserves a new destination before the SCP sink can truncate
    // it. This is not atomic publication or protection against a concurrent writer.
    const command = direction === 'upload'
      ? `umask 077; set -C; : > ${shellQuote(path)} && exec scp -t -- ${shellQuote(path)}`
      : `if test ! -L ${shellQuote(path)} && test -f ${shellQuote(path)}; then exec scp -f -- ${shellQuote(path)}; else printf '\\002SCP-Quelle ist keine reguläre Datei.\\n'; exit 1; fi`;
    return await withExec(session, command, async channel => {
      const reader = new ScpReader(channel);
      const hash = createHash('sha256');
      let bytes = 0;
      const progress = chunk => {
        hash.update(chunk); bytes += chunk.length;
        onProgress?.({ bytes, chunkBytes: chunk.length }); signal?.throwIfAborted();
      };
      if (direction === 'upload') {
        await reader.ack();
        await writeChannel(channel, Buffer.from(`C0600 ${info.size} ${name}\n`));
        await reader.ack();
        const buffer = Buffer.alloc(CHUNK_BYTES);
        while (bytes < info.size) {
          signal?.throwIfAborted();
          const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, info.size - bytes), bytes);
          if (!bytesRead) throw new ScpError('SCP_SOURCE_CHANGED', 'SCP-Quelle wurde während des Transfers verkürzt.');
          const chunk = buffer.subarray(0, bytesRead);
          await writeChannel(channel, chunk); progress(chunk);
        }
        if (((await file.stat()).size !== info.size || (await file.stat()).mtimeMs !== info.mtimeMs)) throw new ScpError('SCP_SOURCE_CHANGED', 'SCP-Quellgröße wurde während des Transfers geändert.');
        await writeChannel(channel, Buffer.from([0]));
        await reader.ack();
      } else {
        await writeChannel(channel, Buffer.from([0]));
        const header = await reader.header(name);
        await writeChannel(channel, Buffer.from([0]));
        while (bytes < header.size) {
          signal?.throwIfAborted();
          const chunk = await reader.readSome(Math.min(CHUNK_BYTES, header.size - bytes));
          if (!chunk) throw new ScpError('SCP_EOF', 'SCP-Datei kürzer als angekündigt.');
          let written = 0;
          while (written < chunk.length) {
            const result = await file.write(chunk, written, chunk.length - written, bytes + written);
            if (!result.bytesWritten) throw new ScpError('SCP_LOCAL_WRITE', 'Lokaler SCP-Schreibvorgang ohne Fortschritt.');
            written += result.bytesWritten;
          }
          progress(chunk);
        }
        await reader.ack(); // Sender's exact-size completion marker.
        await writeChannel(channel, Buffer.from([0]));
      }
      channel.end();
      await reader.eof();
      return { bytes, sha256: hash.digest('hex') };
    }, { signal, timeout, closeSession });
  } finally {
    try { await file?.close(); } finally { if (closeSession) await session.close(); }
  }
}

/** Production pipeline adapter: own exec resource, same verified shared transport. */
export const streamScpFile=(session,{direction,local,remote,signal,onProgress}) => transferScp(session,{direction,localPath:local,remotePath:remote,signal,onProgress,timeout:300000,closeSession:false});
