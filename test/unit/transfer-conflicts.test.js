import test from 'node:test';import assert from 'node:assert/strict';import { ConflictRules } from '../../src/application/transfer-conflicts.js';
const job={batchId:'batch',direction:'upload',target:'/file'};
const target={atomicReplace:true,stat:async p => {if (['/file','/file-2'].includes(p)) return {kind:'file'};throw Object.assign(new Error(),{code:'ENOENT'});},alternative:(p,n) => p+'-'+n};
test('all conflict decisions, safe replacement, alternate collisions and batch-only rules',async () => {
  for (const choice of ['replace','skip','keep']) {let calls=0;const rules=new ConflictRules(async info => {calls++;assert.equal(info.path,'/file');return {choice,apply:true};});const result=await rules.resolve(job,target);assert.equal(result.replace,choice === 'replace' ? true:choice === 'keep' ? false:undefined);if (choice === 'keep') assert.equal(result.path,'/file-3');await rules.resolve(job,target);assert.equal(calls,1);await rules.resolve({...job,batchId:'other'},target);assert.equal(calls,2);}
  await assert.rejects(new ConflictRules(async () => ({choice:'cancel'})).resolve(job,target),/abgebrochen/);
  await assert.rejects(new ConflictRules(async () => ({choice:'replace'})).resolve(job,{...target,atomicReplace:false}),/Ungültige/);
});
