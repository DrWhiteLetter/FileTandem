import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { ScpReader, parseHeader, remotePath, shellQuote, safeName, MAX_PROOF_BYTES } from '../../src/adapters/scp/protocol.js';
import { parseListing } from '../../src/adapters/scp/list.js';

test('SCP paths and quoting preserve literal shell characters and reject unsafe paths', () => {
  for (const name of ["a ' quote", 'ä " $() ` ; * ? [x]', '-option']) {
    assert.equal(safeName(name), true);
    assert.equal(remotePath(`/data/${name}`), `/data/${name}`);
  }
  assert.equal(shellQuote("a'b"), "'a'\\''b'");
  for (const path of ['relative', '/', '/data/../escape', '/data/./file', '/data//file', '/data/trailing/', '/data/a\nline', '/data/a\rline', '/data/a\0b', '/data/a\\b', '/data/\ud800']) assert.throws(() => remotePath(path), { code: 'UNSAFE_SCP_PATH' });
  assert.equal(remotePath('/', true), '/');
});

test('SCP file headers validate size, exact requested name and traversal', () => {
  assert.deepEqual(parseHeader("C0644 17 a ' quote", "a ' quote"), { size: 17, mode: '0644', name: "a ' quote" });
  for (const line of ['D0755 0 directory', 'T1 0 1 0', 'C0644 -1 file', 'C0644 1.2 file', 'C0644 01 file', 'C0999 1 file', 'C0644 1 ../file', 'C0644 1 /file', 'C0644 1 other', 'C0644 1 file\r']) assert.throws(() => parseHeader(line, 'file'), { code: 'INVALID_SCP_HEADER' });
  for (const size of [MAX_PROOF_BYTES + 1, '99999999999999999999999']) assert.throws(() => parseHeader(`C0644 ${size} file`, 'file'), { code: 'INVALID_SCP_SIZE' });
});

test('SCP reader handles every packet split and coalesced binary body/control bytes', async () => {
  const wire = Buffer.concat([Buffer.from('C0600 7 ä.bin\n'), Buffer.from([0, 1, 2, 10, 255, 67, 0]), Buffer.from([0])]);
  for (let split = 1; split < wire.length; split++) {
    const reader = new ScpReader(Readable.from([wire.subarray(0, split), wire.subarray(split)]));
    assert.equal((await reader.header('ä.bin')).size, 7);
    const chunks = []; let size = 0;
    while (size < 7) { const chunk = await reader.readSome(7 - size); chunks.push(chunk); size += chunk.length; }
    assert.deepEqual(Buffer.concat(chunks), Buffer.from([0, 1, 2, 10, 255, 67, 0]));
    await reader.ack(); await reader.eof();
  }
});

test('SCP reader rejects remote errors, bad ACK, oversized headers, UTF-8, EOF and trailing data', async () => {
  const reader = bytes => new ScpReader(Readable.from([Buffer.from(bytes)]));
  for (const status of [1, 2]) await assert.rejects(reader([status, ...Buffer.from('denied\n')]).ack(), { code: 'SCP_REMOTE_ERROR' });
  await assert.rejects(reader([3]).ack(), { code: 'INVALID_SCP_ACK' });
  await assert.rejects(reader('C0600 7 truncated').header('truncated'), { code: 'SCP_EOF' });
  await assert.rejects(reader('C' + 'x'.repeat(4096)).header('file'), { code: 'SCP_HEADER_LIMIT' });
  await assert.rejects(reader([67, 255, 10]).header('file'), { code: 'INVALID_SCP_UTF8' });
  await assert.rejects(reader('extra').eof(), { code: 'SCP_TRAILING_DATA' });
  await assert.rejects(reader('D0755 0 directory\n').header('directory'), { code: 'INVALID_SCP_HEADER' });
});

test('GNU-find metadata uses NUL fields; unsafe transfer names remain visibly marked', () => {
  const result = parseListing(Buffer.from(["a ' quote", 'f', '17', '1700000000.125', '644', '', 'line\nname', 'f', '0', '1700000000.0', '600', '', ''].join('\0')));
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "a ' quote"); assert.equal(result[0].transferable, true);
  assert.equal(result[1].name, 'line\nname'); assert.equal(result[1].transferable, false);
  for (const bytes of [Buffer.from('incomplete\0'), Buffer.from(['../file', 'f', '1', '1.0', '600', '', ''].join('\0')), Buffer.from([255, 0])]) assert.throws(() => parseListing(bytes), { code: 'INVALID_LISTING' });
});
