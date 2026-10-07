import { createHash } from 'node:crypto';
import { HostKeyStore } from '../ssh/host-keys.js';

/** Public host keys only; no credentials and no Settings Sync registration.
 * @param {import('vscode').Memento} memento
 */
export function createHostKeyStore(memento) {
  const key = id => `xscp.host-key.v1.${createHash('sha256').update(id).digest('hex')}`;
  return new HostKeyStore({
    read: async id => memento.get(key(id)),
    write: async (id, record) => { await memento.update(key(id), record); },
  });
}
