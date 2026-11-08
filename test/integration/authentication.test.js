import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { connectSsh } from '../../src/adapters/ssh/connect.js';
import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
import { authMaterial, authPort, runtime, startTestAgent } from '../helpers/auth.mjs';

function policy(material, extra = {}) {
  const records = new Map();
  return { trust: new HostKeyStore({ read: async id => records.get(id), write: async (id, value) => records.set(id, value) }),
    confirmUnknown: async key => { assert.equal(key.key, material.expected); return true; }, ...extra };
}
const config = options => ({ host: '127.0.0.1', port: authPort, username: 'fixture', readyTimeout: 5000, ...options });
async function probe(material, options) {
  const session = await connectSsh(config(options), policy(material));
  try {
    assert.equal(session.hostKey.key, material.expected);
    // Prove authenticated SFTP access rather than merely an SSH handshake.
    const channel = await new Promise((resolve, reject) => session.sftp((error, channel) => error ? reject(error) : resolve(channel)));
    const entries = await new Promise((resolve, reject) => channel.readdir('/data', (error, entries) => error ? reject(error) : resolve(entries)));
    assert.ok(entries.some(entry => entry.filename === 'server-marker.txt')); channel.end();
  } finally { await session.close(); await session.closed; }
}

test('OpenSSH/PAM auth matrix: password, Ed25519/RSA and encrypted OpenSSH keys', { timeout: 60000 }, async () => {
  const material = await authMaterial();
  for (const [name, options] of [
    ['password', { password: material.password }],
    ['Ed25519', { privateKey: material.ed25519 }],
    ['RSA-3072', { privateKey: material.rsa }],
    ['encrypted Ed25519', { privateKey: material.encryptedEd25519, passphrase: material.passphrase }],
    ['encrypted RSA-3072', { privateKey: material.encryptedRsa, passphrase: material.passphrase }],
  ]) { await probe(material, options); console.log(`${name}: authenticated SFTP access passed`); }
  for (const options of [{ password: 'intentionally-wrong-fixture-password' }, { privateKey: material.encryptedEd25519, passphrase: 'wrong-fixture-passphrase' }, { privateKey: material.encryptedRsa }, {}]) {
    await assert.rejects(connectSsh(config(options), policy(material)));
  }
  const context = process.env.FILETANDEM_DOCKER_CONTEXT ? ['--context', process.env.FILETANDEM_DOCKER_CONTEXT] : [];
  // OpenSSH defaults exclude RSA/SHA-1. Verify server policy independently.
  const root = join(runtime, '..') + '/';
  const { createHash } = await import('node:crypto');
  const owner = createHash('sha256').update(root).digest('hex').slice(0, 12);
  const result = spawnSync('docker', [...context, 'exec', `filetandem-ssh-${owner}-auth`, 'sshd', '-T'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  const algorithms = result.stdout.match(/^pubkeyacceptedalgorithms (.+)$/m)[1].split(',');
  assert.ok(algorithms.includes('rsa-sha2-256')); assert.ok(algorithms.includes('rsa-sha2-512')); assert.ok(!algorithms.includes('ssh-rsa'));
});

test('Real isolated Unix agent signs Ed25519 and RSA; missing/empty agents fail', { timeout: 30000 }, async () => {
  const material = await authMaterial(); const agent = await startTestAgent(material);
  try {
    for (const filename of ['encrypted_ed25519', 'encrypted_rsa']) { agent.loadKey(filename); await probe(material, { agent: agent.socket }); }
    await assert.rejects(connectSsh(config({ agent: `${agent.socket}.missing` }), policy(material)));
    const cleared = spawnSync('ssh-add', ['-D'], { env: { ...process.env, SSH_AUTH_SOCK: agent.socket }, encoding: 'utf8', timeout: 10000 });
    assert.equal(cleared.status, 0);
    await assert.rejects(connectSsh(config({ agent: agent.socket }), policy(material)));
  } finally { await agent.stop(); }
});

test('PAM keyboard-interactive succeeds, rejects bad replies and host-key denial suppresses prompts', { timeout: 30000 }, async () => {
  const material = await authMaterial(); let rounds = 0;
  await probe(material, { keyboardInteractive: async request => {
    rounds++; assert.ok(request.prompts.length > 0); assert.equal(request.prompts[0].echo, false);
    assert.equal(request.endpoint.port, authPort); return request.prompts.map(() => material.password);
  } }); assert.ok(rounds > 0);
  await assert.rejects(connectSsh(config({ keyboardInteractive: async request => request.prompts.map(() => 'wrong-fixture-answer') }), policy(material)), /authentication methods failed/i);
  await assert.rejects(connectSsh(config({ keyboardInteractive: async () => undefined }), policy(material)), { code: 'INVALID_AUTH_RESPONSE' });
  let calls = 0;
  await assert.rejects(connectSsh(config({ keyboardInteractive: async () => { calls++; return []; } }), policy(material, { confirmUnknown: async () => false })), { code: 'HOST_KEY_REJECTED' });
  assert.equal(calls, 0);
});

test('Pending keyboard challenge: abort/timeout close SSH, late replies cannot authenticate', { timeout: 10000 }, async () => {
  const material = await authMaterial();
  for (const kind of ['abort', 'timeout']) {
    const controller = new AbortController(); let answer; let present;
    const presented = new Promise(resolve => { present = resolve; }); let ready = false;
    const pending = connectSsh(config({ readyTimeout: kind === 'timeout' ? 700 : 5000,
      keyboardInteractive: request => { assert.equal(request.signal.aborted, false); present(); return new Promise(resolve => { answer = resolve; }); },
    }), policy(material, { signal: controller.signal })).then(async session => { ready = true; await session.close(); return {}; }, error => ({ error }));
    await Promise.race([presented, pending.then(result => { throw result.error ?? new Error('Unexpected authentication without reply.'); })]);
    if (kind === 'abort') controller.abort();
    const result = await pending; assert.equal(result.error.code, kind === 'abort' ? 'CONNECTION_ABORTED' : 'CONNECTION_TIMEOUT');
    answer([material.password]); await new Promise(resolve => setImmediate(resolve)); assert.equal(ready, false);
  }
});
