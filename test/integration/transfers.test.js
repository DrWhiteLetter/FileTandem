import { fixture } from '../helpers/transfer-fixture.mjs';
import { transferFile } from '../../src/application/transfer-file.js';
import { localTarget } from '../../src/adapters/local/transfer-target.js';
import { remoteTarget } from '../../src/adapters/sftp/transfer-target.js';
import test from 'node:test';import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';import { tmpdir } from 'node:os';import { randomUUID,createHash } from 'node:crypto';
import { connectSsh } from '../../src/adapters/ssh/connect.js';import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
import { RemoteFiles } from '../../src/adapters/sftp/files.js';import { streamFile,BUFFER_BYTES } from '../../src/adapters/sftp/pipeline.js';
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

test('finalization verifies target hashes and preserves old destinations on cancellation/conflict', {timeout:20000},async () => {
  const session=await fixture(),files=await RemoteFiles.open(session),directory=await mkdtemp(join(tmpdir(),'xscp-final-')),remote=`/data/m3-${randomUUID()}`;const id=randomUUID();
  const source=join(directory,'source');await writeFile(source,Buffer.alloc(1024*1024,0x73));
  try {
    await files.call('writeFile',remote,Buffer.from('old'));
    await assert.rejects(transferFile(session,{id,direction:'upload',source,target:remote},{target:remoteTarget(files)}));
    const signal=new AbortController();await assert.rejects(transferFile(session,{id,direction:'upload',source,target:remote},{target:remoteTarget(files),replace:true,signal:signal.signal,onProgress:() => signal.abort()}));
    assert.equal((await files.call('readFile',remote)).toString(),'old');
    await files.call('unlink',remoteTarget(files).partial(remote,id)).catch(() => {});
    const upload=await transferFile(session,{id,direction:'upload',source,target:remote},{target:remoteTarget(files),replace:true});assert.equal(upload.committed,true);
    const destination=join(directory,'download');await writeFile(destination,'old-local');
    const download=await transferFile(session,{id:randomUUID(),direction:'download',source:remote,target:destination},{target:localTarget,replace:true});assert.equal(download.sha256,upload.sha256);
  } finally {for (const p of [remote,remoteTarget(files).partial(remote,id)]) await files.call('unlink',p).catch(() => {});files.close();await session.close();await rm(directory,{recursive:true,force:true});}
});
test('recursive engine preserves binary bytes and empty directories; links are skipped', {timeout:20000},async () => {
  const {TransferEngine}=await import('../../src/application/transfer-engine.js');const {mkdir,symlink}=await import('node:fs/promises');
  const session=await fixture(),files=await RemoteFiles.open(session),directory=await mkdtemp(join(tmpdir(),'xscp-tree-')),name=`m3-${randomUUID()}`,root=join(directory,name);
  await mkdir(join(root,'nested','empty'),{recursive:true});await writeFile(join(root,'nested','binary'),Buffer.from([0,13,10,255,128]));await symlink('nested',join(root,'link'));
  const profile={id:'p',host:'127.0.0.1',port:Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+1,protocol:'sftp'};const engine=new TransferEngine({profiles:{get:() => profile},sessions:{transport:() => session},choose:async () => ({choice:'replace'})});
  try {await engine.submit('p','upload',[root],'/data');await engine.queue.idle();assert.ok(engine.queue.list().some(j => j.state === 'skipped'));assert.ok(engine.queue.list().every(j => ['completed','skipped'].includes(j.state)));assert.equal((await files.stat(`/data/${name}/nested/empty`)).kind,'directory');
    const download=join(directory,'download');await mkdir(download);await engine.submit('p','download',[`/data/${name}`],download);await engine.queue.idle();assert.deepEqual(await readFile(join(download,name,'nested','binary')),Buffer.from([0,13,10,255,128]));
  } finally {const {planRemoteDelete,executeRemoteDelete}=await import('../../src/application/remote-delete.js');await executeRemoteDelete(files,await planRemoteDelete(files,[`/data/${name}`]),() => true).catch(() => {});engine.dispose();files.close();await session.close();await rm(directory,{recursive:true,force:true});}
});
test('real engine conflict decisions preserve existing files and choose an unoccupied alternate', {timeout:20000},async () => {
 const {TransferEngine}=await import('../../src/application/transfer-engine.js');const session=await fixture(),files=await RemoteFiles.open(session),directory=await mkdtemp(join(tmpdir(),'xscp-conflicts-')),name='m3-'+randomUUID()+'.bin',source=join(directory,name),remote='/data/'+name;await writeFile(source,Buffer.from([0,13,10,255]));
 let choice='skip';const engine=new TransferEngine({profiles:{get:() => ({id:'p',host:'127.0.0.1',port:Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+1,protocol:'sftp'})},sessions:{transport:() => session},choose:async () => ({choice})});const alternate=remoteTarget(files).alternative(remote,2),kept=remoteTarget(files).alternative(remote,3);
 try {
 await files.call('writeFile',remote,Buffer.from('old'));await files.call('writeFile',alternate,Buffer.from('occupied'));
 for (const decision of ['skip','keep','cancel','replace']) {choice=decision;const batch=await engine.submit('p','upload',[source],'/data');await engine.queue.idle();const job=engine.queue.list().find(j => j.id===batch.ids[0]);assert.equal(job.state,decision==='skip' ? 'skipped':decision==='cancel' ? 'cancelled':'completed');if (decision!=='replace') assert.equal((await files.call('readFile',remote)).toString(),'old');if (decision==='keep') {assert.equal(job.finalTarget,kept);assert.deepEqual(await files.call('readFile',kept),await readFile(source));}}
 assert.deepEqual(await files.call('readFile',remote),await readFile(source));assert.equal((await files.call('readFile',alternate)).toString(),'occupied');
 } finally {engine.dispose();for (const p of [remote,alternate,kept]) await files.call('unlink',p).catch(() => {});files.close();await session.close();await rm(directory,{recursive:true,force:true});}
});
test('password and encrypted-key authentication transfer exact binary bytes in both directions', {timeout:20000},async () => {
 const {authMaterial,authPort}=await import('../helpers/auth.mjs');const material=await authMaterial();const directory=await mkdtemp(join(tmpdir(),'xscp-auth-transfer-'));const content=Buffer.from([0,255,13,10,128,1]);const source=join(directory,'source');await writeFile(source,content);
 try {for (const auth of [{password:material.password},{privateKey:material.encryptedEd25519,passphrase:material.passphrase}]) {
 const records=new Map(),session=await connectSsh({host:'127.0.0.1',port:authPort,username:'fixture',...auth},{trust:new HostKeyStore({read:async k => records.get(k),write:async (k,v) => records.set(k,v)}),confirmUnknown:async k => {assert.equal(k.key,material.expected);return true;}});const files=await RemoteFiles.open(session),remote='/data/m3-auth-'+randomUUID(),target=join(directory,randomUUID());
 try {const upload=await transferFile(session,{id:randomUUID(),direction:'upload',source,target:remote},{target:remoteTarget(files)});const download=await transferFile(session,{id:randomUUID(),direction:'download',source:remote,target},{target:localTarget});assert.equal(upload.sha256,download.sha256);assert.deepEqual(await readFile(target),content);} finally {await files.call('unlink',remote).catch(() => {});files.close();await session.close();}
 }} finally {await rm(directory,{recursive:true,force:true});}
});

