import test from 'node:test';import assert from 'node:assert/strict';
import { TransferQueue } from '../../src/application/transfer-queue.js';
import { transition,batchState } from '../../src/domain/transfer-job.js';
const job=(id,target=id) => ({id,batchId:'batch',profileId:'p',server:'server',source:'/src',target:'/dst/'+target,lockKey:'remote:/'+target,direction:'upload'});
test('queue enforces server limit, destination locks, transitions and partial batch failure',async () => {
  let active=0,max=0;const locks=new Set();const queue=new TransferQueue({run:async j => {assert.ok(!locks.has(j.lockKey));locks.add(j.lockKey);max=Math.max(max,++active);await new Promise(r => setTimeout(r,10));active--;locks.delete(j.lockKey);if (j.id === 'fail') throw new Error('failure');return {bytes:1};}});
  for (const j of [job('a','same'),job('b','same'),job('c'),job('fail')]) queue.add(j);
  await queue.idle();assert.equal(max,2);assert.equal(queue.batches()[0].state,'failed');assert.throws(() => transition({state:'completed'},'running'));assert.equal(batchState([{state:'completed'},{state:'failed'}]),'failed');queue.dispose();
});
