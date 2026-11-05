import test from 'node:test';import assert from 'node:assert/strict';
import { TransferQueue } from '../../src/application/transfer-queue.js';
import { transition,batchState } from '../../src/domain/transfer-job.js';
const job=(id,target=id) => ({id,batchId:'batch',profileId:'p',server:'server',source:'/src',target:'/dst/'+target,lockKey:'remote:/'+target,direction:'upload'});
test('queue enforces server limit, destination locks, transitions and partial batch failure',async () => {
  let active=0,max=0;const locks=new Set();const queue=new TransferQueue({run:async j => {assert.ok(!locks.has(j.lockKey));locks.add(j.lockKey);max=Math.max(max,++active);await new Promise(r => setTimeout(r,10));active--;locks.delete(j.lockKey);if (j.id === 'fail') throw new Error('failure');return {bytes:1};}});
  for (const j of [job('a','same'),job('b','same'),job('c'),job('fail')]) queue.add(j);
  await queue.idle();assert.equal(max,2);assert.equal(queue.batches()[0].state,'failed');assert.throws(() => transition({state:'completed'},'running'));assert.equal(batchState([{state:'completed'},{state:'failed'}]),'failed');queue.dispose();
});
test('pause stops new starts; abort frees locks and retry never includes successful files',async () => {
  const started=[];const queue=new TransferQueue({run:async (j,signal) => {started.push(j.id);if (j.id === 'abort') await new Promise((resolve,reject) => signal.addEventListener('abort',() => reject(new Error('aborted')),{once:true}));return {committed:true,bytes:1};}});
  queue.pause();queue.add(job('ok'));queue.add(job('abort'));await new Promise(r => setTimeout(r,10));assert.equal(started.length,0);queue.pause(false);
  while (!started.includes('abort')) await new Promise(r => setTimeout(r,1));queue.cancel('abort');await queue.idle();assert.equal(queue.list().find(j => j.id === 'abort').state,'cancelled');
  assert.throws(() => queue.retry(['ok'],() => 'new'),/Nur/);let id=0;queue.retry(['abort'],() => 'retry-'+(++id));await queue.idle();assert.equal(started.filter(v => v === 'ok').length,1);assert.ok(queue.list().some(j => j.retryOf === 'abort' && j.state === 'completed'));queue.dispose();
});

test('large batches coalesce snapshots while publishing the final state and preserving all jobs',async()=>{
 const snapshots=[];let finish;const gate=new Promise(r=>{finish=r;});
 const queue=new TransferQueue({notifyInterval:100,limit:4,onChange:jobs=>snapshots.push(jobs),run:async()=>{await gate;return {committed:true};}});
 for(let i=0;i<1500;i++) queue.add(job('bulk-'+i));
 assert.equal(queue.list().length,1500);assert.equal(snapshots.length,1);
 await new Promise(r=>setTimeout(r,120));assert.equal(snapshots.at(-1).length,1500);assert.equal(snapshots.at(-1).filter(j=>j.state==='running').length,4);
 finish();await queue.idle();assert.ok(snapshots.at(-1).every(j=>j.state==='completed'));
 assert.ok(snapshots.length<30,'Must not emit thousands of full queue snapshots');
 queue.dispose();
});

test('coalesced notifications include children cancelled by a failed parent',async()=>{
 let latest=[];const queue=new TransferQueue({notifyInterval:1000,onChange:jobs=>{latest=jobs;},run:async()=>{throw new Error('parent failure');}});
 queue.add(job('parent'));queue.add({...job('child'),parentId:'parent'});
 await queue.idle();assert.deepEqual(latest.map(j=>j.state),['failed','cancelled']);queue.dispose();
});

test('a saturated server does not repeatedly schedule its waiting jobs; other servers still run',async()=>{
 let release;const gate=new Promise(r=>{release=r;});let limitChecks=0;const started=[];
 const queue=new TransferQueue({notifyInterval:100,limit:()=>{limitChecks++;return 2;},run:async job=>{started.push(job.id);if(job.server==='server')await gate;return {committed:true};}});
 for(let i=0;i<1000;i++)queue.add(job('pending-'+i));await new Promise(r=>setImmediate(r));
 const before=limitChecks;queue.add({...job('other'),server:'other'});await new Promise(r=>setImmediate(r));
 assert.ok(started.includes('other'));assert.ok(limitChecks-before<20,'capacity checks must not scale with all waiting jobs');
 for(let i=2;i<1000;i++)queue.cancel('pending-'+i);release();await queue.idle();assert.equal(queue.list().filter(j=>j.state==='completed').length,3);queue.dispose();
});

test('history clearing preserves active jobs, other profiles and parent dependencies; retries become visible',async()=>{
 let notifications=0;
 const queue=new TransferQueue({onChange:()=>notifications++,run:async j=>{assert.equal(queue.get(j.parentId)?.state,'completed');return {committed:true};}});
 queue.restore([{...job('parent'),kind:'directory',state:'completed',finalTarget:'/renamed'},...['failed','cancelled','interrupted','skipped'].map(state=>({...job(state),state,parentId:'parent'})),{...job('other'),profileId:'other',state:'completed'},{...job('pending'),state:'queued',parentId:'parent'}]);
 assert.equal(queue.clearHistory('p','successful'),1);
 assert.equal(queue.get('parent').finalTarget,'/renamed');assert.equal(queue.get('failed').historyHidden,undefined);
 assert.equal(queue.get('other').historyHidden,undefined);assert.equal(queue.get('pending').historyHidden,undefined);
 assert.equal(queue.clearHistory('p','all'),4);assert.equal(queue.clearHistory('p','all'),0);
 let id=0;queue.retry(['failed'],()=>`new-${++id}`);
 assert.equal(queue.list().find(j=>j.retryOf==='failed').historyHidden,undefined);
 queue.pause(false);await queue.idle();assert.equal(queue.get('pending').state,'completed');
 assert.ok(notifications>=3);assert.throws(()=>queue.clearHistory(undefined,'all'));assert.throws(()=>queue.clearHistory('p','running'));queue.dispose();
});

test('clearing a captured history selection does not hide jobs that finish while confirmation is open',async()=>{
 let finish;const gate=new Promise(resolve=>{finish=resolve;});
 const queue=new TransferQueue({run:async()=>{await gate;return {committed:true};}});
 queue.restore([{...job('old'),state:'completed'}]);queue.add(job('active'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(queue.get('active').state,'running');
 assert.equal(queue.clearHistory('p','all',['active']),0);
 const selected=queue.list('p').filter(j=>j.state==='completed').map(j=>j.id);
 finish();await queue.idle();queue.clearHistory('p','all',selected);
 assert.equal(queue.get('active').historyHidden,undefined);assert.equal(queue.get('old').historyHidden,true);queue.dispose();
});
