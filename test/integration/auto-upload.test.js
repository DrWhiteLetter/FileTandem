import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,rm,realpath,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID,createHash } from 'node:crypto';
import { releaseFixture,fixturePort } from '../helpers/release-fixture.mjs';
import { AutoUploadService } from '../../src/application/auto-upload-service.js';
import {filePolicy} from '../../src/application/file-policy.js';
import { TransferEngine } from '../../src/application/transfer-engine.js';
import { openRemoteFiles,targetFor,streamFor } from '../../src/application/remote-files.js';
import { transferFile } from '../../src/application/transfer-file.js';
import { planRemoteDelete,executeRemoteDelete } from '../../src/application/remote-delete.js';
const hash=value => createHash('sha256').update(value).digest('hex');
const wait=async predicate => {const deadline=Date.now()+10000;while (!predicate()) {if (Date.now()>deadline) throw new Error('Automatic upload timeout');await new Promise(resolve => setTimeout(resolve,25));}};
for (const protocol of ['sftp','scp']) test(`${protocol}: automatic external saves, nested creation, conflict preservation and stop`,{timeout:40000},async () => {
  const session=await releaseFixture(protocol),files=await openRemoteFiles(session,protocol),directory=await realpath(await mkdtemp(join(tmpdir(),'filetandem-auto-'))),root=join(directory,'local'),remote='/data/auto-'+randomUUID();
  const profile={id:'auto',host:'127.0.0.1',port:fixturePort(protocol),username:'fixture',protocol};let connected=true,dialogs=0,stopOnProgress=false;
  const sessions={transport:() => session,snapshot:() => ({state:connected ? 'connected':'disconnected'}),matches:() => true},profiles={get:() => profile};
  const engine=new TransferEngine({sessions,profiles,choose:async () => {dialogs++;return {choice:'replace'};},onChange:jobs => {if (stopOnProgress && jobs.some(job => job.automatic && job.state==='running' && job.bytes>0)) {stopOnProgress=false;service.stop(profile.id);}}}),service=new AutoUploadService({getPolicy:()=>filePolicy({backupRemoteDeletes:false}),engine,sessions,profiles,guard:() => {}});
  const activate=async () => {const monitor=await service.start({profileId:profile.id,localRoot:root,remoteRoot:remote,owner:'test'});clearTimeout(monitor.timer);monitor.interval=25;monitor.schedule();return monitor;};
  try {
    await mkdir(root);await files.mkdir(remote);await writeFile(join(root,'existing'),'1111');await engine.submit(profile.id,'upload',[join(root,'existing')],remote);await engine.queue.idle();
    await writeFile(join(directory,'test.txt'),'remote-only');await engine.submit(profile.id,'upload',[join(directory,'test.txt')],remote);await engine.queue.idle();
    const monitor=await activate();
    await assert.rejects(files.stat(remote+'/test.txt'),error => ['ENOENT',2].includes(error.code));assert.equal(monitor.state.deleted,1,'initial mirror deletes remote-only test.txt');await monitor.tick();assert.equal(monitor.state.uploaded,0,'identical files are verified without redundant uploads');
    await assert.rejects(engine.submit(profile.id,'download',[remote+'/existing'],directory),/Automatischer Upload/);
    await assert.rejects(engine.submit(profile.id,'upload',[join(root,'existing')],remote),/Automatischer Upload/);
    await writeFile(join(root,'temporary'),'2222');await rename(join(root,'temporary'),join(root,'existing'));
    await wait(() => monitor.state.uploaded===1 || monitor.stopped);assert.equal(monitor.state.error,'');assert.equal(await targetFor(files).hash(remote+'/existing'),hash('2222'));assert.equal(dialogs,0,'approved automatic replacements need no per-save dialogs');
    await mkdir(join(root,'nested'));await writeFile(join(root,'nested','new'),Buffer.from([0,255,13,10]));
    await wait(() => monitor.state.uploaded===2 || monitor.stopped);assert.equal(monitor.state.error,'');assert.equal(await targetFor(files).hash(remote+'/nested/new'),hash(Buffer.from([0,255,13,10])));
    await rm(join(root,'nested','new'));
    await wait(() => monitor.state.deleted===2 || monitor.stopped);assert.equal(monitor.state.error,'');
    await assert.rejects(files.stat(remote+'/nested/new'),error => ['ENOENT',2].includes(error.code));
    assert.equal((await files.stat(remote+'/nested')).kind,'directory','empty remote directories are preserved');
    // External writer restores size, mode and mtime: subsequent upload must still catch the changed hash.
    const metadata=await files.stat(remote+'/existing'),external=join(directory,'external');await writeFile(external,'XXXX');
    await transferFile(session,{id:randomUUID(),direction:'upload',source:external,target:remote+'/existing',metadata},{target:targetFor(files),replace:true,stream:streamFor(protocol)});
    await rm(join(root,'existing'));await wait(() => monitor.stopped);
    assert.ok(monitor.state.error);assert.equal(await targetFor(files).hash(remote+'/existing'),hash('XXXX'),'external server changes survive automatic-upload conflict');
    assert.equal(monitor.state.deleted,2,'conflicting deletion does not count as completed');
    await writeFile(join(root,'existing'),'3333');
    const next=await activate();service.stop(profile.id,'different-owner');assert.equal(next.stopped,false);service.stop(profile.id,'test');assert.equal(next.stopped,true);
    const count=engine.queue.list().length;await writeFile(join(root,'existing'),'4444');await next.tick();assert.equal(engine.queue.list().length,count);
    assert.doesNotThrow(() => engine.assertManual(profile.id));
    const interrupted=await activate(),beforeInterruption=await targetFor(files).hash(remote+'/existing');stopOnProgress=true;await writeFile(join(root,'existing'),Buffer.alloc(2*1024*1024,0x61));
    await wait(() => interrupted.stopped);await engine.queue.idle();assert.equal(await targetFor(files).hash(remote+'/existing'),beforeInterruption,'stopping during streaming never publishes a partial replacement');
    const disconnected=await activate();connected=false;service.validate();assert.equal(disconnected.stopped,true);assert.equal(service.state(profile.id).active,false);connected=true;service.validate();assert.equal(disconnected.stopped,true,'reconnect never silently reactivates monitoring');
  } finally {
    service.dispose();engine.dispose();await executeRemoteDelete(files,await planRemoteDelete(files,[remote]).catch(() => []),() => true).catch(() => {});files.close();await session.close();await rm(directory,{recursive:true,force:true});
  }
});
