import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,copyFile,rm,rmdir,unlink,readdir,realpath,symlink,utimes,stat } from 'node:fs/promises';
import { join,basename } from 'node:path';
import { tmpdir } from 'node:os';
import { AutoUploadService } from '../../src/application/auto-upload-service.js';
import { localTarget } from '../../src/adapters/local/transfer-target.js';
import { filePolicy } from '../../src/application/file-policy.js';
import { rename } from 'node:fs/promises';
import { TransferQueue } from '../../src/application/transfer-queue.js';

// Exercise the service against two actual filesystem trees, without Docker or a production server.
async function fixture(t,options={backupRemoteDeletes:false}) {
  const base=await realpath(await mkdtemp(join(tmpdir(),'filetandem-mirror-'))),local=join(base,'local'),remote=join(base,'remote');
  await mkdir(local);await mkdir(remote);
  const transport={},profile={id:'test',host:'localhost',port:22,username:'fixture',protocol:'sftp'},sessions={transport:() => transport,snapshot:() => ({state:'connected'}),matches:() => true},profiles={get:() => profile};
  const files={rename,stat:localTarget.stat,mkdir,close() {},listNoFollow:async path => ({entries:(await readdir(path)).map(name => ({name,path:join(path,name)}))}),call:(method,path) => method==='unlink' ? unlink(path):rmdir(path)};
  let permission,sequence=0,changes=0;
  const engine={ready:Promise.resolve(),autoJobs:new Map(),key:(_job,path) => path,beginAutoUpload(_id,value) {permission=value;},endAutoUpload() {permission=undefined;},async submit(_id,_direction,[source],destination,{automatic}) {
    assert.equal(automatic,permission);const id=String(++sequence),target=join(destination,basename(source));this.autoJobs.set(id,automatic);
    this.queue.add({id,batchId:id,profileId:profile.id,server:'fixture',source,target,lockKey:target,direction:'upload',automatic:true});return {ids:[id]};
  }};
  engine.queue=new TransferQueue({run:async job => {
    await permission.check(job);await copyFile(job.source,job.target);return {sha256:await localTarget.hash(job.target)};
  }});
  const service=new AutoUploadService({getPolicy:()=>filePolicy(options),engine,sessions,profiles,guard:() => {},openFiles:async () => files,remoteTarget:() => localTarget,onChange:() => changes++});
  const start=async () => {const monitor=await service.start({profileId:profile.id,localRoot:local,remoteRoot:remote});clearTimeout(monitor.timer);return monitor;};
  t.after(async () => {service.dispose();engine.queue.dispose();await rm(base,{recursive:true,force:true});});
  return {local,remote,base,service,engine,start,options,changes:() => changes};
}
const missing=path => assert.rejects(stat(path),{code:'ENOENT'});

test('activation mirrors files, empty directories, remote-only trees and type conflicts',async t => {
  const f=await fixture(t);
  await writeFile(join(f.local,'test1.txt'),'local');await writeFile(join(f.remote,'test1.txt'),'old');
  await writeFile(join(f.remote,'test.txt'),'remote only');await mkdir(join(f.remote,'obsolete'));await writeFile(join(f.remote,'obsolete','child'),'extra');
  await mkdir(join(f.local,'empty'));await mkdir(join(f.remote,'as-file'));await writeFile(join(f.remote,'as-file','child'),'old');await writeFile(join(f.local,'as-file'),'new');
  await mkdir(join(f.local,'as-dir'));await writeFile(join(f.local,'as-dir','child'),'new');await writeFile(join(f.remote,'as-dir'),'old');
  await writeFile(join(f.base,'outside'),'keep');
  const monitor=await f.start();assert.equal(monitor.state.active,true);assert.equal(monitor.state.error,'');
  assert.equal(await readFile(join(f.remote,'test1.txt'),'utf8'),'local');await missing(join(f.remote,'test.txt'));await missing(join(f.remote,'obsolete'));
  assert.equal((await stat(join(f.remote,'empty'))).isDirectory(),true);assert.equal(await readFile(join(f.remote,'as-file'),'utf8'),'new');assert.equal(await readFile(join(f.remote,'as-dir','child'),'utf8'),'new');
  assert.equal(await readFile(join(f.base,'outside'),'utf8'),'keep');assert.equal(monitor.state.uploaded,3);
});

test('deleting test3.txt after activation deletes its remote copy and notifies the view',async t => {
  const f=await fixture(t);await writeFile(join(f.local,'test3.txt'),'');const monitor=await f.start();
  await rm(join(f.local,'test3.txt'));await monitor.tick();assert.equal(await readFile(join(f.remote,'test3.txt'),'utf8'),'');
  const changes=f.changes();await monitor.tick();assert.equal(monitor.state.error,'');await missing(join(f.remote,'test3.txt'));assert.equal(monitor.state.deleted,1);assert.ok(f.changes()>changes);assert.equal(monitor.state.error,'');
});

test('changes on the server are protected even before the first automatic upload',async t => {
  const f=await fixture(t);await writeFile(join(f.local,'file'),'1111');await writeFile(join(f.remote,'file'),'1111');const monitor=await f.start();
  assert.equal(monitor.state.uploaded,0);const original=await stat(join(f.remote,'file'));await writeFile(join(f.remote,'file'),'2222');await utimes(join(f.remote,'file'),original.atime,original.mtime);
  await rm(join(f.local,'file'));await monitor.tick();await monitor.tick();assert.equal(monitor.stopped,true);assert.match(monitor.state.error,/Remote-Datei wurde geändert/);assert.equal(await readFile(join(f.remote,'file'),'utf8'),'2222');
});

