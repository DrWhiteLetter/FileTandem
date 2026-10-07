import test from 'node:test';import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';import { tmpdir } from 'node:os';import { randomUUID,createHash } from 'node:crypto';
import { runtime } from '../helpers/auth.mjs';import { connectSsh } from '../../src/adapters/ssh/connect.js';import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
import { RemoteFiles } from '../../src/adapters/sftp/files.js';import { streamFile,BUFFER_BYTES } from '../../src/adapters/sftp/pipeline.js';
export async function fixture() {
  const expected=(await readFile(join(runtime,'servers/sftp-only/host_ed25519.pub'),'utf8')).split(' ')[1];const records=new Map();
  return connectSsh({host:'127.0.0.1',port:Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+1,username:'fixture',privateKey:await readFile(join(runtime,'client_ed25519')),readyTimeout:5000},{trust:new HostKeyStore({read:async k => records.get(k),write:async (k,v) => records.set(k,v)}),confirmUnknown:async k => {assert.equal(k.key,expected);return true;}});
}
test('bounded SFTP pipeline is bidirectional, byte exact, cancellable and independent of browser', {timeout:30000},async () => {
  const session=await fixture(),files=await RemoteFiles.open(session),directory=await mkdtemp(join(tmpdir(),'xscp-stream-')),remote=`/data/m3-${randomUUID()}`;
  const content=Buffer.alloc(16*1024*1024+137,0x92);const expected=createHash('sha256').update(content).digest('hex');const local=join(directory,'source');await writeFile(local,content);
  try {
    let navigation;const uploaded=await streamFile(session,{direction:'upload',local,remote,onProgress:p => {assert.ok(p.chunkBytes <= BUFFER_BYTES);navigation ??= files.list('/data');}});
    assert.equal(uploaded.sha256,expected);assert.ok((await navigation).entries.length);
    const downloaded=await streamFile(session,{direction:'download',local:join(directory,'download'),remote});assert.equal(downloaded.sha256,expected);assert.equal(downloaded.bytes,content.length);
    const controller=new AbortController();await assert.rejects(streamFile(session,{direction:'upload',local,remote:remote+'-abort',signal:controller.signal,onProgress:() => controller.abort()}));
    assert.ok((await files.list('/data')).entries.length,'Cancellation preserves browser transport');
  } finally {for (const path of [remote,remote+'-abort']) await files.call('unlink',path).catch(() => {});files.close();await session.close();await rm(directory,{recursive:true,force:true});}
});
