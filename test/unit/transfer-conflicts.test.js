import test from 'node:test';import assert from 'node:assert/strict';import { ConflictRules } from '../../src/application/transfer-conflicts.js';
const job={batchId:'batch',direction:'upload',target:'/file'};
const target={atomicReplace:true,stat:async p => {if (['/file','/file-2'].includes(p)) return {kind:'file'};throw Object.assign(new Error(),{code:'ENOENT'});},alternative:(p,n) => p+'-'+n};
test('all conflict decisions, safe replacement, alternate collisions and batch-only rules',async () => {
  for (const choice of ['replace','skip','keep']) {let calls=0;const rules=new ConflictRules(async info => {calls++;assert.equal(info.path,'/file');return {choice,apply:true};});const result=await rules.resolve(job,target);assert.equal(result.replace,choice === 'replace' ? true:choice === 'keep' ? false:undefined);if (choice === 'keep') assert.equal(result.path,'/file-3');await rules.resolve(job,target);assert.equal(calls,1);await rules.resolve({...job,batchId:'other'},target);assert.equal(calls,2);}
  await assert.rejects(new ConflictRules(async () => ({choice:'cancel'})).resolve(job,target),/abgebrochen/);
  await assert.rejects(new ConflictRules(async () => ({choice:'replace'})).resolve(job,{...target,atomicReplace:false}),/Ungültige/);
});
test('cancelling a pending conflict releases the wait and ignores late decisions',async () => {
 let answer;const rules=new ConflictRules(() => new Promise(resolve => {answer=resolve;}));const controller=new AbortController();const pending=rules.resolve(job,target,controller.signal);while (!answer) await new Promise(r => setImmediate(r));controller.abort();await assert.rejects(pending);answer({choice:'replace',apply:true});await new Promise(r => setImmediate(r));assert.equal(rules.rules.size,0);
});

test('parallel files share the replace-all decision of their batch',async () => {
  let calls=0,answer;
  const decision=new Promise(resolve => {answer=resolve;});
  const rules=new ConflictRules(async () => {calls++;return decision;});
  const pending=[rules.resolve(job,target),rules.resolve({...job,target:'/file-2'},target)];
  await new Promise(resolve => setImmediate(resolve));
  answer({choice:'replace',apply:true});
  assert.deepEqual(await Promise.all(pending),[{path:'/file',replace:true},{path:'/file-2',replace:true}]);
  assert.equal(calls,1,'A parallel file must wait for the batch decision before opening another dialog');
});

test('single-file decisions still ask for the next parallel conflict',async () => {
  let calls=0;
  const rules=new ConflictRules(async () => ({choice:++calls===1 ? 'skip':'replace',apply:false}));
  const results=await Promise.all([rules.resolve(job,target),rules.resolve({...job,target:'/file-2'},target)]);
  assert.deepEqual(results,[{skipped:true},{path:'/file-2',replace:true}]);assert.equal(calls,2);
});

test('cancelling a waiting file does not open a dialog or let later files overtake the batch decision',async () => {
  let calls=0,answer;const decision=new Promise(resolve => {answer=resolve;});
  const rules=new ConflictRules(async () => {calls++;return decision;});
  const first=rules.resolve(job,target);
  await new Promise(resolve => setImmediate(resolve));
  const controller=new AbortController();const second=rules.resolve(job,target,controller.signal);
  controller.abort();await assert.rejects(second,{name:'AbortError'});
  const third=rules.resolve({...job,target:'/file-2'},target);
  await new Promise(resolve => setImmediate(resolve));assert.equal(calls,1);
  answer({choice:'replace',apply:true});
  assert.deepEqual(await Promise.all([first,third]),[{path:'/file',replace:true},{path:'/file-2',replace:true}]);
  await new Promise(resolve => setImmediate(resolve));assert.equal(rules.pending.size,0);
});

test('independent batches can prompt independently and never share replacement permission',async () => {
  let calls=0,answer;const decision=new Promise(resolve => {answer=resolve;});
  const rules=new ConflictRules(async () => {calls++;return decision;});
  const first=rules.resolve(job,target),second=rules.resolve({...job,batchId:'other'},target);
  await new Promise(resolve => setImmediate(resolve));assert.equal(calls,2);
  answer({choice:'replace',apply:true});await Promise.all([first,second]);
});

test('replace-all never authorizes replacing a directory in a parallel conflict',async () => {
  let calls=0;
  const rules=new ConflictRules(async info => {
    calls++;
    return info.safeReplace ? {choice:'replace',apply:true}:{choice:'skip',apply:false};
  });
  const directory={...target,stat:async () => ({kind:'directory'})};
  const results=await Promise.all([rules.resolve(job,target),rules.resolve({...job,target:'/directory'},directory)]);
  assert.deepEqual(results,[{path:'/file',replace:true},{skipped:true}]);assert.equal(calls,2);
});

test('metadata requests overlap while replace-all still produces one dialog',async()=>{
 let calls=0,release;const gate=new Promise(r=>{release=r;});let dialogs=0;
 const rules=new ConflictRules(async()=>{dialogs++;return {choice:'replace',apply:true};});
 const parallelTarget={...target,stat:async()=>{calls++;await gate;return {kind:'file'};}};
 const pending=[rules.resolve(job,parallelTarget),rules.resolve({...job,target:'/other'},parallelTarget)];
 await new Promise(r=>setImmediate(r));assert.equal(calls,2);release();await Promise.all(pending);assert.equal(dialogs,1);
});
