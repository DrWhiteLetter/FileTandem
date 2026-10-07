import { ScpError,EXEC_ACTIVITY } from './protocol.js';
/** Dedicated non-PTY exec channel. Shared transports survive cancellation of one operation. */
export async function withExec(session,command,operation,{signal,timeout=30000,closeSession=true}={}) {
  let channel,timer,failure,closed,active=true,exitCode,exitSignal;let diagnostic=Buffer.alloc(0);let rejectAborted;
  const interrupted=new Promise((_,reject) => {rejectAborted=reject;});
  const abort=() => {failure ??= signal?.reason ?? new DOMException('SCP-Ausführung abgebrochen.','AbortError');rejectAborted(failure);channel?.close();channel?.destroy();channel?.resume();};
  const touch=() => {if (!active) return;clearTimeout(timer);timer=setTimeout(() => {failure=new ScpError('SCP_TIMEOUT','SCP-Ausführung ohne Fortschritt hat das Zeitlimit überschritten.');abort();},timeout);};
  try {
    if (!Number.isInteger(timeout) || timeout < 100 || timeout > 300000) throw new TypeError('Ungültiges SCP-Zeitlimit.');signal?.throwIfAborted();
    signal?.addEventListener('abort',abort,{once:true});touch();
    const disconnected=session.closed.then(() => {throw failure ?? new ScpError('SCP_CONNECTION_CLOSED','SSH-Verbindung während Exec geschlossen.');});
    channel=await Promise.race([new Promise((resolve,reject) => session.exec(command,{pty:false},(error,stream) => {
      if (error) {reject(error);return;}
      if (failure) {stream.close();stream.destroy();stream.resume();reject(failure);return;}
      // Install listeners synchronously: ssh2 can emit exit/close while parsing
      // the very same packet that satisfied this exec callback.
      stream[EXEC_ACTIVITY]=touch;
      stream.stderr.on('data',data => {diagnostic=Buffer.concat([diagnostic,data.subarray(0,Math.max(0,8192-diagnostic.length))]);});
      stream.on('error',error => {failure ??= error;rejectAborted(failure);});
      stream.on('exit',(code,name) => {exitCode=code;exitSignal=name;});closed=new Promise(resolve => stream.once('close',resolve));resolve(stream);
    })),interrupted,disconnected]);
    if (failure) throw failure;
    const result=await Promise.race([operation(channel),interrupted,disconnected]);await Promise.race([closed,interrupted,disconnected]);
    if (failure) throw failure;
    if (exitCode !== 0 || exitSignal) throw Object.assign(new ScpError('SCP_EXEC_FAILED',`SCP/Shell fehlgeschlagen (${exitCode ?? exitSignal ?? 'kein Exitstatus'}): ${diagnostic.toString('utf8')}`),{status:exitCode});
    return result;
  } catch(error) {throw failure ?? error;}
  finally {active=false;clearTimeout(timer);if (channel) delete channel[EXEC_ACTIVITY];signal?.removeEventListener('abort',abort);channel?.close();channel?.destroy();channel?.resume();if (closeSession) {await session.close();await closed;}}
}
