import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, open, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { hostBundleOptions } from '../../scripts/build-options.mjs';
import { connectSsh } from '../../src/adapters/ssh/connect.js';
import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
import { transferSftp, TRANSFER_BUFFER_BYTES } from '../../src/adapters/sftp/transfer.js';

const runtime = fileURLToPath(new URL('../fixtures/ssh/.runtime/', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const base = Number(process.env.XSCP_SSH_PORT_BASE ?? 22220);
const size = 32 * 1024 * 1024 + 137;
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function generate(path) {
  const file = await open(path, 'wx');
  try {
    const chunk = randomBytes(64 * 1024);
    for (let offset = 0; offset < size; offset += chunk.length) await file.write(chunk.subarray(0, Math.min(chunk.length, size - offset)));
  } finally { await file.close(); }
}
async function connection(index, api = { connectSsh, HostKeyStore }) {
  const expected = (await readFile(join(runtime, 'servers', ['sftp', 'sftp-only', 'scp'][index], 'host_ed25519.pub'), 'utf8')).split(' ')[1];
  const records = new Map();
  return api.connectSsh({ host: '127.0.0.1', port: base + index, username: 'fixture',
    privateKey: await readFile(join(runtime, 'client_ed25519')), readyTimeout: 5000 }, {
    trust: new api.HostKeyStore({ read: async id => records.get(id), write: async (id, value) => records.set(id, value) }),
    confirmUnknown: async key => { assert.equal(key.key, expected); return true; },
  });
}
function observe(session) {
  const streams = [];
  let closed = false;
  session.closed.then(() => { closed = true; });
  return { streams, get closed() { return closed; }, session: {
    closed: session.closed, close: () => session.close(),
    exec: () => { throw new Error('No shell/exec allowed in SFTP adapter'); },
    sftp(callback) { session.sftp((error, channel) => {
      if (channel) for (const method of ['createReadStream', 'createWriteStream']) {
        const original = channel[method].bind(channel);
        channel[method] = (...args) => { const stream = original(...args); streams.push(stream); return stream; };
      }
      callback(error, channel);
    }); },
  } };
}
function cleanupChecked(observed) {
  assert.equal(observed.closed, true, 'SSH transport closed before promise settles');
  assert.equal(observed.streams.length, 1);
  for (const stream of observed.streams) {
    assert.equal(stream.destroyed, true, 'Remote stream destroyed');
    assert.equal(stream.isClosed, true, 'Remote handle close completed');
  }
}
async function remoteRemove(index, paths) {
  const session = await connection(index);
  try {
    const sftp = await new Promise((resolve, reject) => session.sftp((error, channel) => error ? reject(error) : resolve(channel)));
    for (const path of paths) await new Promise(resolve => sftp.unlink(path, () => resolve()));
    sftp.end();
  } finally { await session.close(); }
}

for (const index of [0, 1]) test(`${index === 0 ? 'SFTP' : 'SFTP-only'}: streamed hashes, empty files, abort both ways and errors`, { timeout: 120000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xscp-sftp-'));
  const remote = `/data/Streaming ä ' quote ${randomUUID()}.bin`;
  const partial = `${remote}.partial`;
  try {
    const source = join(directory, 'source.bin');
    await generate(source);
    const expected = await digest(source);
    for (const direction of ['upload', 'download']) {
      const observed = observe(await connection(index));
      let chunks = 0;
      const result = await transferSftp(observed.session, { direction, localPath: direction === 'upload' ? source : join(directory, 'download.bin'), remotePath: remote,
        onProgress: ({ chunkBytes }) => { chunks++; assert.ok(chunkBytes <= TRANSFER_BUFFER_BYTES); } });
      assert.deepEqual(result, { bytes: size, sha256: expected });
      assert.ok(chunks > 500, 'Many bounded chunks, not a whole-file buffer');
      cleanupChecked(observed);
    }
    assert.equal(await digest(join(directory, 'download.bin')), expected);
    // Independent OpenSSH SFTP client reads the actual remote file.
    const independent = join(directory, 'independent.bin');
    const result = spawnSync('sftp', ['-q', '-F', join(runtime, 'ssh_config'), '-b', '-', index === 0 ? 'xscp-fixture-sftp' : 'xscp-fixture-sftp-only'], {
      input: `get "${remote}" "${independent}"\n`, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await digest(independent), expected);
    for (const direction of ['upload', 'download']) {
      const controller = new AbortController();
      const observed = observe(await connection(index));
      let bytes = 0;
      const destination = join(directory, 'cancelled.bin');
      await assert.rejects(transferSftp(observed.session, { direction, localPath: direction === 'upload' ? source : destination,
        remotePath: direction === 'upload' ? partial : remote, signal: controller.signal,
        onProgress: progress => { bytes = progress.bytes; if (bytes >= 256 * 1024) controller.abort(); },
      }), error => error.name === 'AbortError');
      assert.ok(bytes >= 256 * 1024 && bytes < size);
      cleanupChecked(observed);
      if (direction === 'download') {
        assert.ok((await stat(destination)).size < size);
        await rm(destination); // Local descriptor released too.
      }
    }
    const empty = join(directory, 'empty');
    await writeFile(empty, '');
    for (const direction of ['upload', 'download']) {
      const observed = observe(await connection(index));
      assert.deepEqual(await transferSftp(observed.session, { direction, localPath: direction === 'upload' ? empty : `${empty}.download`, remotePath: `${remote}.empty` }), {
        bytes: 0, sha256: createHash('sha256').digest('hex'),
      });
      cleanupChecked(observed);
    }
    // Exclusive creation preserves an existing destination.
    const occupied = observe(await connection(index));
    await assert.rejects(transferSftp(occupied.session, { direction: 'upload', localPath: source, remotePath: remote }));
    cleanupChecked(occupied);
    const preserved = join(directory, 'preserved');
    await writeFile(preserved, 'existing destination');
    const localOccupied = observe(await connection(index));
    await assert.rejects(transferSftp(localOccupied.session, { direction: 'download', localPath: preserved, remotePath: remote }), { code: 'EEXIST' });
    cleanupChecked(localOccupied);
    assert.equal(await readFile(preserved, 'utf8'), 'existing destination');
    const unchanged = observe(await connection(index));
    assert.equal((await transferSftp(unchanged.session, { direction: 'download', localPath: join(directory, 'after-collision'), remotePath: remote })).sha256, expected);
    cleanupChecked(unchanged);
    const missing = observe(await connection(index));
    await assert.rejects(transferSftp(missing.session, { direction: 'download', localPath: join(directory, 'missing'), remotePath: `${remote}.nonexistent` }));
    cleanupChecked(missing);
    const preAbort = observe(await connection(index));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(transferSftp(preAbort.session, { direction: 'upload', localPath: source, remotePath: partial, signal: controller.signal }), { name: 'AbortError' });
    assert.equal(preAbort.closed, true);
    assert.equal(preAbort.streams.length, 0);
    console.log(`${index === 0 ? 'SFTP' : 'SFTP-only'}: ${size} bytes, SHA-256 ${expected}; abort upload/download closes stream and SSH.`);
  } finally {
    await remoteRemove(index, [remote, partial, `${remote}.empty`]);
    await rm(directory, { recursive: true, force: true });
  }
});

test('bundled SFTP adapter works without node_modules', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xscp-sftp-bundle-'));
  try {
    const output = join(directory, 'sftp.cjs');
    await build({ ...hostBundleOptions, bundle: true, outfile: output, stdin: { resolveDir: root,
      contents: "export { transferSftp } from './src/adapters/sftp/transfer.js'; export { connectSsh } from './src/adapters/ssh/connect.js'; export { HostKeyStore } from './src/adapters/ssh/host-keys.js';" } });
    const api = createRequire(import.meta.url)(output);
    const source = join(directory, 'source'); await writeFile(source, randomBytes(131073));
    const remote = `/data/bundle-${randomUUID()}`;
    try {
      const uploaded = await api.transferSftp(await connection(1, api), { direction: 'upload', localPath: source, remotePath: remote });
      const downloaded = await api.transferSftp(await connection(1, api), { direction: 'download', localPath: `${source}.download`, remotePath: remote });
      assert.deepEqual(downloaded, uploaded);
      assert.equal(await digest(`${source}.download`), await digest(source));
    } finally { await remoteRemove(1, [remote]); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('SCP-only rejects SFTP without shell fallback and closes SSH', { timeout: 10000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xscp-no-sftp-'));
  const observed = observe(await connection(2));
  try {
    await assert.rejects(transferSftp(observed.session, { direction: 'download', localPath: join(directory, 'file'), remotePath: '/data/file' }), /subsystem/i);
    assert.equal(observed.closed, true);
    assert.equal(observed.streams.length, 0);
  } finally { await observed.session.close(); await rm(directory, { recursive: true, force: true }); }
});
