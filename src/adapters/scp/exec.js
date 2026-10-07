import { ScpError } from './protocol.js';
/** Dedicated non-PTY exec channel. Shared transports survive cancellation of one operation. */
export async function withExec(session,command,operation,{signal,timeout=30000,closeSession=true}={}) {
  let channel,timer,failure,closed;let rejectAborted;
  const interrupted=new Promise((_,reject) => {rejectAborted=reject;});
  const abort=() => {failure ??= signal?.reason ?? new DOMException('SCP-Ausführung abgebrochen.','AbortError');rejectAborted(failure);channel?.close();channel?.destroy();channel?.resume();};
  try {
    if (!Number.isInteger(timeout) || timeout < 100 || timeout > 300000) throw new TypeError('Ungültiges SCP-Zeitlimit.');signal?.throwIfAborted();
    signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(() => {failure=new ScpError('SCP_TIMEOUT','SCP-Ausführung hat das Zeitlimit überschritten.');abort();},timeout);
    const disconnected=session.closed.then(() => {throw failure ?? new ScpError('SCP_CONNECTION_CLOSED','SSH-Verbindung während Exec geschlossen.');});
    channel=await Promise.race([new Promise((resolve,reject) => session.exec(command,{pty:false},(error,stream) => {if (error) reject(error);else if (failure) {stream.close();stream.destroy();stream.resume();reject(failure);}else resolve(stream);})),interrupted,disconnected]);
    let diagnostic=Buffer.alloc(0),exitCode,exitSignal;
    channel.stderr.on('data',data => {diagnostic=Buffer.concat([diagnostic,data.subarray(0,Math.max(0,8192-diagnostic.length))]);});
    channel.on('error',error => {failure ??= error;rejectAborted(failure);});
    channel.on('exit',(code,name) => {exitCode=code;exitSignal=name;});closed=new Promise(resolve => channel.once('close',resolve));
    const result=await Promise.race([operation(channel),interrupted,disconnected]);await Promise.race([closed,interrupted,disconnected]);
    if (failure) throw failure;
    if (exitCode !== 0 || exitSignal) throw Object.assign(new ScpError('SCP_EXEC_FAILED',`SCP/Shell fehlgeschlagen (${exitCode ?? exitSignal ?? 'kein Exitstatus'}): ${diagnostic.toString('utf8')}`),{status:exitCode});
    return result;
  } catch(error) {throw failure ?? error;}
  finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);channel?.close();channel?.destroy();channel?.resume();if (closeSession) {await session.close();await closed;}}
}
