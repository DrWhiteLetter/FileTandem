import { readdir,lstat,stat,readlink,mkdir,open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute,resolve,join,dirname,basename } from 'node:path';
import { homedir } from 'node:os';
export function localPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.includes('://') || !isAbsolute(value)) throw new Error('Bitte einen absoluten lokalen Dateipfad eingeben; Remote-URIs sind keine lokalen Pfade.');
  return resolve(value);
}
export function localFileUri(uri) {
  if (uri?.scheme !== 'file' || uri.authority || uri.query || uri.fragment) throw new Error('Lokal werden ausschließlich file:-URIs ohne Authority akzeptiert.');
  return localPath(uri.fsPath);
}
export const localParent=value => dirname(localPath(value));
export const localStart=value => value ? localPath(value) : homedir();
export function localEntry(path,info,target='') {
  return {id:path,name:basename(path),path,kind:info.isSymbolicLink() ? 'symlink':info.isDirectory() ? 'directory':info.isFile() ? 'file':'other',size:info.size,modified:info.mtimeMs,mode:info.mode & 0o777,linkTarget:target};
}
export class LocalFiles {
  async list(uri) {
    const path=localFileUri(uri); const info=await stat(path); if (!info.isDirectory()) throw Object.assign(new Error('Pfad ist kein Ordner.'),{code:'ENOTDIR'});
    const names=await readdir(path); if (names.length > 10000) throw new Error('Ordner enthält mehr als 10.000 Einträge; Anzeige vorerst begrenzt.');
    const entries=[]; let next=0;
    await Promise.all(Array.from({length:Math.min(16,names.length)},async () => {
      while (next < names.length) {const name=names[next++]; const target=join(path,name);
        try {const item=await lstat(target); entries.push(localEntry(target,item,item.isSymbolicLink() ? await readlink(target) : ''));}
        catch(error) {if (error.code !== 'ENOENT') throw error;}
      }
    }));
    return {path,entries};
  }
  async listNoFollow(path) {const uri={scheme:'file',fsPath:localPath(path)};if ((await this.stat(uri)).kind !== 'directory') throw new Error('Ordner wurde ersetzt.');return this.list(uri);}
  mkdir(path) {return mkdir(localPath(path));}
  async chmod(path,mode) {
    if (process.platform === 'win32') throw new Error('POSIX-Rechte werden unter Windows nicht unterstützt.');
    const handle=await open(localPath(path),constants.O_RDONLY | constants.O_NOFOLLOW);
    try {await handle.chmod(mode);} finally {await handle.close();}
  }
  async stat(uri) {const path=localFileUri(uri); const info=await lstat(path); return localEntry(path,info,info.isSymbolicLink() ? await readlink(path) : '');}
}
