import ssh2 from 'ssh2';
import { HostKeyStore, HostKeyError, serverIdentity } from './host-keys.js';

/** Sole SSH creation path. Callers cannot supply hostVerifier, hostHash, sock or algorithms.
 * @param {{host: string, port?: number, username: string, privateKey?: Buffer|string, password?: string, passphrase?: string, readyTimeout?: number}} config
 * @param {{trust: HostKeyStore, confirmUnknown?: Function, signal?: AbortSignal}} policy
 */
export async function connectSsh(config, { trust, confirmUnknown, signal } = {}) {
  if (!(trust instanceof HostKeyStore)) throw new HostKeyError('MISSING_HOST_KEY_POLICY', 'Verpflichtender Host-Key-Speicher fehlt.');
  const allowed = new Set(['host', 'port', 'username', 'privateKey', 'password', 'passphrase', 'readyTimeout']);
  if (!config || Object.keys(config).some(key => !allowed.has(key))) {
    throw new HostKeyError('INVALID_SSH_CONFIG', 'Nicht unterstützte SSH-Verbindungsoption.');
  }
  const endpoint = serverIdentity(config.host, config.port);
  if (typeof config.username !== 'string' || !config.username || /[\x00-\x1f]/.test(config.username)) {
    throw new HostKeyError('INVALID_SSH_CONFIG', 'SSH-Benutzer fehlt oder ist ungültig.');
  }
  const timeout = config.readyTimeout ?? 120000;
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 300000) throw new HostKeyError('INVALID_SSH_CONFIG', 'Ungültiges SSH-Zeitlimit.');
  if (signal?.aborted) throw new HostKeyError('CONNECTION_ABORTED', 'SSH-Verbindung wurde abgebrochen.');
  const client = new ssh2.Client();
  const controller = new AbortController();
  let settled = false;
  let verified;
  let failure;
  let closed = false;
  let resolveClosed;
  const closedPromise = new Promise(resolve => { resolveClosed = resolve; });

  return new Promise((resolve, reject) => {
    let timer;
    const abort = () => {
      failure ??= new HostKeyError('CONNECTION_ABORTED', 'SSH-Verbindung wurde abgebrochen.');
      controller.abort();
      client.destroy();
    };
    const fail = error => {
      failure ??= error;
      controller.abort();
      client.destroy();
    };
    signal?.addEventListener('abort', abort, { once: true });
    client.on('error', error => { fail(failure ?? error); });
    client.once('close', () => {
      closed = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.abort();
      resolveClosed();
      if (!settled) {
        settled = true;
        reject(failure ?? new HostKeyError('CONNECTION_CLOSED', 'SSH-Verbindung vorzeitig geschlossen.'));
      }
    });
    client.once('ready', () => {
      if (!verified || controller.signal.aborted) {
        fail(failure ?? new HostKeyError('HOST_KEY_NOT_VERIFIED', 'SSH-Host-Key wurde nicht geprüft.'));
        return;
      }
      clearTimeout(timer);
      settled = true;
      resolve(Object.freeze({ endpoint, hostKey: verified,
        sftp: callback => client.sftp(callback),
        exec: (command, ...args) => client.exec(command, ...args),
        closed: closedPromise,
        close: async () => {
          if (!closed) client.end();
          const force = setTimeout(() => client.destroy(), 1000);
          try { await closedPromise; } finally { clearTimeout(force); }
        },
      }));
    });
    timer = setTimeout(() => fail(new HostKeyError('CONNECTION_TIMEOUT', 'SSH-Verbindung oder Host-Key-Entscheidung hat das Zeitlimit überschritten.')), timeout);
    try {
      client.connect({ host: endpoint.host, port: endpoint.port, username: config.username,
        privateKey: config.privateKey, password: config.password, passphrase: config.passphrase,
        readyTimeout: timeout, keepaliveInterval: 15000, keepaliveCountMax: 3,
        hostVerifier: (rawKey, finish) => {
          trust.verify(endpoint, rawKey, confirmUnknown, controller.signal).then(key => {
            if (closed || controller.signal.aborted) return;
            verified = key;
            finish(true);
          }).catch(error => {
            failure ??= error;
            if (!closed && !controller.signal.aborted) finish(false);
          });
        },
      });
    } catch (error) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.abort();
      client.destroy();
      if (!settled) { settled = true; reject(error); }
    }
  });
}
