import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {releaseFixture,fixturePort} from '../test/helpers/release-fixture.mjs';
const sourceRoot=resolve(process.env.XSCP_BENCH_SOURCE ?? 'src');
const {TransferEngine}=await import(pathToFileURL(join(sourceRoot,'application/transfer-engine.js')));
const {TransferJournal}=await import(pathToFileURL(join(sourceRoot,'application/transfer-journal.js')));
const {RemoteFiles}=await import(pathToFileURL(join(sourceRoot,'adapters/sftp/files.js')));
const count=Number(process.env.XSCP_BENCH_FILES ?? 1500),delay=Number(process.env.XSCP_BENCH_RPC_DELAY ?? 0);
assert.ok(Number.isInteger(count) && count>0 && count<=5000 && delay>=0 && delay<=100);
const call=RemoteFiles.prototype.call;let rpcs=0;
RemoteFiles.prototype.call=async function(...args) {rpcs++;if(delay) await new Promise(r=>setTimeout(r,delay));return call.apply(this,args);};
const base=await mkdtemp(join(tmpdir(),'filetandem-small-')),root=join(base,'project'),remote='/data/small-'+randomUUID();
const session=await releaseFixture('sftp');let channels=0,notifications=0,serializedBytes=0;
const counted={...session,sftp:callback=>{channels++;session.sftp(callback);}};
const files=await RemoteFiles.open(session);await files.mkdir(remote);
const profile={id:'benchmark',protocol:'sftp',host:'127.0.0.1',port:fixturePort('sftp'),username:'fixture'};
const journal=new TransferJournal(join(base,'journal.json'),message=>{throw new Error(message);});
journal.key=Buffer.alloc(32,1);
const engine=new TransferEngine({notifyInterval:100,profiles:{get:()=>profile},sessions:{transport:()=>counted},choose:async()=>({choice:'replace',apply:true}),onChange:jobs=>{notifications++;journal.update(jobs);serializedBytes+=Buffer.byteLength(JSON.stringify(jobs));}});
const content=i=>Buffer.alloc(4096,i%251);
try {
 for(let i=0;i<count;i++){const folder=join(root,'folder-'+Math.floor(i/50));await mkdir(folder,{recursive:true});await writeFile(join(folder,'file-'+i),content(i));}
 for(const phase of ['new','replace']) {
  const before={channels,rpcs,notifications,serializedBytes},start=performance.now();
  const batch=await engine.submit(profile.id,'upload',[root],remote);await engine.queue.idle();await journal.flush();
  const seconds=(performance.now()-start)/1000,ids=new Set(batch.ids),jobs=engine.queue.list().filter(j=>ids.has(j.id));
  assert.ok(jobs.every(j=>j.state==='completed'),JSON.stringify(jobs.filter(j=>j.state!=='completed')));
  assert.equal(jobs.filter(j=>j.kind==='file').length,count);
  for(const job of jobs.filter(j=>j.kind==='file')) {const i=Number(job.name.slice(5));assert.equal(job.sha256,createHash('sha256').update(content(i)).digest('hex'));}
  console.log(JSON.stringify({phase,count,bytesEach:4096,seconds,filesPerSecond:count/seconds,channels:channels-before.channels,rpcs:rpcs-before.rpcs,notifications:notifications-before.notifications,serializedBytes:serializedBytes-before.serializedBytes,rpcDelayMs:delay,sourceRoot}));
 }
} finally {
 engine.dispose();await journal.flush();
 const remove=async path=>{for(const entry of (await files.list(path)).entries){if(entry.kind==='directory')await remove(entry.path);else await files.call('unlink',entry.path);}await files.call('rmdir',path);};
 await remove(remote);files.close();await session.close();await rm(base,{recursive:true,force:true});
}
