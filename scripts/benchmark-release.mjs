import assert from 'node:assert/strict';
import { mkdtemp,mkdir,open,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir,cpus,totalmem,platform,arch,release } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { releaseFixture,fixturePort } from '../test/helpers/release-fixture.mjs';
import { TransferEngine } from '../src/application/transfer-engine.js';
import { LocalFiles } from '../src/adapters/local/files.js';
import { openRemoteFiles,targetFor } from '../src/application/remote-files.js';
import { localTarget } from '../src/adapters/local/transfer-target.js';

// Real production queue/stream/hash/publication paths. Only checkout fixtures.
const size=4*1024**3+1024**2,smallCount=1000,listingCount=10000;
const directory=await mkdtemp(join(tmpdir(),'filetandem-performance-'));
await mkdir('out/m6',{recursive:true});
const finishListings=process.argv.includes('--finish-listings');
const report=finishListings ? JSON.parse(await readFile('out/m6/performance.json','utf8')):{started:new Date().toISOString(),hardware:{platform:platform(),arch:arch(),os:release(),cpu:cpus()[0].model,cores:cpus().length,memory:totalmem(),node:process.version},fileBytes:size,smallFiles:{count:smallCount,bytesEach:4096},listingEntries:listingCount,measurements:[]};
if (finishListings) {
  assert.equal(report.fileBytes,size);assert.equal(report.hardware.platform,platform());assert.equal(report.hardware.arch,arch());
  for (const protocol of ['sftp','scp']) for (const phase of ['large-upload','large-download','small-upload','memory-target']) assert.ok(report.measurements.some(m => m.label===protocol+'-'+phase),'Cannot resume an incomplete transfer benchmark');
  report.listingsResumed=new Date().toISOString();
}
const save=() => writeFile('out/m6/performance.json',JSON.stringify(report,null,2)+'\n');
async function pool(values,action,width=2) {let index=0;await Promise.all(Array.from({length:width},async () => {while (index<values.length) await action(values[index++]);}));}
async function sparse(path,bytes) {const file=await open(path,'wx');try {await file.truncate(bytes);const marker=Buffer.alloc(65536,0x79);for (const offset of [0,Math.floor(bytes/2),bytes-marker.length]) await file.write(marker,0,marker.length,offset);} finally {await file.close();}}
async function measure(label,action) {
  globalThis.gc?.();const baseline=process.memoryUsage().rss;let peak=baseline;
  const sample=() => {peak=Math.max(peak,process.memoryUsage().rss);};
  const timer=setInterval(sample,20),started=performance.now();let result;
  try {result=await action();sample();} finally {clearInterval(timer);}
  const seconds=(performance.now()-started)/1000;
  const record={label,seconds,baselineRss:baseline,peakRss:peak,additionalRss:peak-baseline,...result};
  if (result?.bytes) record.mibPerSecond=result.bytes/1024**2/seconds;
  report.measurements.push(record);await save();console.log(JSON.stringify(record));return record;
}
try {
  const source=join(directory,'large-'+randomUUID()),warm=join(directory,'warm-'+randomUUID());
  if (!finishListings) {await sparse(source,size);await sparse(warm,64*1024**2);}
  const expected=finishListings ? undefined:await localTarget.hash(source);
  for (const protocol of ['sftp','scp']) {
    if (finishListings && report.measurements.some(m => m.label===protocol+'-list-10000')) continue;
    const session=await releaseFixture(protocol),files=await openRemoteFiles(session,protocol),target=targetFor(files);
    const root='/data/m6-performance-'+randomUUID();await files.mkdir(root);
    const profile={id:'performance',host:'127.0.0.1',port:fixturePort(protocol),username:'fixture',protocol};
    const engine=new TransferEngine({profiles:{get:() => profile},sessions:{transport:() => session},choose:async () => ({choice:'replace'})});
    const transfer=async (direction,path,destination) => {const batch=await engine.submit(profile.id,direction,[path],destination);await engine.queue.idle();const jobs=engine.queue.list().filter(j => batch.ids.includes(j.id));assert.ok(jobs.every(j => j.state==='completed'),JSON.stringify(jobs.map(j => ({state:j.state,error:j.error}))));return jobs;};
    let listingRoot;
    try {
      if (!finishListings) {
      const latencies=[];for (let i=0;i<20;i++) {const started=performance.now();await files.stat('/data/server-marker.txt');latencies.push(performance.now()-started);}
      report.measurements.push({label:protocol+'-metadata-roundtrip',minimumMs:Math.min(...latencies),medianMs:latencies.sort((a,b) => a-b)[10],samples:20});await save();
      await measure(protocol+'-warmup',async () => {await transfer('upload',warm,root);await target.remove(root+'/'+warm.split('/').at(-1));return {bytes:64*1024**2};});
      const uploaded=await measure(protocol+'-large-upload',async () => {const [job]=await transfer('upload',source,root);assert.equal(job.sha256,expected);return {bytes:job.bytes,sha256:job.sha256,committed:job.committed};});
      const download=join(directory,'download-'+protocol);await mkdir(download);
      const downloaded=await measure(protocol+'-large-download',async () => {const [job]=await transfer('download',root+'/'+source.split('/').at(-1),download);assert.equal(job.sha256,expected);assert.equal(await localTarget.hash(join(download,source.split('/').at(-1))),expected);return {bytes:job.bytes,sha256:job.sha256,committed:job.committed};});
      report.measurements.push({label:protocol+'-memory-target',limitBytes:128*1024**2,met:uploaded.additionalRss<128*1024**2 && downloaded.additionalRss<128*1024**2});await save();
      await target.remove(root+'/'+source.split('/').at(-1));await rm(download,{recursive:true,force:true});
      const small=join(directory,'small-'+protocol);await mkdir(small);await pool(Array.from({length:smallCount},(_,i) => i),i => writeFile(join(small,'file-'+i),Buffer.alloc(4096,i%256)));
      await measure(protocol+'-small-upload',async () => {const jobs=await transfer('upload',small,root);assert.equal(jobs.filter(j => j.kind==='file').length,smallCount);return {files:smallCount,bytes:smallCount*4096};});
      const remoteSmall=root+'/small-'+protocol;const remoteEntries=(await files.list(remoteSmall)).entries;
      await pool(remoteEntries,entry => target.remove(entry.path));await files.call('rmdir',remoteSmall);
      }
      listingRoot=root+'/listing';await files.mkdir(listingRoot);
      await pool(Array.from({length:listingCount},(_,i) => i),async i => {
        const path=listingRoot+'/file-'+String(i).padStart(5,'0');
        if (protocol==='sftp') {const handle=await files.call('open',path,'wx',0o600);await files.call('close',handle);}
      });
      if (protocol==='scp') {
        // Fixed numeric loop and generated UUID-only path; no arbitrary shell input.
        await files.execute(`for i in $(seq 0 9999); do : > '${listingRoot}/file-'$i; done`,{timeout:300000});
      }
      await measure(protocol+'-list-10000',async () => {const result=await files.list(listingRoot);assert.equal(result.entries.length,listingCount);return {entries:result.entries.length};});
      await pool((await files.list(listingRoot)).entries,entry => target.remove(entry.path));await files.call('rmdir',listingRoot);listingRoot=undefined;
    } finally {
      engine.dispose();
      // Remove only this run's generated tree, preserving all other fixture data.
      const removeTree=async path => {for (const entry of (await files.list(path)).entries) {if (entry.kind==='directory') await removeTree(entry.path);else await target.remove(entry.path);}await files.call('rmdir',path);};
      await removeTree(root).catch(() => {});files.close();await session.close();
    }
  }
  const localFolder=join(directory,'listing');await mkdir(localFolder);await pool(Array.from({length:listingCount},(_,i) => i),i => writeFile(join(localFolder,'file-'+i),''));
  await measure('local-list-10000',async () => {const result=await new LocalFiles().list({scheme:'file',fsPath:localFolder});assert.equal(result.entries.length,listingCount);return {entries:listingCount};});
  report.completed=new Date().toISOString();report.ok=true;
} finally {await save();await rm(directory,{recursive:true,force:true});}
console.log('M6 performance complete: out/m6/performance.json');
