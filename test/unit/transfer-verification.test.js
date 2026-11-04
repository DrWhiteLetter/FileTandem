import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {transferFile} from '../../src/application/transfer-file.js';import {localTarget} from '../../src/adapters/local/transfer-target.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
async function fixture(t) {
 const directory=await mkdtemp(join(tmpdir(),'filetandem-verify-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const source=join(directory,'source'),target=join(directory,'target');await writeFile(source,'data');await writeFile(target,'old');
 return {source,target,job:{id:randomUUID(),protocol:'sftp',direction:'upload',source,target}};
}
test('full verification catches same-size target corruption; explicit fast mode omits content readback',async t=>{
 const {job,target}=await fixture(t);let reads=0;const adapter={...localTarget,hash:async(...args)=>{reads++;return localTarget.hash(...args);}};
 const stream=async(_session,{remote})=>{await writeFile(remote,'oops');return {bytes:4,sha256:sha('data')};};
 await assert.rejects(transferFile(null,job,{target:adapter,source:localTarget,replace:true,stream}),{code:'TRANSFER_INTEGRITY'});assert.equal(await readFile(target,'utf8'),'old');assert.equal(reads,1);
 const result=await transferFile(null,{...job,id:randomUUID()},{target:adapter,source:localTarget,replace:true,verification:'size',stream});
 assert.equal(reads,1);assert.equal(result.verification,'size');assert.equal(result.committed,true);assert.equal(await readFile(target,'utf8'),'oops');
});
test('fast mode still rejects wrong size, changed source, changed destination, and cancellation',async t=>{
 const {job,target}=await fixture(t);
 for(const scenario of ['size','source','target','abort']) {
  const controller=new AbortController();await writeFile(target,'old');
  const adapter={...localTarget,prepare:async()=>{if(scenario==='target')await writeFile(target,'external change');if(scenario==='abort')controller.abort();}};
  const stream=async(_session,{remote})=>{await writeFile(remote,scenario==='size'?'x':'data');return {bytes:4,sha256:sha(scenario==='source'?'oops':'data')};};
  await assert.rejects(transferFile(null,{...job,id:randomUUID()},{target:adapter,source:localTarget,replace:true,verification:'size',signal:controller.signal,stream}));
  assert.equal(await readFile(target,'utf8'),scenario==='target'?'external change':'old');
 }
});
test('fast mode cannot be used for download, SCP, resume, automatic or reviewed uploads',async()=>{
 for(const extra of [{direction:'download'},{protocol:'scp'},{resumeFrom:'previous'},{automatic:true},{reviewedReplacement:'a'.repeat(64)},{expectedTarget:null}]) {
  await assert.rejects(transferFile(null,{protocol:'sftp',direction:'upload',...extra},{verification:'size'}),/verification mode/);
 }
});
