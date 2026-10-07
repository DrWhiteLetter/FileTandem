import { createHash, randomUUID } from 'node:crypto';
import { posix } from 'node:path';

export const EDITOR_LIMIT = 10 * 1024 * 1024;
const hash = data => createHash('sha256').update(data).digest('hex');
const failure = message => Object.assign(new Error(message), { code: 'EDITOR_CONFLICT' });

/** A bounded editor snapshot, separate from the streaming transfer engine. */
export async function openEditorFile(session, path, { closeSession = true } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('\0') || posix.normalize(path) !== path || path.endsWith('/')) throw new Error('Ungültiger absoluter Dateipfad.');
  const sftp = await new Promise((resolve, reject) => session.sftp((e, channel) => e ? reject(e) : resolve(channel)));
  sftp.on('error', () => {});
  const call = (method, ...args) => new Promise((resolve, reject) => sftp[method](...args, (e, value) => e ? reject(e) : resolve(value)));
  const metadata = async () => {
    const value = await call('lstat', path);
    if (!value.isFile()) throw new Error('Der Editor unterstützt nur reguläre Dateien, keine Symlinks.');
    if (value.size > EDITOR_LIMIT) throw new Error('Editor-Limit: 10 MiB. Bitte die Datei übertragen.');
    return value;
  };
  const read = async () => {
    const before = await metadata();
    const handle = await call('open', path, 'r');
    try {
      const opened = await call('fstat', handle);
      if (!opened.isFile() || opened.size !== before.size || opened.mtime !== before.mtime) throw failure('Datei während des Öffnens geändert.');
      const data = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < data.length) {
        const count = await call('read', handle, data, offset, Math.min(65536, data.length - offset), offset);
        if (!count) throw failure('Datei während des Lesens geändert.');
        offset += count;
      }
      const after = await call('fstat', handle);
      if (after.size !== before.size || after.mtime !== before.mtime) throw failure('Datei während des Lesens geändert.');
      return { data, metadata: before };
    } finally { await call('close', handle); }
  };
  let reference;
  try {reference = hash((await read()).data);} catch (e) {sftp.end();throw e;}
  let queue = Promise.resolve();
  return {
    metadata, read: async () => (await read()).data,
    write(data, allowed) {
      const operation = queue.then(async () => {
        if (!allowed()) throw new Error('Datei ist schreibgeschützt.');
        if (data.length > EDITOR_LIMIT) throw new Error('Editor-Limit: 10 MiB.');
        const current = await read();
        if (hash(current.data) !== reference) throw failure('Remote-Datei wurde geändert. Speichern abgelehnt; Datei neu öffnen und Änderungen abgleichen.');
        const temporary = posix.join(posix.dirname(path), `.xscp-editor-${randomUUID()}.part`);
        let handle;
        try {
          handle = await call('open', temporary, 'wx', 0o600);
          for (let offset = 0; offset < data.length; offset += 65536) await call('write', handle, data, offset, Math.min(65536, data.length - offset), offset);
          await call('close', handle); handle = undefined;
          await call('chmod', temporary, current.metadata.mode & 0o777);
          if (hash((await read()).data) !== reference) throw failure('Remote-Datei wurde während des Speicherns geändert.');
          if (!allowed()) throw new Error('Bearbeitungsfreigabe wurde zurückgenommen.');
          await call('ext_openssh_rename', temporary, path);
          reference = hash(data);
        } finally {
          if (handle) await call('close', handle).catch(() => {});
          await call('unlink', temporary).catch(() => {});
        }
      });
      queue = operation.catch(() => {});
      return operation;
    },
    async close() { await queue; sftp.end(); if (closeSession) await session.close(); },
  };
}