test('recursive local deletion removes children before their parent directory',async t => {
  const f=await fixture(t);await mkdir(join(f.local,'nested'));await writeFile(join(f.local,'nested','file'),'value');const monitor=await f.start();
  await rm(join(f.local,'nested'),{recursive:true});await monitor.tick();await monitor.tick();assert.equal(monitor.state.error,'');await missing(join(f.remote,'nested'));assert.equal(monitor.state.deleted,2);assert.equal(monitor.state.error,'');
});

test('replacing a local directory with a symlink never deletes the remote subtree',async t => {
  const f=await fixture(t);await mkdir(join(f.local,'nested'));await writeFile(join(f.local,'nested','file'),'keep');const monitor=await f.start();
  await rm(join(f.local,'nested'),{recursive:true});await mkdir(join(f.base,'elsewhere'));await symlink(join(f.base,'elsewhere'),join(f.local,'nested'));
  await monitor.tick();await monitor.tick();assert.equal(monitor.stopped,true);assert.equal(await readFile(join(f.remote,'nested','file'),'utf8'),'keep');
});

test('pause also pauses deletions; stop revokes a pending deletion',async t => {
  const f=await fixture(t);await writeFile(join(f.local,'file'),'keep');const monitor=await f.start();f.engine.queue.pause();
  await rm(join(f.local,'file'));await monitor.tick();const pending=monitor.tick();await new Promise(resolve => setTimeout(resolve,10));
  assert.equal(await readFile(join(f.remote,'file'),'utf8'),'keep');f.service.stop('test');await pending;assert.equal(await readFile(join(f.remote,'file'),'utf8'),'keep');
});

test('mirror exclusions preserve remote-only secrets and ignored folders; backup deletions survive restarts',async t=>{
 const f=await fixture(t,{backupRemoteDeletes:true,excludedExtensions:['log'],excludedNames:['.env*','cache']});
 await writeFile(join(f.local,'public.txt'),'local');await writeFile(join(f.local,'local.log'),'do not upload');await mkdir(join(f.local,'cache'));await writeFile(join(f.local,'cache','item'),'ignored');
 await writeFile(join(f.remote,'.env'),'secret');await writeFile(join(f.remote,'remote.log'),'preserve');await writeFile(join(f.remote,'old.txt'),'old');await writeFile(join(f.remote,'old.txt.bak'),'older');await mkdir(join(f.remote,'protected'));await writeFile(join(f.remote,'protected','nested.log'),'keep');
 const monitor=await f.start();assert.equal(monitor.state.error,'');
 assert.equal(await readFile(join(f.remote,'old.txt.bak'),'utf8'),'older');assert.equal(await readFile(join(f.remote,'old.txt.bak.1'),'utf8'),'old');await missing(join(f.remote,'old.txt'));
 assert.equal(await readFile(join(f.remote,'.env'),'utf8'),'secret');assert.equal(await readFile(join(f.remote,'remote.log'),'utf8'),'preserve');assert.equal(await readFile(join(f.remote,'protected','nested.log'),'utf8'),'keep');await missing(join(f.remote,'local.log'));await missing(join(f.remote,'cache'));
 await rm(join(f.local,'public.txt'));await monitor.tick();await monitor.tick();assert.equal(monitor.state.error,'');assert.equal(await readFile(join(f.remote,'public.txt.bak'),'utf8'),'local');
 f.service.stop('test');const next=await f.start();assert.equal(next.state.error,'');assert.equal(await readFile(join(f.remote,'old.txt.bak.1'),'utf8'),'old');assert.equal(await readFile(join(f.remote,'public.txt.bak'),'utf8'),'local');
});

test('automatic folder deletion retains backups, excluded entries and their parent folders',async t=>{
 const f=await fixture(t,{backupRemoteDeletes:true});await mkdir(join(f.local,'nested'));await writeFile(join(f.local,'nested','file'),'content');const monitor=await f.start();
 await rm(join(f.local,'nested'),{recursive:true});await monitor.tick();await monitor.tick();assert.equal(monitor.state.error,'');assert.equal(await readFile(join(f.remote,'nested','file.bak'),'utf8'),'content');assert.equal(monitor.state.deleted,1);
});

test('settings changes stop monitoring before excluded files could be treated as local deletions',async t=>{
 const options={backupRemoteDeletes:true,excludedNames:[]};const f=await fixture(t,options);await writeFile(join(f.local,'file'),'keep');const monitor=await f.start();
 options.excludedNames=['file'];f.service.validate();assert.equal(monitor.stopped,true);assert.match(monitor.state.error,/options changed/);assert.equal(await readFile(join(f.remote,'file'),'utf8'),'keep');
});

test('type conflicts containing protected children stop before removing any remote contents',async t=>{
 const f=await fixture(t,{backupRemoteDeletes:false,excludedNames:['secret']});await writeFile(join(f.local,'same'),'file');await mkdir(join(f.remote,'same'));await writeFile(join(f.remote,'same','secret'),'keep');
 await assert.rejects(f.start(),/excluded entries/);assert.equal(await readFile(join(f.remote,'same','secret'),'utf8'),'keep');
});

test('a local root resolving into an excluded directory cannot turn a mirror into an empty source',async t=>{
 const f=await fixture(t,{backupRemoteDeletes:true});await mkdir(join(f.base,'.git'));await writeFile(join(f.base,'.git','file'),'ignored');await symlink(join(f.base,'.git'),join(f.base,'alias'));await writeFile(join(f.remote,'keep'),'remote');
 await assert.rejects(f.service.start({profileId:'test',localRoot:join(f.base,'alias'),remoteRoot:f.remote}),/excluded/);assert.equal(await readFile(join(f.remote,'keep'),'utf8'),'remote');
});
