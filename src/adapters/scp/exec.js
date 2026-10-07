import { ScpError } from './protocol.js';

/** One-shot, no PTY, bounded diagnostics, verified connectSsh session only. */
export async function withExec(session, command, operation, { signal, timeout = 30000 } = {}) {
  let channel;
  let timer;
  let channelClosed;
  let failure;
  const abort = () => {
    failure ??= new DOMException('SCP-Ausführung abgebrochen.', 'AbortError');
    channel?.destroy();
    void session.close();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (!Number.isInteger(timeout) || timeout < 100 || timeout > 300000) throw new TypeError('Ungültiges SCP-Zeitlimit.');
    signal?.throwIfAborted();
    timer = setTimeout(() => { failure = new ScpError('SCP_TIMEOUT', 'SCP-Ausführung hat das Zeitlimit überschritten.'); abort(); }, timeout);
    channel = await Promise.race([
      new Promise((resolve, reject) => session.exec(command, { pty: false }, (error, stream) => {
        if (error) reject(error);
        else if (failure) { stream.destroy(); stream.resume(); reject(failure); }
        else resolve(stream);
      })),
      session.closed.then(() => { throw failure ?? new ScpError('SCP_CONNECTION_CLOSED', 'SSH-Verbindung vor Exec geschlossen.'); }),
    ]);
    let diagnostic = Buffer.alloc(0);
    let exitCode;
    let exitSignal;
    channel.stderr.on('data', data => { diagnostic = Buffer.concat([diagnostic, data.subarray(0, Math.max(0, 8192 - diagnostic.length))]); });
    channel.on('error', error => { failure ??= error; });
    channel.on('exit', (code, signalName) => { exitCode = code; exitSignal = signalName; });
    channelClosed = new Promise(resolve => channel.once('close', resolve));
    const result = await Promise.race([operation(channel), session.closed.then(() => {
      throw failure ?? new ScpError('SCP_CONNECTION_CLOSED', 'SSH-Verbindung während Exec geschlossen.');
    })]);
    await channelClosed;
    if (failure) throw failure;
    if (exitCode !== 0 || exitSignal) throw new ScpError('SCP_EXEC_FAILED', `SCP/Shell fehlgeschlagen (${exitCode ?? exitSignal ?? 'kein Exitstatus'}): ${diagnostic.toString('utf8')}`);
    return result;
  } catch (error) {
    throw failure ?? error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    channel?.destroy();
    // ssh2 emits channel close only after readable EOF has been consumed.
    // Discard remaining bytes on failure so buffers cannot retain the channel.
    channel?.removeAllListeners('readable');
    channel?.resume();
    await session.close();
    await channelClosed;
  }
}
