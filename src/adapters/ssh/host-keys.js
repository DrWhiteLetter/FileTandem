import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import ssh2 from 'ssh2';

export class HostKeyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'HostKeyError';
    this.code = code;
    this.details = details;
  }
}

/** Host aliases are kept separate; DNS names are case-insensitive, ports are not interchangeable. */
export function serverIdentity(host, port = 22) {
  if (typeof host !== 'string' || !host || host !== host.trim() || /[\s\x00-\x1f]/.test(host)
    || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HostKeyError('INVALID_ENDPOINT', 'Ungültiger SSH-Hostname oder Port.');
  }
  let normalized = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (isIP(normalized) === 6) normalized = new URL(`http://[${normalized}]/`).hostname.slice(1, -1);
  else if (!isIP(normalized)) {
    if (/[\/\\?#@:%]/.test(normalized)) throw new HostKeyError('INVALID_ENDPOINT', 'Nur Hostname oder IP-Adresse eingeben, keine URL.');
    normalized = domainToASCII(normalized.replace(/\.$/, '')).toLowerCase();
    if (!normalized || !/^[a-z0-9._-]+$/.test(normalized)) {
      throw new HostKeyError('INVALID_ENDPOINT', 'Ungültiger SSH-Hostname.');
    }
  }
  return Object.freeze({ host: normalized, port, id: JSON.stringify([normalized, port]),
    label: `${isIP(normalized) === 6 ? `[${normalized}]` : normalized}:${port}` });
}

export function describeHostKey(rawKey) {
  if (!Buffer.isBuffer(rawKey) || rawKey.length === 0 || rawKey.length > 64 * 1024) {
    throw new HostKeyError('INVALID_HOST_KEY', 'Ungültiger SSH-Host-Key.');
  }
  const parsed = ssh2.utils.parseKey(rawKey);
  if (parsed instanceof Error || !parsed?.type) throw new HostKeyError('INVALID_HOST_KEY', 'SSH-Host-Key konnte nicht gelesen werden.');
  return Object.freeze({ algorithm: parsed.type, key: rawKey.toString('base64'),
    fingerprint: `SHA256:${createHash('sha256').update(rawKey).digest('base64').replace(/=+$/, '')}` });
}

const checkActive = signal => {
  if (signal?.aborted) throw new HostKeyError('CONNECTION_ABORTED', 'SSH-Verbindung wurde abgebrochen.');
};

async function awaitDecision(value, signal) {
  checkActive(signal);
  if (!signal) return await value;
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(new HostKeyError('CONNECTION_ABORTED', 'SSH-Verbindung wurde abgebrochen.'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([Promise.resolve(value), cancelled]); }
  finally { signal.removeEventListener('abort', abort); }
}

/** Non-secret trust records; storage failures are never interpreted as unknown keys.
 * @param {{read: (id: string) => Promise<unknown>, write: (id: string, record: object) => Promise<void>}} storage
 */
export class HostKeyStore {
  #storage;
  #queues = new Map();
  constructor(storage) {
    if (typeof storage?.read !== 'function' || typeof storage?.write !== 'function') throw new TypeError('Host-Key-Speicher fehlt.');
    this.#storage = storage;
  }

  /** Serialize a trust decision per endpoint so concurrent keys cannot replace one another.
   * @param {ReturnType<typeof serverIdentity>} endpoint
   * @param {Buffer} rawKey
   * @param {(request: object, signal?: AbortSignal) => Promise<boolean>} confirmUnknown
   * @param {AbortSignal} [signal]
   * @param {(request: object, signal?: AbortSignal) => Promise<boolean>} [confirmChanged]
   */
  async verify(endpoint, rawKey, confirmUnknown, signal, confirmChanged) {
    const identity = serverIdentity(endpoint.host, endpoint.port);
    const key = describeHostKey(rawKey);
    const previous = this.#queues.get(identity.id) ?? Promise.resolve();
    const task = previous.catch(() => {}).then(async () => {
      checkActive(signal);
      const saved = await this.#storage.read(identity.id);
      checkActive(signal);
      if (saved !== undefined) {
        let stored;
        try {
          stored = describeHostKey(Buffer.from(saved.key, 'base64'));
          if (saved.version !== 1 || saved.host !== identity.host || saved.port !== identity.port
            || saved.key !== stored.key || saved.fingerprint !== stored.fingerprint || saved.algorithm !== stored.algorithm) throw new Error();
        } catch {
          throw new HostKeyError('INVALID_TRUST_RECORD', 'Gespeicherter Host-Key ist ungültig. Verbindung blockiert.');
        }
        if (saved.key !== key.key) {
          const request = { endpoint: identity, expected: stored, received: key };
          if (typeof confirmChanged !== 'function' || await awaitDecision(confirmChanged(request, signal), signal) !== true) {
            throw new HostKeyError('HOST_KEY_CHANGED', `Der Host-Key für ${identity.label} hat sich geändert. Verbindung blockiert.`, request);
          }
          checkActive(signal);
          const current = await this.#storage.read(identity.id);
          checkActive(signal);
          if (JSON.stringify(current) !== JSON.stringify(saved)) throw new HostKeyError('TRUST_RECORD_CHANGED', 'Host-Key-Speicher wurde zwischenzeitlich geändert. Bitte erneut verbinden.');
          await this.#storage.write(identity.id, { version: 1, host: identity.host, port: identity.port, ...key });
          checkActive(signal);
        }
        return key;
      }
      if (typeof confirmUnknown !== 'function' || await awaitDecision(confirmUnknown({ endpoint: identity, ...key }, signal), signal) !== true) {
        throw new HostKeyError('HOST_KEY_REJECTED', `Unbekannter Host-Key für ${identity.label} wurde nicht bestätigt.`);
      }
      checkActive(signal);
      await this.#storage.write(identity.id, { version: 1, host: identity.host, port: identity.port, ...key });
      checkActive(signal);
      return key;
    });
    this.#queues.set(identity.id, task);
    try { return await task; } finally {
      if (this.#queues.get(identity.id) === task) this.#queues.delete(identity.id);
    }
  }
}
