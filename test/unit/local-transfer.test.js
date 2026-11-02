import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {TransferEngine} from '../../src/application/transfer-engine.js';
import {LOCAL_PROFILE_ID,copyLocalFile} from '../../src/application/local-transfer.js';
import {journalJob} from '../../src/application/transfer-journal.js';
import {filePolicy} from '../../src/application/file-policy.js';
async function fixture(t,choose=async()=>({choice:'replace',apply:true})) {
 const base=await mkdtemp(join(tmpdir(),'filetandem-local-')),left=join(base,'left'),right=join(base,'right');await mkdir(left);await mkdir(right);
 const unexpected=()=>{throw new Error('Local copies must not access SSH profiles or sessions');};
 const engine=new TransferEngine({sessions:{transport:unexpected,matches:unexpected},profiles:{get:unexpected},choose,getPolicy:()=>filePolicy()});
 t.after(async()=>{engine.dispose();await rm(base,{recursive:true,force:true});});return {base,left,right,engine};
}
test('local queue copies selections and nested folders in both directions without an SSH profile',async t=>{
 let prompts=0;const f=await fixture(t,async()=>{prompts++;return {choice:'replace',apply:true};});
 for(const name of ['a.txt','b.txt']) {await writeFile(join(f.left,name),'new '+name);await writeFile(join(f.right,name),'old');}
 await mkdir(join(f.left,'tree'));await mkdir(join(f.left,'tree','empty'));await writeFile(join(f.left,'tree','nested'),'nested');await writeFile(join(f.left,'tree','.env'),'excluded');
 await f.engine.submitLocal('upload',['a.txt','b.txt','tree'].map(name=>join(f.left,name)),f.right);await f.engine.queue.idle();
 assert.equal(prompts,1);assert.ok(f.engine.queue.list().every(job=>job.state==='completed'));assert.equal(await readFile(join(f.right,'a.txt'),'utf8'),'new a.txt');assert.deepEqual((await readdir(join(f.right,'tree'))).sort(),['empty','nested']);
 await writeFile(join(f.right,'back.txt'),'right to left');await f.engine.submitLocal('download',[join(f.right,'back.txt')],f.left);await f.engine.queue.idle();assert.equal(await readFile(join(f.left,'back.txt'),'utf8'),'right to left');
 for(const job of f.engine.queue.list()) {assert.equal(job.profileId,LOCAL_PROFILE_ID);assert.equal(journalJob(job).protocol,'local');}
});
test('local copies reject self copies and descendant targets, including directory aliases',async t=>{
 const f=await fixture(t);await writeFile(join(f.left,'file'),'keep');await mkdir(join(f.left,'child'));
 await assert.rejects(f.engine.submitLocal('upload',[join(f.left,'file')],f.left),/onto itself/);
 await assert.rejects(f.engine.submitLocal('upload',[f.left],join(f.left,'child')),/own folder/);
 await symlink(f.left,join(f.base,'alias'),'junction');await assert.rejects(f.engine.submitLocal('upload',[f.left],join(f.base,'alias')),/own folder/);
 assert.equal(f.engine.queue.list().length,0);assert.equal(await readFile(join(f.left,'file'),'utf8'),'keep');
});
test('local keep-both and skip choices preserve existing destination files',async t=>{
 const f=await fixture(t,async()=>({choice:'keep',apply:false}));await writeFile(join(f.left,'file.txt'),'new');await writeFile(join(f.right,'file.txt'),'old');
 await f.engine.submitLocal('upload',[join(f.left,'file.txt')],f.right);await f.engine.queue.idle();assert.equal(await readFile(join(f.right,'file (2).txt'),'utf8'),'new');assert.equal(await readFile(join(f.right,'file.txt'),'utf8'),'old');
 f.engine.conflicts.choose=async()=>({choice:'skip'});await f.engine.submitLocal('upload',[join(f.left,'file.txt')],f.right);await f.engine.queue.idle();assert.equal(f.engine.queue.list().at(-1).state,'skipped');
});
test('aborted local stream preserves the destination and removes its own partial file',async t=>{
 const f=await fixture(t),source=join(f.left,'large'),target=join(f.right,'large');await writeFile(source,Buffer.alloc(1024*1024,7));await writeFile(target,'preserve');const controller=new AbortController();
 await assert.rejects(copyLocalFile({id:randomUUID(),source,target,direction:'upload',protocol:'local'},{replace:true,signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
 assert.equal(await readFile(target,'utf8'),'preserve');assert.deepEqual(await readdir(f.right),['large']);
});