test('borrowed SFTP stream channels survive success and isolate cancellation from other transfers', {timeout:20000},async()=>{
 const session=await fixture(),first=await RemoteFiles.open(session),second=await RemoteFiles.open(session),directory=await mkdtemp(join(tmpdir(),'xscp-borrowed-')),remote='/data/borrowed-'+randomUUID();
 const source=join(directory,'source');await writeFile(source,Buffer.alloc(2*1024*1024,0x57));
 try {
  const upload=await streamFile(session,{direction:'upload',local:source,remote,files:first});
  assert.equal(first.closed,false);assert.equal((await first.stat(remote)).size,upload.bytes);
  const download=await streamFile(session,{direction:'download',local:join(directory,'copy'),remote,files:first});assert.equal(download.sha256,upload.sha256);
  const controller=new AbortController();
  await assert.rejects(streamFile(session,{direction:'upload',local:source,remote:remote+'-abort',files:first,signal:controller.signal,onProgress:()=>controller.abort()}));
  assert.equal(first.closed,true);assert.equal(second.closed,false);assert.equal((await second.stat(remote)).size,upload.bytes);
 } finally {for(const path of [remote,remote+'-abort']) await second.call('unlink',path).catch(()=>{});first.close();second.close();await session.close();await rm(directory,{recursive:true,force:true});}
});

test('default SFTP upload performs no remote readback; downloads remain fully verified', {timeout:20000},async()=>{
 const {TransferEngine}=await import('../../src/application/transfer-engine.js');
 const session=await fixture(),files=await RemoteFiles.open(session),directory=await mkdtemp(join(tmpdir(),'xscp-fast-')),source=join(directory,'fast-'+randomUUID()),content=Buffer.alloc(128*1024+17,0x63);await writeFile(source,content);
 let reads=0;const counted={...session,sftp:callback=>session.sftp((error,channel)=>{if(channel){const read=channel.read.bind(channel);channel.read=(...args)=>{reads++;return read(...args);};}callback(error,channel);})};
 const profile={id:'p',host:'127.0.0.1',port:Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+1,protocol:'sftp'};
 const engine=new TransferEngine({profiles:{get:()=>profile},sessions:{transport:()=>counted},choose:async()=>({choice:'replace'})});let remote;
 try {
  const batch=await engine.submit('p','upload',[source],'/data');await engine.queue.idle();const job=engine.queue.get(batch.ids[0]);remote=job.target;
  assert.equal(job.state,'completed',job.error);assert.equal(job.verification,'size');assert.equal(reads,0);assert.deepEqual(await files.call('readFile',remote),content);
  const download=await engine.submit('p','download',[remote],directory);await engine.queue.idle();const downloaded=engine.queue.get(download.ids[0]);assert.equal(downloaded.state,'completed',downloaded.error);assert.equal(downloaded.verification,'sha256');assert.ok(reads>0);assert.deepEqual(await readFile(source),content);
 } finally {engine.dispose();if(remote)await files.call('unlink',remote).catch(()=>{});files.close();await session.close();await rm(directory,{recursive:true,force:true});}
});
