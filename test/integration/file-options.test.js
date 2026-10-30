import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {releaseFixture,fixturePort} from '../helpers/release-fixture.mjs';
import {openRemoteFiles,targetFor,streamFor} from '../../src/application/remote-files.js';
import {TransferEngine} from '../../src/application/transfer-engine.js';import {filePolicy} from '../../src/application/file-policy.js';
import {planRemoteBackup,executeRemoteBackup,restoreRemoteBackup} from '../../src/application/remote-backup.js';
import {planRemoteDelete,executeRemoteDelete} from '../../src/application/remote-delete.js';import {AutoUploadService} from '../../src/application/auto-upload-service.js';
import {transferFile} from '../../src/application/transfer-file.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
for(const protocol of ['sftp','scp']) test(`${protocol}: exclusions, no-clobber backups, restore, mirror and queued rule changes`,{timeout:60000},async()=>{
 const session=await releaseFixture(protocol),files=await openRemoteFiles(session,protocol),base=await realpath(await mkdtemp(join(tmpdir(),'ft-options-'))),local=join(base,'payload'),remote='/data/options-'+randomUUID();
 const profile={id:'options',host:'127.0.0.1',port:fixturePort(protocol),username:'fixture',protocol},sessions={transport:()=>session,snapshot:()=>({state:'connected'}),matches:()=>true},profiles={get:()=>profile};
 let policy=filePolicy({excludedExtensions:['log']}),changeOnProgress=false;
 const engine=new TransferEngine({sessions,profiles,getPolicy:()=>policy,choose:async()=>({choice:'replace'}),onChange:jobs=>{if(changeOnProgress && jobs.some(job=>job.state==='running' && job.bytes>0)){changeOnProgress=false;policy=filePolicy({excludedExtensions:['bin']});}}});
 const service=new AutoUploadService({engine,sessions,profiles,getPolicy:()=>policy,guard:()=>{}}),target=targetFor(files);
 const absent=path=>assert.rejects(files.stat(path),error=>['ENOENT',2].includes(error.code));
 const seed=async(name,content)=>{const source=join(base,'seed');await writeFile(source,content);await transferFile(session,{id:randomUUID(),source,target:remote+'/payload/'+name,direction:'upload'},{target,replace:false,stream:streamFor(protocol)});};
 try {
  await mkdir(local);await mkdir(join(local,'.git'));await writeFile(join(local,'.git','config'),'ignored');await writeFile(join(local,'.env'),'ignored');await writeFile(join(local,'debug.log'),'ignored');await writeFile(join(local,'public.txt'),'version one');await files.mkdir(remote);
  await engine.submit(profile.id,'upload',[local],remote);await engine.queue.idle();
  for(const name of ['.git','.env','debug.log']) await absent(remote+'/payload/'+name);
  assert.equal(await target.hash(remote+'/payload/public.txt'),hash('version one'));
  const path=remote+'/payload/public.txt';
  await executeRemoteBackup(files,await planRemoteBackup(files,[path]),()=>true);assert.equal(await target.hash(path+'.bak'),hash('version one'));
  await writeFile(join(local,'public.txt'),'version two');await engine.submit(profile.id,'upload',[join(local,'public.txt')],remote+'/payload');await engine.queue.idle();
  await assert.rejects(files.rename(path,path+'.bak'));assert.equal(await target.hash(path),hash('version two'),'occupied backups are never overwritten');
  await assert.rejects(restoreRemoteBackup(files,path+'.bak',()=>true),{code:'EEXIST'});
  await executeRemoteBackup(files,await planRemoteBackup(files,[path]),()=>true);assert.equal(await target.hash(path+'.bak.1'),hash('version two'));await restoreRemoteBackup(files,path+'.bak.1',()=>true);
  await assert.rejects(engine.submit(profile.id,'download',[path+'.bak'],base),/excluded/);
  await seed('.env','remote secret');await seed('old.txt','remote extra');
  const monitor=await service.start({profileId:profile.id,localRoot:local,remoteRoot:remote+'/payload'});clearTimeout(monitor.timer);assert.equal(monitor.state.error,'');
  await absent(remote+'/payload/old.txt');assert.equal(await target.hash(remote+'/payload/old.txt.bak'),hash('remote extra'));assert.equal(await target.hash(remote+'/payload/.env'),hash('remote secret'));assert.equal(await target.hash(path+'.bak'),hash('version one'));service.stop(profile.id);
  engine.queue.pause(true);const pending=await engine.submit(profile.id,'upload',[join(local,'public.txt')],remote+'/payload');policy=filePolicy({excludedExtensions:['txt']});engine.queue.pause(false);await engine.queue.idle();assert.equal(engine.queue.list().find(job=>pending.ids.includes(job.id)).state,'skipped');
  policy=filePolicy();await seed('large.bin','old destination');await writeFile(join(local,'large.bin'),Buffer.alloc(2*1024*1024,7));changeOnProgress=true;const interrupted=await engine.submit(profile.id,'upload',[join(local,'large.bin')],remote+'/payload');await engine.queue.idle();assert.equal(engine.queue.list().find(job=>interrupted.ids.includes(job.id)).state,'failed');assert.equal(await target.hash(remote+'/payload/large.bin'),hash('old destination'),'rules changed during transfer protect existing targets');
 } finally {service.dispose();engine.dispose();try{await executeRemoteDelete(files,await planRemoteDelete(files,[remote]),()=>true);}finally{files.close();await session.close();await rm(base,{recursive:true,force:true});}}
});
