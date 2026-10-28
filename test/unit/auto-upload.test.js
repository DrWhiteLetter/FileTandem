import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,mkdir,rename,rm,symlink,realpath,utimes,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AutoUpload,scanUploadSource } from '../../src/application/auto-upload.js';
import { TransferEngine } from '../../src/application/transfer-engine.js';
const nodes=files => new Map([['',{kind:'directory',stamp:'root'}],...Object.entries(files).map(([relative,stamp]) => [relative,{path:'/source/'+relative,kind:'file',stamp}])]);
test('monitor does not initially upload; stable saves are coalesced and nested files mapped',async () => {
  let current=nodes({'existing':'old'});const uploads=[],deletions=[];
  const monitor=new AutoUpload({localRoot:'/source',remoteRoot:'/remote',scan:async () => current,remove:async (...args) => deletions.push(args),upload:async (...args) => uploads.push(args)});
  await monitor.start({schedule:false});await monitor.tick();assert.equal(uploads.length,0);
  current=nodes({existing:'writing','nested/new':'first'});await monitor.tick();assert.equal(uploads.length,0);
  current=nodes({existing:'saved','nested/new':'first'});await monitor.tick();assert.equal(uploads.length,1);assert.equal(uploads[0][1],'/remote/nested/new');
  await monitor.tick();assert.equal(uploads.length,2);await monitor.tick();assert.equal(uploads.length,2);
  current=nodes({});await monitor.tick();assert.equal(deletions.length,0,'transient absence is debounced');await monitor.tick();assert.equal(deletions.length,2);assert.deepEqual(deletions.map(args => args[1]).sort(),['/remote/existing','/remote/nested/new']);
  current=nodes({existing:'saved'});await monitor.tick();await monitor.tick();assert.equal(uploads.length,3,'recreation is a new upload');monitor.stop();
});
test('save while an upload runs is picked up next, without parallel uploads',async () => {
  let current=nodes({file:'old'}),release;const uploads=[];
  const monitor=new AutoUpload({localRoot:'/source',remoteRoot:'/remote',scan:async () => current,upload:async () => {uploads.push(current.get('file').stamp);if (uploads.length===1) await new Promise(resolve => {release=resolve;});}});
  await monitor.start({schedule:false});current=nodes({file:'one'});await monitor.tick();const pending=monitor.tick();await new Promise(resolve => setImmediate(resolve));
  current=nodes({file:'two'});await monitor.tick();assert.equal(uploads.length,1);release();await pending;await monitor.tick();await monitor.tick();assert.deepEqual(uploads,['one','two']);monitor.stop();
});
test('failure, disconnection and stop end monitoring without automatic retry',async () => {
  let current=nodes({}),allowed=true,stops=0;
  const monitor=new AutoUpload({localRoot:'/source',remoteRoot:'/remote',scan:async () => current,validate:() => {if (!allowed) throw new Error('Disconnected');},upload:async () => {throw new Error('Upload failed');},onStop:() => stops++});
  await monitor.start({schedule:false});current=nodes({file:'one'});await monitor.tick();await monitor.tick();assert.equal(monitor.state.error,'Upload failed');assert.equal(monitor.state.active,false);await monitor.tick();assert.equal(stops,1);
  const next=new AutoUpload({localRoot:'/source',remoteRoot:'/remote',scan:async () => current,validate:() => {if (!allowed) throw new Error('Disconnected');}});await next.start({schedule:false});allowed=false;await next.tick();assert.equal(next.state.error,'Disconnected');
});
test('real disk scanner sees atomic external saves and excludes symlink trees',async () => {
  const root=await realpath(await mkdtemp(join(tmpdir(),'filetandem-watch-')));
  try {
    await mkdir(join(root,'nested'));await writeFile(join(root,'nested','file'),'old');await symlink(join(root,'nested'),join(root,'link'));
    const before=await scanUploadSource(root);assert.ok(before.has('nested/file'));assert.ok(!before.has('link'));assert.ok(!before.has('link/file'));
    const old=await stat(join(root,'nested','file'));await writeFile(join(root,'new'),'new');await rename(join(root,'new'),join(root,'nested','file'));await utimes(join(root,'nested','file'),old.atime,old.mtime);
    const after=await scanUploadSource(root);assert.notEqual(before.get('nested/file').stamp,after.get('nested/file').stamp,'ctime/inode detect same-size saves even with restored mtime');
  } finally {await rm(root,{recursive:true,force:true});}
});
test('engine blocks manual uploads/downloads while monitored; permissions do not survive stop',async () => {
  const engine=new TransferEngine({sessions:{},profiles:{},guard:() => {}}),permission={};
  engine.beginAutoUpload('p',permission);
  await assert.rejects(engine.submit('p','upload',['/file'],'/target'),/Automatischer Upload/);
  await assert.rejects(engine.submit('p','download',['/file'],'/target'),/Automatischer Upload/);
  assert.throws(() => engine.beginAutoUpload('p',{}),/Automatischer Upload/);
  engine.endAutoUpload('p',permission);assert.doesNotThrow(() => engine.assertManual('p'));
  await assert.rejects(engine.run({id:'old',profileId:'p',automatic:true},new AbortController().signal),/Überwachung wurde beendet/);engine.dispose();
});
test('stop during a pending scan prevents a later upload',async () => {
  let release,scan=0,uploads=0;
  const monitor=new AutoUpload({localRoot:'/source',remoteRoot:'/remote',scan:async () => ++scan===1 ? nodes({}):new Promise(resolve => {release=resolve;}),upload:async () => uploads++});
  await monitor.start({schedule:false});const pending=monitor.tick();await new Promise(resolve => setImmediate(resolve));monitor.stop();release(nodes({file:'saved'}));await pending;assert.equal(uploads,0);
});

test('temporary absence during atomic save does not delete the remote file',async () => {
  let current=nodes({file:'old'}),deletions=0;
  const monitor=new AutoUpload({localRoot:'/source',remoteRoot:'/remote',scan:async () => current,upload:async () => {},remove:async () => deletions++});
  await monitor.start({schedule:false});current=nodes({});await monitor.tick();current=nodes({file:'new'});await monitor.tick();await monitor.tick();assert.equal(deletions,0);monitor.stop();
});
