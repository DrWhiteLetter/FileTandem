import { posix } from 'node:path';
export function remotePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\0') || value.length > 4096) throw new Error('Remote-Pfad muss ein absoluter POSIX-Pfad sein.');
  return posix.normalize(value);
}
const entry=(path,attrs,target='') => ({id:path,path,name:posix.basename(path),kind:attrs.isSymbolicLink() ? 'symlink':attrs.isDirectory() ? 'directory':attrs.isFile() ? 'file':'other',size:attrs.size,modified:attrs.mtime*1000,mode:attrs.mode & 0o777,linkTarget:target});
export class RemoteFiles {
  #pending=new Set(); #closed=false;
  constructor(channel,session) {
    this.channel=channel;this.session=session;this.capabilities={browse:true,mkdir:true,rename:true,delete:true,chmod:true,symlinks:true};
    const close=() => {this.#closed=true;for (const reject of this.#pending) reject(Object.assign(new Error('SFTP-Verbindung geschlossen.'),{code:'NOT_CONNECTED'}));this.#pending.clear();};
    channel.on('error',close);channel.once('close',close);session.closed.then(close);
  }
  static async open(session) {
    const channel=await new Promise((resolve,reject) => {const timer=setTimeout(() => {void session.close();reject(new Error('SFTP-Zeitlimit überschritten.'));},15000);
      session.sftp((error,value) => {clearTimeout(timer);if (error) reject(error);else resolve(value);});});
    return new RemoteFiles(channel,session);
  }
  call(method,...args) {
    if (this.#closed) return Promise.reject(Object.assign(new Error('Nicht verbunden.'),{code:'NOT_CONNECTED'}));
    return new Promise((resolve,reject) => {
      let done=false;const finish=(error,value) => {if (done) return;done=true;clearTimeout(timer);this.#pending.delete(fail);error ? reject(error) : resolve(value);};
      const fail=error => finish(error);const timer=setTimeout(() => {finish(Object.assign(new Error('SFTP-Zeitlimit.'),{code:'NOT_CONNECTED'}));void this.session.close();},15000);
      this.#pending.add(fail);
      try {this.channel[method](...args,finish);} catch(error) {finish(error);}
    });
  }
  async stat(value) {const path=remotePath(value);const attrs=await this.call('lstat',path);return entry(path,attrs,attrs.isSymbolicLink() ? await this.call('readlink',path) : '');}
  async list(value) {
    const path=remotePath(value);const attrs=await this.call('stat',path);if (!attrs.isDirectory()) throw Object.assign(new Error('Kein Ordner.'),{code:'ENOTDIR'});
    const values=await this.call('readdir',path);if (values.length > 10000) throw new Error('Ordner enthält mehr als 10.000 Einträge.');
    const entries=[];let next=0;
    await Promise.all(Array.from({length:Math.min(16,values.length)},async () => {while (next < values.length) {
      const value=values[next++];if (value.filename === '.' || value.filename === '..') continue;
      if (typeof value.filename !== 'string' || value.filename.includes('/') || value.filename.includes('\0')) throw new Error('Ungültiger SFTP-Dateiname.');
      const full=posix.join(path,value.filename);const target=value.attrs.isSymbolicLink() ? await this.call('readlink',full).catch(() => '?') : '';
      entries.push(entry(full,value.attrs,target));
    }}));return {path,entries};
  }
  close() {this.channel.end();}
}
