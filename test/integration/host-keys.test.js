import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { hostBundleOptions } from '../../scripts/build-options.mjs';
import { connectSsh } from '../../src/adapters/ssh/connect.js';
import { HostKeyStore, serverIdentity } from '../../src/adapters/ssh/host-keys.js';

const fixtureRoot = fileURLToPath(new URL('../fixtures/ssh/', import.meta.url));
const runtime = join(fixtureRoot, '.runtime');
const owner = createHash('sha256').update(fixtureRoot).digest('hex').slice(0, 12);
const base = Number(process.env.FILETANDEM_SSH_PORT_BASE ?? 22220);
const dockerArgs = process.env.FILETANDEM_DOCKER_CONTEXT ? ['--context', process.env.FILETANDEM_DOCKER_CONTEXT] : [];
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
const docker = args => run('docker', [...dockerArgs, ...args]);
function memory() {
  const records = new Map();
  return { records, trust: new HostKeyStore({ read: async id => records.get(id), write: async (id, value) => { records.set(id, value); } }) };
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(port) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const available = await new Promise(resolve => {
      const socket = net.connect({ host: '127.0.0.1', port });
      socket.setTimeout(500);
      socket.once('data', data => { socket.destroy(); resolve(data.toString().startsWith('SSH-')); });
      socket.once('error', () => resolve(false));
      socket.once('close', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    if (available) return;
    await pause(100);
  }
  throw new Error('Fixture did not restart.');
}

for (const [index, mode] of ['sftp', 'sftp-only', 'scp'].entries()) {
  test(`${mode}: rejection, trust, reconnection and real changed-key blockade`, { timeout: 30000 }, async () => {
    const port = base + index;
    const container = `filetandem-ssh-${owner}-${mode}`;
    const inspected = JSON.parse(docker(['container', 'inspect', container]))[0];
    assert.equal(inspected.Config.Labels['de.filetandem.fixture-owner'], owner, 'Only own fixture may be restarted');
    await ready(port);
    const privateKey = await readFile(join(runtime, 'client_ed25519'));
    const config = { host: '127.0.0.1', port, username: 'fixture', privateKey, readyTimeout: 5000 };
    const { records, trust } = memory();
    let prompts = 0;
    let received;
    await assert.rejects(connectSsh(config, { trust, confirmUnknown: async request => {
      prompts++;
      received = request;
      return false;
    } }), { code: 'HOST_KEY_REJECTED' });
    assert.equal(records.size, 0);
    const expectedFingerprint = run('ssh-keygen', ['-lf', join(runtime, 'servers', mode, 'host_ed25519.pub')]).split(' ')[1];
    assert.equal(received.fingerprint, expectedFingerprint, 'Fingerprint equals independent OpenSSH output');
    assert.equal(received.endpoint.port, port);
    const accepted = await connectSsh(config, { trust, confirmUnknown: async () => { prompts++; return true; } });
    assert.equal(accepted.hostKey.fingerprint, expectedFingerprint);
    await accepted.close();
    await accepted.closed;
    const known = await connectSsh(config, { trust, confirmUnknown: () => { throw new Error('Known key must not prompt.'); } });
    await known.close();
    assert.equal(prompts, 2);
    assert.equal(records.size, 1);
    // Neither rejection nor missing UI callback may implicitly accept another port.
    await assert.rejects(connectSsh(config, { trust: memory().trust }), { code: 'HOST_KEY_REJECTED' });
    const rotationPath = `/tmp/filetandem-rotated-hostkey-${randomUUID()}`;
    // Rotate inside the owned container, not through a host/VM bind-mount cache.
    try {
      docker(['exec', container, 'sh', '-c',
        `ssh-keygen -q -t ed25519 -N "" -C "FileTandem rotated TEST key" -f ${rotationPath} && install -m 600 ${rotationPath} /etc/ssh/ssh_host_ed25519_key && install -m 644 ${rotationPath}.pub /etc/ssh/ssh_host_ed25519_key.pub`]);
      const rotatedFingerprint = docker(['exec', container, 'ssh-keygen', '-lf', `${rotationPath}.pub`]).split(' ')[1];
      docker(['kill', '--signal', 'HUP', container]);
      await ready(port);
      await assert.rejects(connectSsh(config, { trust, confirmUnknown: () => { throw new Error('Changed key must not prompt.'); } }), error => {
        assert.equal(error.code, 'HOST_KEY_CHANGED');
        assert.equal(error.details.expected.fingerprint, expectedFingerprint);
        assert.equal(error.details.received.fingerprint, rotatedFingerprint);
        assert.notEqual(error.details.received.fingerprint, expectedFingerprint);
        return true;
      });
      assert.equal(records.get(serverIdentity(config.host, port).id).fingerprint, expectedFingerprint, 'Original trust remains unchanged');
    } finally {
      // Entrypoint resets config and copies the unchanged original fixture key.
      docker(['restart', container]);
      await ready(port);
    }
    const restored = await connectSsh(config, { trust, confirmUnknown: () => { throw new Error('Restored key must remain trusted.'); } });
    await restored.close();
  });
}

test('SSH cancellation and timeout close pending verification without late persistence', { timeout: 10000 }, async () => {
  const config = { host: '127.0.0.1', port: base, username: 'fixture', privateKey: await readFile(join(runtime, 'client_ed25519')), readyTimeout: 2000 };
  for (const kind of ['abort', 'timeout']) {
    const { records, trust } = memory();
    const controller = new AbortController();
    let consent;
    let presented;
    const dialog = new Promise(resolve => { presented = resolve; });
    const connecting = connectSsh({ ...config, readyTimeout: kind === 'timeout' ? 500 : 2000 }, { trust, signal: controller.signal,
      confirmUnknown: () => { presented(); return new Promise(resolve => { consent = resolve; }); } });
    const outcome = connecting.then(session => { void session.close(); return {}; }, error => ({ error }));
    await Promise.race([dialog, outcome.then(result => { throw result.error ?? new Error('Unexpected ready before consent'); })]);
    if (kind === 'abort') controller.abort();
    const result = await outcome;
    assert.equal(result.error?.code, kind === 'abort' ? 'CONNECTION_ABORTED' : 'CONNECTION_TIMEOUT');
    consent(true);
    await pause(20);
    assert.equal(records.size, 0, 'Late consent must not save trust');
  }
});

test('Host bundle authenticates with mandatory verification outside node_modules', { timeout: 10000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'filetandem-host-key-bundle-'));
  const output = join(directory, 'host-key.cjs');
  try {
    await build({ ...hostBundleOptions, bundle: true, outfile: output,
      stdin: { contents: "export { connectSsh } from './src/adapters/ssh/connect.js'; export { HostKeyStore } from './src/adapters/ssh/host-keys.js';",
        resolveDir: fileURLToPath(new URL('../../', import.meta.url)), sourcefile: 'host-key-bundle-smoke.js' } });
    const bundled = createRequire(import.meta.url)(output);
    const trust = new bundled.HostKeyStore({ read: async () => undefined, write: async () => {} });
    const config = { host: '127.0.0.1', port: base, username: 'fixture',
      privateKey: await readFile(join(runtime, 'client_ed25519')), readyTimeout: 5000 };
    await assert.rejects(bundled.connectSsh(config, { trust, confirmUnknown: async () => false }), { code: 'HOST_KEY_REJECTED' });
    const session = await bundled.connectSsh(config, { trust, confirmUnknown: async () => true });
    await session.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
