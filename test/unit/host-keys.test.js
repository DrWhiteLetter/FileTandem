import test from 'node:test';
import assert from 'node:assert/strict';
import { HostKeyStore, describeHostKey, serverIdentity } from '../../src/adapters/ssh/host-keys.js';
import { createHostKeyStore } from '../../src/adapters/storage/host-key-store.js';
import { unknownHostKeyDialog } from '../../src/vscode/host-key-dialog.js';
import { connectSsh } from '../../src/adapters/ssh/connect.js';

const wireKey = fill => {
  const algorithm = Buffer.from('ssh-ed25519');
  const lengths = [Buffer.alloc(4), Buffer.alloc(4)];
  lengths[0].writeUInt32BE(algorithm.length);
  lengths[1].writeUInt32BE(32);
  return Buffer.concat([lengths[0], algorithm, lengths[1], Buffer.alloc(32, fill)]);
};
const raw = wireKey(1);
const other = wireKey(2);
function memory() {
  const records = new Map();
  return { records, trust: new HostKeyStore({ read: async id => records.get(id), write: async (id, record) => { records.set(id, record); } }) };
}
const endpoint = serverIdentity('server.example', 22);

test('Endpoint identity normalizes DNS/IPv6 and separates ports and aliases', () => {
  assert.equal(serverIdentity('SERVER.example.', 22).id, endpoint.id);
  assert.equal(serverIdentity('[2001:0db8::1]').id, serverIdentity('2001:db8::1').id);
  assert.notEqual(serverIdentity('server.example', 2222).id, endpoint.id);
  assert.notEqual(serverIdentity('alias.example').id, endpoint.id);
  for (const [host, port] of [['user@host', 22], ['host\n', 22], ['https://host', 22], ['host', 0], ['server.example/path', 22], ['server.example?x', 22]]) {
    assert.throws(() => serverIdentity(host, port), { code: 'INVALID_ENDPOINT' });
  }
});

test('Malformed host keys and corrupt stored records block access', async () => {
  assert.throws(() => describeHostKey(Buffer.from('not an SSH key')), { code: 'INVALID_HOST_KEY' });
  const { records, trust } = memory();
  records.set(endpoint.id, { key: 'corrupt' });
  await assert.rejects(trust.verify(endpoint, raw, () => { throw new Error('must not prompt'); }), { code: 'INVALID_TRUST_RECORD' });
});

test('Only explicit boolean consent trusts an unknown key; known keys do not prompt', async () => {
  for (const answer of [false, undefined, 'yes', { accepted: true }]) {
    const { records, trust } = memory();
    await assert.rejects(trust.verify(endpoint, raw, async () => answer), { code: 'HOST_KEY_REJECTED' });
    assert.equal(records.size, 0);
  }
  const { records, trust } = memory();
  await assert.rejects(trust.verify(endpoint, raw), { code: 'HOST_KEY_REJECTED' });
  const observed = await trust.verify(endpoint, raw, async request => {
    assert.match(request.fingerprint, /^SHA256:[A-Za-z0-9+/]{43}$/);
    return true;
  });
  assert.equal(records.size, 1);
  assert.equal((await trust.verify(endpoint, raw, () => { throw new Error('must not prompt'); })).fingerprint, observed.fingerprint);
  await assert.rejects(trust.verify(endpoint, other, () => { throw new Error('must not prompt'); }), { code: 'HOST_KEY_CHANGED' });
  assert.equal(records.get(endpoint.id).key, observed.key);
});

test('Read/write/confirmation failures fail closed', async () => {
  for (const storage of [
    { read: async () => { throw new Error('read failed'); }, write: async () => {} },
    { read: async () => undefined, write: async () => { throw new Error('write failed'); } },
  ]) await assert.rejects(new HostKeyStore(storage).verify(endpoint, raw, async () => true), /failed/);
  await assert.rejects(memory().trust.verify(endpoint, raw, async () => { throw new Error('dialog failed'); }), /dialog failed/);
});

test('Concurrent first connections cannot replace the first approved key', async () => {
  const { records, trust } = memory();
  let consent;
  const first = trust.verify(endpoint, raw, () => new Promise(resolve => { consent = resolve; }));
  const second = trust.verify(endpoint, other, () => { throw new Error('must not prompt'); });
  await new Promise(resolve => setImmediate(resolve));
  consent(true);
  await first;
  await assert.rejects(second, { code: 'HOST_KEY_CHANGED' });
  assert.equal(records.size, 1);
});

test('Abort releases pending decision; late consent never saves trust', async () => {
  const { records, trust } = memory();
  const controller = new AbortController();
  let consent;
  const pending = trust.verify(endpoint, raw, () => new Promise(resolve => { consent = resolve; }), controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { code: 'CONNECTION_ABORTED' });
  consent(true);
  await assert.rejects(trust.verify(endpoint, raw, async () => false), { code: 'HOST_KEY_REJECTED' });
  assert.equal(records.size, 0);
});

test('Memento trust persists across store instances and does not request Settings Sync', async () => {
  const values = new Map();
  const memento = { get: key => values.get(key), update: async (key, value) => { values.set(key, value); },
    setKeysForSync: () => { throw new Error('must not sync trust'); } };
  await createHostKeyStore(memento).verify(endpoint, raw, async () => true);
  await createHostKeyStore(memento).verify(endpoint, raw, () => { throw new Error('must not prompt'); });
  assert.equal(values.size, 1);
});

test('Connection factory refuses missing policy and verifier/algorithm/socket overrides', async () => {
  const config = { host: '127.0.0.1', username: 'fixture' };
  await assert.rejects(connectSsh(config), { code: 'MISSING_HOST_KEY_POLICY' });
  for (const extra of ['hostVerifier', 'hostHash', 'sock', 'algorithms']) {
    await assert.rejects(connectSsh({ ...config, [extra]: true }, { trust: memory().trust }), { code: 'INVALID_SSH_CONFIG' });
  }
});

test('Native dialog shows endpoint and fingerprint and defaults to rejection', async () => {
  const request = { endpoint, ...describeHostKey(raw) };
  for (const [choice, accepted] of [[undefined, false], ['Ablehnen', false], ['Vertrauen und verbinden', true]]) {
    const window = { showWarningMessage: async (message, options, ...buttons) => {
      assert.ok(message.includes(endpoint.label));
      assert.ok(options.detail.includes(request.fingerprint));
      assert.ok(options.detail.includes(request.algorithm));
      assert.equal(options.modal, true);
      assert.equal(buttons[0], 'Ablehnen');
      return choice;
    } };
    assert.equal(await unknownHostKeyDialog(window)(request), accepted);
  }
});
