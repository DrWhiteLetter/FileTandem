import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { open, readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { connectSsh } from '../../src/adapters/ssh/connect.js';
import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
import { transferScp } from '../../src/adapters/scp/transfer.js';
import { listScp } from '../../src/adapters/scp/list.js';
import { shellQuote } from '../../src/adapters/scp/protocol.js';
import { hostBundleOptions } from '../../scripts/build-options.mjs';

const runtime = fileURLToPath(new URL('../fixtures/ssh/.runtime/', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const base = Number(process.env.XSCP_SSH_PORT_BASE ?? 22220);
const size = 16 * 1024 * 1024 + 137;
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function connection(index = 2, api = { connectSsh, HostKeyStore }) {
  const expected = (await readFile(join(runtime, 'servers', ['sftp', 'sftp-only', 'scp'][index], 'host_ed25519.pub'), 'utf8')).split(' ')[1];
  const records = new Map();
  return api.connectSsh({ host: '127.0.0.1', port: base + index, username: 'fixture', privateKey: await readFile(join(runtime, 'client_ed25519')), readyTimeout: 5000 }, {
    trust: new api.HostKeyStore({ read: async id => records.get(id), write: async (id, value) => records.set(id, value) }),
    confirmUnknown: async key => { assert.equal(key.key, expected); return true; },
  });
}
function independent(command) {
  const result = spawnSync('ssh', ['-F', join(runtime, 'ssh_config'), 'xscp-fixture-scp', command], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
}
function observe(session) {
  let closed = false; const channels = []; const commands = []; const closedChannels = new Set();
  session.closed.then(() => { closed = true; });
  return { get closed() { return closed; }, channels, commands, closedChannels, session: {
    closed: session.closed, close: () => session.close(),
    sftp() { throw new Error('SCP adapter must never request SFTP'); },
    exec(command, options, callback) {
      commands.push(command);
      assert.equal(options.pty, false);
      session.exec(command, options, (error, stream) => { if (stream) { channels.push(stream); stream.once('close', () => closedChannels.add(stream)); } callback(error, stream); });
    },
  } };
}
function cleanupChecked(probe) {
  assert.equal(probe.closed, true, 'SSH transport closed before operation settles');
  for (const channel of probe.channels) assert.ok(probe.closedChannels.has(channel), 'Exec channel close event observed');
}

test('real legacy SCP without SFTP: hashes, quoted names, listing, collisions and abort', { timeout: 120000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xscp-scp-'));
  const remoteDir = `/data/SCP ä ' " $() ; ${randomUUID()}`;
  const name = "payload ' \" $(touch INJECTION) `touch INJECTION2` ; [*].bin";
  const remote = `${remoteDir}/${name}`;
  const cliRemote = `/data/scp-cli-${randomUUID()}`;
  independent(`mkdir -- ${shellQuote(remoteDir)}`);
  try {
    const subsystem = await connection();
    try {
      await assert.rejects(new Promise((resolve, reject) => subsystem.sftp((error, channel) => error ? reject(error) : resolve(channel))), /subsystem/i);
    } finally { await subsystem.close(); }
    const source = join(directory, 'source.bin'); const file = await open(source, 'wx');
    try {
      const chunk = randomBytes(64 * 1024);
      for (let offset = 0; offset < size; offset += chunk.length) await file.write(chunk.subarray(0, Math.min(chunk.length, size - offset)));
    } finally { await file.close(); }
    const expected = await digest(source);
    for (const direction of ['upload', 'download']) {
      const observed = observe(await connection()); let chunks = 0;
      const result = await transferScp(observed.session, { direction, localPath: direction === 'upload' ? source : join(directory, 'download.bin'), remotePath: remote,
        onProgress: ({ chunkBytes }) => { chunks++; assert.ok(chunkBytes <= 64 * 1024); } });
      assert.deepEqual(result, { bytes: size, sha256: expected }); assert.ok(chunks > 250);
      assert.ok(observed.commands[0].includes(direction === 'upload' ? 'scp -t --' : 'scp -f --')); cleanupChecked(observed);
    }
    assert.equal(await digest(join(directory, 'download.bin')), expected);
    const independentHash = independent(`sha256sum -- ${shellQuote(remote)}`).split(' ')[0];
    assert.equal(independentHash, expected);
    independent(`cp -- ${shellQuote(remote)} ${shellQuote(cliRemote)}`);
    const cliCopy = join(directory, 'legacy-cli.bin');
    const cli = spawnSync('scp', ['-O', '-F', join(runtime, 'ssh_config'), `xscp-fixture-scp:${cliRemote}`, cliCopy], { encoding: 'utf8', timeout: 30000 });
    assert.equal(cli.status, 0, cli.stderr); assert.equal(await digest(cliCopy), expected);
    // No expansions or injected commands ran; all metacharacters are literal.
    independent('test ! -e /home/fixture/INJECTION && test ! -e /home/fixture/INJECTION2');
    const unsafe = `${remoteDir}/line\nname`;
    independent(`mkdir -- ${shellQuote(`${remoteDir}/directory`)} && ln -s -- ${shellQuote(name)} ${shellQuote(`${remoteDir}/symlink`)} && : > ${shellQuote(unsafe)}`);
    const listing = observe(await connection());
    const entries = await listScp(listing.session, { path: remoteDir }); cleanupChecked(listing);
    const entry = entries.find(entry => entry.name === name);
    assert.equal(entry.size, size); assert.equal(entry.type, 'f'); assert.equal(entry.transferable, true); assert.equal(entry.mode, '600');
    assert.ok(Number.isFinite(entry.mtime));
    assert.equal(entries.find(entry => entry.name === 'line\nname').transferable, false);
    assert.equal(entries.find(entry => entry.name === 'symlink').linkTarget, name);
    assert.equal(entries.find(entry => entry.name === 'symlink').transferable, false);
    assert.equal(entries.find(entry => entry.name === 'directory').type, 'd');
    assert.equal(entries.length, 4);
    const blocked = observe(await connection());
    await assert.rejects(transferScp(blocked.session, { direction: 'upload', localPath: source, remotePath: unsafe }), { code: 'UNSAFE_SCP_PATH' });
    assert.equal(blocked.commands.length, 0); cleanupChecked(blocked);
    const occupied = observe(await connection());
    await assert.rejects(transferScp(occupied.session, { direction: 'upload', localPath: source, remotePath: remote })); cleanupChecked(occupied);
    assert.equal(independent(`sha256sum -- ${shellQuote(remote)}`).split(' ')[0], expected);
    const existing = join(directory, 'existing'); await writeFile(existing, 'preserve me');
    const localOccupied = observe(await connection());
    await assert.rejects(transferScp(localOccupied.session, { direction: 'download', localPath: existing, remotePath: remote }), { code: 'EEXIST' });
    assert.equal(await readFile(existing, 'utf8'), 'preserve me'); cleanupChecked(localOccupied);
    for (const direction of ['upload', 'download']) {
      const observed = observe(await connection()); const controller = new AbortController(); let bytes = 0;
      const destination = join(directory, 'cancelled.bin');
      await assert.rejects(transferScp(observed.session, { direction, localPath: direction === 'upload' ? source : destination,
        remotePath: direction === 'upload' ? `${remoteDir}/partial` : remote, signal: controller.signal,
        onProgress: progress => { bytes = progress.bytes; if (bytes >= 256 * 1024) controller.abort(); },
      }), { name: 'AbortError' });
      assert.ok(bytes >= 256 * 1024 && bytes < size); cleanupChecked(observed);
      if (direction === 'download') { assert.ok((await stat(destination)).size < size); await rm(destination); }
    }
    const empty = join(directory, 'empty'); await writeFile(empty, '');
    for (const direction of ['upload', 'download']) {
      const observed = observe(await connection());
      assert.deepEqual(await transferScp(observed.session, { direction, localPath: direction === 'upload' ? empty : `${empty}.download`, remotePath: `${remoteDir}/empty` }), {
        bytes: 0, sha256: createHash('sha256').digest('hex'),
      }); cleanupChecked(observed);
    }
    const missing = observe(await connection());
    await assert.rejects(transferScp(missing.session, { direction: 'download', localPath: join(directory, 'missing'), remotePath: `${remoteDir}/nonexistent` }), { code: 'SCP_REMOTE_ERROR' }); cleanupChecked(missing);
    console.log(`SCP-only: ${size} bytes, SHA-256 ${expected}; direct scp -t/-f, GNU-find, quote/injection and abort tests passed.`);
  } finally { independent(`rm -rf -- ${shellQuote(remoteDir)} && rm -f -- ${shellQuote(cliRemote)}`); await rm(directory, { recursive: true, force: true }); }
});

test('SFTP-only rejects SCP and GNU listing, no fallback; cancelled and timed-out Exec closes', { timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xscp-scp-negative-'));
  try {
    const source = join(directory, 'file'); await writeFile(source, 'probe');
    for (const kind of ['transfer', 'listing']) {
      const observed = observe(await connection(1));
      const operation = kind === 'transfer'
        ? transferScp(observed.session, { direction: 'upload', localPath: source, remotePath: `/data/no-scp-${randomUUID()}`, timeout: 2000 })
        : listScp(observed.session, { path: '/data', timeout: 2000 });
      await assert.rejects(operation); cleanupChecked(observed);
    }
    const noTools = observe(await connection());
    const restricted = { ...noTools.session, exec: (command, options, callback) => noTools.session.exec(`PATH=/nonexistent; ${command}`, options, callback) };
    await assert.rejects(listScp(restricted, { path: '/data' }), error => error.code === 'SCP_EXEC_FAILED' && /GNU find\/coreutils/.test(error.message));
    cleanupChecked(noTools);
    const cancelled = observe(await connection()); const controller = new AbortController(); controller.abort();
    await assert.rejects(transferScp(cancelled.session, { direction: 'upload', localPath: source, remotePath: '/data/cancelled', signal: controller.signal }), { name: 'AbortError' });
    assert.equal(cancelled.commands.length, 0); cleanupChecked(cancelled);
    // Test a real nonresponding exec channel through the same adapter lifecycle.
    const stalled = observe(await connection());
    const session = { ...stalled.session, exec: (_command, options, callback) => stalled.session.exec('exec sleep 10', options, callback) };
    await assert.rejects(transferScp(session, { direction: 'upload', localPath: source, remotePath: '/data/not-created', timeout: 200 }), { code: 'SCP_TIMEOUT' });
    cleanupChecked(stalled);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('bundled SCP and GNU-list adapter work outside node_modules', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xscp-scp-bundle-')); const remote = `/data/scp-bundle-${randomUUID()}`;
  try {
    const output = join(directory, 'scp.cjs');
    await build({ ...hostBundleOptions, bundle: true, outfile: output, stdin: { resolveDir: root,
      contents: "export { transferScp } from './src/adapters/scp/transfer.js'; export { listScp } from './src/adapters/scp/list.js'; export { connectSsh } from './src/adapters/ssh/connect.js'; export { HostKeyStore } from './src/adapters/ssh/host-keys.js';" } });
    const api = createRequire(import.meta.url)(output); const source = join(directory, 'source'); await writeFile(source, randomBytes(131073));
    const up = await api.transferScp(await connection(2, api), { direction: 'upload', localPath: source, remotePath: remote });
    const down = await api.transferScp(await connection(2, api), { direction: 'download', localPath: `${source}.download`, remotePath: remote });
    assert.deepEqual(down, up); assert.equal(await digest(`${source}.download`), await digest(source));
    assert.ok((await api.listScp(await connection(2, api), { path: '/data' })).some(entry => entry.name === remote.slice('/data/'.length)));
  } finally { independent(`rm -f -- ${shellQuote(remote)}`); await rm(directory, { recursive: true, force: true }); }
});
