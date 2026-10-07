export const CHUNK_BYTES = 64 * 1024;
export const MAX_FILE_BYTES = Number.MAX_SAFE_INTEGER;
export const MAX_PROOF_BYTES = MAX_FILE_BYTES; // Legacy probe import; production sizes remain exact integers.
const utf8 = new TextDecoder('utf-8', { fatal: true });
export class ScpError extends Error {
  constructor(code, message) { super(message); this.name = 'ScpError'; this.code = code; }
}
export function safeName(name) {
  return typeof name === 'string' && name !== '' && name !== '.' && name !== '..'
    && !/[\x00-\x1f\x7f/\\]/.test(name) && Buffer.byteLength(name) <= 255
    && Buffer.from(name).toString('utf8') === name;
}
export function remotePath(path, directory = false) {
  if (typeof path !== 'string' || !path.startsWith('/') || Buffer.byteLength(path) > 4096
    || /[\x00-\x1f\x7f\\]/.test(path) || Buffer.from(path).toString('utf8') !== path
    || (path !== '/' && path.split('/').slice(1).some(part => !safeName(part)))
    || (!directory && path === '/')) {
    throw new ScpError('UNSAFE_SCP_PATH', 'SCP benötigt einen absoluten, sicher darstellbaren Pfad; für Steuerzeichen oder unsichere Namen SFTP verwenden.');
  }
  return path;
}
export const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
export function parseHeader(line, expectedName) {
  if (typeof line !== 'string' || Buffer.byteLength(line) > 4096) throw new ScpError('SCP_HEADER_LIMIT', 'SCP-Header überschreitet 4096 Bytes.');
  const match = /^C([0-7]{4}) (0|[1-9][0-9]*) (.+)$/.exec(line);
  if (!match || !safeName(match[3]) || match[3] !== expectedName) throw new ScpError('INVALID_SCP_HEADER', 'Unerwarteter SCP-Dateiheader oder Dateiname.');
  const size = Number(match[2]);
  if (!Number.isSafeInteger(size) || size > MAX_FILE_BYTES) throw new ScpError('INVALID_SCP_SIZE', 'SCP-Dateigröße ist keine sichere nichtnegative Ganzzahl.');
  return { size, mode: match[1], name: match[3] };
}

/** Pull reader handles fragmented/coalesced SSH packets without whole-file buffers. */
export class ScpReader {
  constructor(stream) { this.iterator = stream[Symbol.asyncIterator](); this.chunk = Buffer.alloc(0); this.offset = 0; this.remaining=undefined; this.phase='control'; }
  async readSome(max = CHUNK_BYTES) {
    if (!Number.isSafeInteger(max) || max < 1 || max > CHUNK_BYTES) throw new ScpError('SCP_READ_LIMIT','Ungültige Lesemenge.');
    if (this.phase === 'body') max=Math.min(max,this.remaining);
    if (!max) throw new ScpError('SCP_STATE','Dateiinhalt ist vollständig; Abschlussbestätigung erwartet.');
    while (this.offset === this.chunk.length) {
      const next = await this.iterator.next();
      if (next.done) {if (this.phase === 'body') throw new ScpError('SCP_EOF','Datei kürzer als angekündigt.');return null;}
      if (!Buffer.isBuffer(next.value) || next.value.length > 1024*1024) throw new ScpError('SCP_PACKET_LIMIT','SCP-Paket überschreitet 1 MiB.');
      this.chunk = next.value; this.offset = 0;
    }
    const end = Math.min(this.chunk.length, this.offset + max);
    const result = this.chunk.subarray(this.offset, end); this.offset = end;
    if (this.phase === 'body') {this.remaining-=result.length;if (!this.remaining) this.phase='completion';}
    return result;
  }
  async byte() {
    const data = await this.readSome(1);
    if (!data) throw new ScpError('SCP_EOF', 'Vorzeitiges Ende des SCP-Datenstroms.');
    return data[0];
  }
  async line() {
    const bytes = [];
    for (let count = 0; count < 4096; count++) {
      const byte = await this.byte();
      if (byte === 10) {
        try { return utf8.decode(Uint8Array.from(bytes)); }
        catch { throw new ScpError('INVALID_SCP_UTF8', 'SCP-Header ist kein gültiges UTF-8.'); }
      }
      bytes.push(byte);
    }
    throw new ScpError('SCP_HEADER_LIMIT', 'SCP-Header überschreitet 4096 Bytes.');
  }
  async ack() {
    if (this.phase === 'body') throw new ScpError('SCP_STATE','Bestätigung vor vollständiger Datenmenge.');
    const status = await this.byte();
    if (status === 0) {if (this.phase === 'completion') this.phase='finished';return;}
    if (status === 1 || status === 2) throw new ScpError('SCP_REMOTE_ERROR', await this.line());
    throw new ScpError('INVALID_SCP_ACK', 'Ungültige SCP-Bestätigung.');
  }
  async header(expectedName) {
    if (this.phase !== 'control') throw new ScpError('SCP_STATE','Unerwarteter zusätzlicher Dateiheader.');
    const type = await this.byte();
    if (type === 1 || type === 2) throw new ScpError('SCP_REMOTE_ERROR', await this.line());
    if (type !== 67) throw new ScpError('INVALID_SCP_HEADER', 'Nur ein einzelner SCP-Dateiheader wird unterstützt.');
    const header=parseHeader(`C${await this.line()}`, expectedName);this.remaining=header.size;this.phase=header.size ? 'body':'completion';return header;
  }
  async eof() {
    if (['body','completion'].includes(this.phase)) throw new ScpError('SCP_STATE','Fehlender Dateiabschluss.');
    if (await this.readSome(1)) throw new ScpError('SCP_TRAILING_DATA', 'Zusätzliche SCP-Daten nach der angeforderten Datei.');
  }
}
export const writeChannel = (channel, data) => new Promise((resolve, reject) => channel.write(data, error => error ? reject(error) : resolve()));
