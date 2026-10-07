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
