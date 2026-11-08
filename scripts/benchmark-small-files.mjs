import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {releaseFixture,fixturePort} from '../test/helpers/release-fixture.mjs';
const sourceRoot=resolve(process.env.FILETANDEM_BENCH_SOURCE ?? 'src');
const {HostKeyStore}=await import(pathToFileURL(join(sourceRoot,'adapters/ssh/host-keys.js')));
const {connectSsh}=await import(pathToFileURL(join(sourceRoot,'adapters/ssh/connect.js')));
const {TransferEngine}=await import(pathToFileURL(join(sourceRoot,'application/transfer-engine.js')));
const {TransferJournal}=await import(pathToFileURL(join(sourceRoot,'application/transfer-journal.js')));
const {RemoteFiles}=await import(pathToFileURL(join(sourceRoot,'adapters/sftp/files.js')));
const {transferView}=await import(pathToFileURL(join(sourceRoot,'shared/transfer-view.js'))).catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND') throw error;return {transferView:jobs=>jobs};});
const {LocalFiles}=await import(pathToFileURL(join(sourceRoot,'adapters/local/files.js')));
const localDelay=Number(process.env.FILETANDEM_BENCH_LOCAL_DELAY ?? 0),bytesEach=Number(process.env.FILETANDEM_BENCH_BYTES ?? 4096),discoveryOnly=process.env.FILETANDEM_BENCH_DISCOVERY_ONLY==='1';
assert.ok(Number.isSafeInteger(bytesEach) && bytesEach>=0 && bytesEach<=16*1024*1024 && localDelay>=0 && localDelay<=100);
let localStats=0;const localStat=LocalFiles.prototype.stat;
LocalFiles.prototype.stat=async function(...args){localStats++;if(localDelay) await new Promise(r=>setTimeout(r,localDelay));return localStat.apply(this,args);};
const count=Number(process.env.FILETANDEM_BENCH_FILES ?? 1500),delay=Number(process.env.FILETANDEM_BENCH_RPC_DELAY ?? 0);
assert.ok(Number.isInteger(count) && count>0 && count<=5000 && delay>=0 && delay<=100);
const call=RemoteFiles.prototype.call;let rpcs=0;const methods={};
RemoteFiles.prototype.call=async function(...args) {rpcs++;methods[args[0]]=(methods[args[0]] ?? 0)+1;if(delay) await new Promise(r=>setTimeout(r,delay));return call.apply(this,args);};
const base=await mkdtemp(join(tmpdir(),'filetandem-small-')),root=join(base,'project'),remote='/data/small-'+randomUUID();
const session=await releaseFixture('sftp',fixturePort('sftp'),connectSsh,HostKeyStore);let channels=0,notifications=0,serializedBytes=0;
const counted={...session,sftp:callback=>{channels++;session.sftp(callback);}};
const files=await RemoteFiles.open(session);await files.mkdir(remote);
const profile={id:'benchmark',protocol:'sftp',host:'127.0.0.1',port:fixturePort('sftp'),username:'fixture'};
const journal=new TransferJournal(join(base,'journal.json'),message=>{throw new Error(message);});
journal.key=Buffer.alloc(32,1);
const verification=process.env.FILETANDEM_BENCH_VERIFICATION ?? 'sha256';
const engine=new TransferEngine({getSftpUploadVerification:()=>verification,notifyInterval:100,profiles:{get:()=>profile},sessions:{transport:()=>counted},choose:async()=>({choice:'replace',apply:true}),onChange:jobs=>{notifications++;journal.update(jobs);serializedBytes+=Buffer.byteLength(JSON.stringify(transferView(jobs)));}});
const content=i=>Buffer.alloc(bytesEach,i%251);
try {
 for(let i=0;i<count;i++){const folder=join(root,'folder-'+Math.floor(i/50));await mkdir(folder,{recursive:true});await writeFile(join(folder,'file-'+i),content(i));}
 for(const phase of (discoveryOnly ? ['discovery']:['new','replace'])) {
  if(discoveryOnly) engine.queue.pause();
  const before={channels,rpcs,notifications,serializedBytes,localStats,methods:{...methods}},start=performance.now();
  const batch=await engine.submit(profile.id,'upload',[root],remote);const submitSeconds=(performance.now()-start)/1000;
  if(!discoveryOnly) await engine.queue.idle();await journal.flush();
  const seconds=(performance.now()-start)/1000,ids=new Set(batch.ids),jobs=engine.queue.list().filter(j=>ids.has(j.id));
  assert.ok(jobs.every(j=>j.state===(discoveryOnly ? 'queued':'completed')),JSON.stringify(jobs.filter(j=>j.state!=='completed')));
  assert.equal(jobs.filter(j=>j.kind==='file').length,count);
  if(!discoveryOnly) for(const job of jobs.filter(j=>j.kind==='file')) {const i=Number(job.name.slice(5));assert.equal(job.sha256,createHash('sha256').update(content(i)).digest('hex'));}
  console.log(JSON.stringify({phase,verification,count,bytesEach,seconds,submitSeconds,localStats:localStats-before.localStats,localDelayMs:localDelay,methods:Object.fromEntries(Object.entries(methods).map(([key,value])=>[key,value-(before.methods[key] ?? 0)])),filesPerSecond:count/seconds,channels:channels-before.channels,rpcs:rpcs-before.rpcs,notifications:notifications-before.notifications,serializedBytes:serializedBytes-before.serializedBytes,rpcDelayMs:delay,sourceRoot}));
  if(!discoveryOnly && verification==='size') for(const job of jobs.filter(j=>j.kind==='file')) assert.deepEqual(await files.call('readFile',job.finalTarget),content(Number(job.name.slice(5))),'Independent verification outside the timed fast upload');
 }
} finally {
 engine.dispose();await journal.flush();
 const remove=async path=>{for(const entry of (await files.list(path)).entries){if(entry.kind==='directory')await remove(entry.path);else await files.call('unlink',entry.path);}await files.call('rmdir',path);};
 await remove(remote);files.close();await session.close();await rm(base,{recursive:true,force:true});
}
