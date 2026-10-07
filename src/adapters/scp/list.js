import { ScpError, remotePath, shellQuote, safeName } from './protocol.js';
import { withExec } from './exec.js';
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_LIST_BYTES = 1024 * 1024;
export function parseListing(data) {
  let fields;
  try { fields = decoder.decode(data).split('\0'); }
  catch { throw new ScpError('INVALID_LISTING', 'GNU-find-Ausgabe ist kein gültiges UTF-8.'); }
  if (fields.pop() !== '' || fields.length % 6) throw new ScpError('INVALID_LISTING', 'Unvollständige GNU-find-Metadaten.');
  const entries = [];
  for (let index = 0; index < fields.length; index += 6) {
    const [name, type, size, mtime, mode, linkTarget] = fields.slice(index, index + 6);
    if (!name || name === '.' || name === '..' || name.includes('/') || !/^[fdlbcps]$/.test(type)
      || !/^\d+$/.test(size) || !Number.isSafeInteger(Number(size)) || !/^-?\d+(?:\.\d+)?$/.test(mtime)
      || !Number.isFinite(Number(mtime)) || !/^[0-7]{1,4}$/.test(mode)) throw new ScpError('INVALID_LISTING', 'Ungültige GNU-find-Metadaten.');
    entries.push({ name, type, size: Number(size), mtime: Number(mtime), mode, linkTarget,
      transferable: type === 'f' && safeName(name) });
  }
  return entries;
}
/** Proof of GNU/Linux shell profile and one-level NUL metadata listing. */
export async function listScp(session, { path, signal, timeout } = {}) {
  try {
    remotePath(path, true);
    const command = `export LC_ALL=C; if ! (command -v scp >/dev/null && find --version | grep -q 'GNU findutils' && stat --version | grep -q 'GNU coreutils'); then printf '%s\\n' 'SCP benötigt scp, GNU find/coreutils und POSIX-Shell.' >&2; exit 126; fi; if ! test -d ${shellQuote(path)}; then printf '%s\\n' 'SCP-Auflistung benötigt ein Verzeichnis.' >&2; exit 1; fi; find -P ${shellQuote(path)} -mindepth 1 -maxdepth 1 -printf '%f\\0%y\\0%s\\0%T@\\0%m\\0%l\\0'`;
    return await withExec(session, command, async channel => {
      channel.end();
      const chunks = []; let bytes = 0;
      for await (const chunk of channel) {
        bytes += chunk.length;
        if (bytes > MAX_LIST_BYTES) throw new ScpError('SCP_LIST_LIMIT', 'GNU-find-Liste überschreitet das Prototyp-Limit von 1 MiB.');
        chunks.push(chunk);
      }
      return parseListing(Buffer.concat(chunks));
    }, { signal, timeout });
  } finally { await session.close(); }
}
