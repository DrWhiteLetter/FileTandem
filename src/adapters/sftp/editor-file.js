import { createHash, randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { RemoteFiles } from './files.js';
export const EDITOR_LIMIT = 10 * 1024 * 1024;
const hash = data => createHash('sha256').update(data).digest('hex');
const failure = message => Object.assign(new Error(message), { code: 'EDITOR_CONFLICT' });

/** Bounded snapshots; private wx part, hash verification and guarded atomic publish. */
export async function openEditorFile(session,path,{closeSession=true,allowCreate=false}={}) {
  if (typeof path!=='string' || !path.startsWith('/') || path.includes('\0') || path.length>4096 || posix.normalize(path)!==path || path.endsWith('/')) throw new Error('Ungültiger absoluter Dateipfad.');
  const channel=await RemoteFiles.open(session);const call=(...args) => channel.call(...args);let closed=false;
  const metadata=async (target=path) => {
    const value=await call('lstat',target);
    if (!value.isFile()) throw new Error('Der Editor unterstützt nur reguläre Dateien, keine Symlinks.');
    if (value.size>EDITOR_LIMIT) throw Object.assign(new Error('Editor-Limit: 10 MiB. Bitte die Datei übertragen.'),{code:'EDITOR_LIMIT'});
    return value;
  };
  const read=async (target=path) => {
    const before=await metadata(target);const handle=await call('open',target,'r');
    try {
      const opened=await call('fstat',handle);
      if (!opened.isFile() || opened.size!==before.size || opened.mtime!==before.mtime) throw failure('Datei während des Öffnens geändert.');
      const data=Buffer.alloc(before.size);let offset=0;
      while (offset<data.length) {const count=await call('read',handle,data,offset,Math.min(65536,data.length-offset),offset);if (!count) throw failure('Datei während des Lesens geändert.');offset+=count;}
      const after=await call('fstat',handle);const named=await metadata(target);
      if (after.size!==before.size || after.mtime!==before.mtime || named.size!==before.size || named.mtime!==before.mtime) throw failure('Datei während des Lesens geändert.');
      return {data,metadata:before};
    } finally {await call('close',handle).catch(() => {});}
  };
  const current=async () => {try {return await read();} catch(e) {if (e.code===2 || e.code==='ENOENT') return null;throw e;}};
  let reference,baseline;
  try {const value=await current();if (!value && !allowCreate) throw Object.assign(new Error('Datei nicht gefunden.'),{code:2});baseline=value?.data ?? null;reference=value ? hash(value.data):null;} catch(e) {channel.close();throw e;}
  let queue=Promise.resolve();
  return {
    metadata:() => metadata(),read:async () => (await read()).data,
    baseline:() => baseline===null ? null:Buffer.from(baseline),
    write(data,allowed,{create=true,overwrite=true}={}) {
      const operation=queue.then(async () => {
        if (closed || !allowed()) throw new Error('Datei ist schreibgeschützt.');
        if (data.length>EDITOR_LIMIT) throw new Error('Editor-Limit: 10 MiB.');
        const value=await current();
        if (value && !overwrite) throw Object.assign(new Error('Datei existiert bereits.'),{code:'EEXIST'});
        if (!value && !create) throw Object.assign(new Error('Datei nicht gefunden.'),{code:'ENOENT'});
        if ((value ? hash(value.data):null)!==reference) throw failure('Remote-Datei wurde geändert. Speichern abgelehnt; Änderungen vergleichen.');
        const temporary=posix.join(posix.dirname(path),`.xscp-editor-${randomUUID()}.part`);let handle;
        try {
          handle=await call('open',temporary,'wx',0o600);
          for (let offset=0;offset<data.length;offset+=65536) await call('write',handle,data,offset,Math.min(65536,data.length-offset),offset);
          await call('close',handle);handle=undefined;
          if (hash((await read(temporary)).data)!==hash(data)) throw failure('Upload-Prüfsumme stimmt nicht überein.');
          await call('chmod',temporary,value ? value.metadata.mode & 0o777:0o600);
          const latest=await current();if ((latest ? hash(latest.data):null)!==reference) throw failure('Remote-Datei wurde während des Speicherns geändert.');
          if (closed || !allowed()) throw new Error('Bearbeitungsfreigabe wurde zurückgenommen.');
          // Standard SFTP rename must refuse an existing destination; replacement
          // requires the server's atomic OpenSSH extension. No unsafe fallback.
          await call(value ? 'ext_openssh_rename':'rename',temporary,path);
          reference=hash(data);baseline=Buffer.from(data);
        } finally {if (handle) await call('close',handle).catch(() => {});await call('unlink',temporary).catch(() => {});}
      });queue=operation.catch(() => {});return operation;
    },
    async close() {closed=true;channel.close();await queue;if (closeSession) await session.close();},
  };
}
