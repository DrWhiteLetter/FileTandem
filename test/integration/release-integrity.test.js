import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { releaseFixture,fixturePort,networkProxy } from '../helpers/release-fixture.mjs';
import { openRemoteFiles,targetFor,streamFor } from '../../src/application/remote-files.js';
import { localTarget } from '../../src/adapters/local/transfer-target.js';
import { transferFile } from '../../src/application/transfer-file.js';
import { TransferEngine } from '../../src/application/transfer-engine.js';
import { profileIdentity } from '../../src/application/transfer-resume.js';
import { streamFile } from '../../src/adapters/sftp/pipeline.js';
const transferStream=protocol => streamFor(protocol) ?? streamFile;
const hash=value => createHash('sha256').update(value).digest('hex');
const wait=async predicate => {const deadline=Date.now()+15000;while (!predicate()) {if (Date.now()>deadline) throw new Error('Transfer failed to settle after network loss');await new Promise(resolve => setTimeout(resolve,10));}};

for (const protocol of ['sftp','scp']) {
  test(`${protocol}: real TCP loss preserves destination; queue fails visibly and cleans only owned partial`,{timeout:25000},async () => {
    const directory=await mkdtemp(join(tmpdir(),'filetandem-network-')),name=randomUUID(),source=join(directory,name);
    const direct=await releaseFixture(protocol),files=await openRemoteFiles(direct,protocol),target=targetFor(files);
    const remote='/data/'+name,foreign='/data/.filetandem-foreign-'+name+'.part';
    const old=join(directory,'old'),foreignLocal=join(directory,'foreign');await writeFile(old,'old destination');await writeFile(foreignLocal,'foreign sentinel');await writeFile(source,Buffer.alloc(4*1024*1024,0x69));
    const stream=transferStream(protocol);await stream(direct,{direction:'upload',local:old,remote});await stream(direct,{direction:'upload',local:foreignLocal,remote:foreign});
    const proxy=await networkProxy(fixturePort(protocol));let transport=await releaseFixture(protocol,proxy.port),cut=false;
    const profile={id:'release',host:'127.0.0.1',port:proxy.port,username:'fixture',protocol};
    const engine=new TransferEngine({profiles:{get:() => profile},sessions:{transport:() => transport},choose:async () => ({choice:'replace'})});
    const run=engine.queue.run;engine.queue.run=(job,signal,progress) => run(job,signal,p => {progress(p);if (!cut && p.bytes>=262144) {cut=true;proxy.cut();}});
    try {
      const batch=await engine.submit(profile.id,'upload',[source],'/data');
      await wait(() => ['failed','cancelled'].includes(engine.queue.list().find(j => j.id===batch.ids[0])?.state));
      const failed=engine.queue.list().find(j => j.id===batch.ids[0]);assert.equal(failed.state,'failed');assert.ok(failed.error);assert.equal(failed.committed,undefined);assert.ok(failed.attempt);
      assert.equal(await target.hash(remote),hash('old destination'));assert.equal(await target.hash(foreign),hash('foreign sentinel'));
      await transport.close();transport=await releaseFixture(protocol,proxy.port);
      await engine.cleanup(failed.id);
      await assert.rejects(target.stat(failed.attempt.part));assert.equal(await target.hash(remote),hash('old destination'));assert.equal(await target.hash(foreign),hash('foreign sentinel'));
    } finally {engine.dispose();await transport.close();await proxy.close();for (const p of [remote,foreign,...engine.queue.list().map(j => j.attempt?.part).filter(Boolean)]) await target.remove(p).catch(() => {});files.close();await direct.close();await rm(directory,{recursive:true,force:true});}
  });

  test(`${protocol}: bounded remote filesystem really returns disk-full without publishing`,{timeout:20000},async () => {
    const session=await releaseFixture(protocol),files=await openRemoteFiles(session,protocol),target=targetFor(files),directory=await mkdtemp(join(tmpdir(),'filetandem-full-'));
    const root='/limited/'+randomUUID();await files.mkdir(root);
    const source=join(directory,'source'),old=join(directory,'old');await writeFile(source,Buffer.alloc(2*1024*1024,0x7c));await writeFile(old,'old destination');
    const remote=root+'/destination',id=randomUUID(),stream=transferStream(protocol);await stream(session,{direction:'upload',local:old,remote});
    try {
      await assert.rejects(transferFile(session,{id,protocol,direction:'upload',source,target:remote},{target,source:localTarget,identity:profileIdentity({host:'127.0.0.1',port:fixturePort(protocol),username:'fixture',protocol}),replace:true,stream}));
      assert.equal(await target.hash(remote),hash('old destination'));
      const part=await target.stat(target.partial(remote,id));assert.ok(part.size>0 && part.size<2*1024*1024,'real partial is limited by the 1 MiB tmpfs');
      assert.equal(hash(await readFile(source)),hash(Buffer.alloc(2*1024*1024,0x7c)));
    } finally {for (const p of [remote,target.partial(remote,id)]) await target.remove(p).catch(() => {});await files.call('rmdir',root);files.close();await session.close();await rm(directory,{recursive:true,force:true});}
  });

  test(`${protocol}: cancellation during finalization preserves old file; transport pause preserves hashes`,{timeout:20000},async () => {
    const proxy=await networkProxy(fixturePort(protocol)),session=await releaseFixture(protocol,proxy.port),files=await openRemoteFiles(session,protocol),target=targetFor(files);
    const directory=await mkdtemp(join(tmpdir(),'filetandem-finalize-')),source=join(directory,'source'),old=join(directory,'old'),remote='/data/'+randomUUID();
    await writeFile(source,Buffer.alloc(2*1024*1024+37,0x23));await writeFile(old,'old destination');const stream=transferStream(protocol);await stream(session,{direction:'upload',local:old,remote});
    const id=randomUUID(),controller=new AbortController();let prepared=false,paused;
    try {
      await assert.rejects(transferFile(session,{id,protocol,direction:'upload',source,target:remote},{target:{...target,prepare:async (...args) => {await target.prepare(...args);prepared=true;controller.abort();}},replace:true,stream,signal:controller.signal}));
      assert.equal(prepared,true);assert.equal(await target.hash(remote),hash('old destination'));await target.remove(target.partial(remote,id));
      const uploaded=await transferFile(session,{id,protocol,direction:'upload',source,target:remote},{target,replace:true,stream,onProgress:p => {if (!paused && p.bytes>=262144) paused=proxy.pause(500);}});
      await paused;assert.ok(paused);assert.equal(uploaded.sha256,hash(await readFile(source)));assert.equal(await target.hash(remote),uploaded.sha256);
    } finally {await paused;for (const p of [remote,target.partial(remote,id)]) await target.remove(p).catch(() => {});files.close();await session.close();await proxy.close();await rm(directory,{recursive:true,force:true});}
  });
}
