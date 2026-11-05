import test from 'node:test';import assert from 'node:assert/strict';import { mkdtemp,readFile,writeFile,readdir,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { TransferJournal } from '../../src/application/transfer-journal.js';import { TransferQueue } from '../../src/application/transfer-queue.js';
const job={id:'job',batchId:'batch',profileId:'profile',server:'host:22',direction:'upload',source:'/source',target:'/target',lockKey:'remote:host:22:/target',kind:'file',state:'running',bytes:5,rate:10,started:100,error:'',metadata:{mode:420,modified:123}};
test('atomic journal projects metadata and restores interrupted jobs without automatic execution',async () => {
 const directory=await mkdtemp(join(tmpdir(),'xscp-journal-'));try {
 const path=join(directory,'journal.json'),journal=new TransferJournal(path);journal.update([{...job,password:'never-persist',privateKey:'never-persist'}]);await journal.flush();
 assert.ok(!(await readFile(path,'utf8')).includes('never-persist'));assert.deepEqual(await readdir(directory),['journal.json']);
 const restored=await journal.load();assert.equal(restored[0].state,'interrupted');let executions=0;const queue=new TransferQueue({run:async () => {executions++;}});queue.restore(restored);await new Promise(r => setTimeout(r,20));assert.equal(executions,0);queue.retry(['job'],(() => {let n=0;return () => 'retry'+ ++n;})());await queue.idle();assert.equal(executions,1);queue.dispose();
 } finally {await rm(directory,{recursive:true,force:true});}
});
test('corrupt journal is quarantined and invalid entries are discarded',async () => {
 const directory=await mkdtemp(join(tmpdir(),'xscp-journal-'));try {const path=join(directory,'journal.json'),errors=[],journal=new TransferJournal(path,m => errors.push(m));await writeFile(path,'{broken');assert.deepEqual(await journal.load(),[]);assert.ok((await readdir(directory)).some(n => n.includes('.corrupt-')));await writeFile(path,JSON.stringify({version:1,jobs:[job,{...job,id:'bad',password:'secret'}]}));assert.equal((await journal.load()).length,1);assert.equal(errors.length,2);} finally {await rm(directory,{recursive:true,force:true});}
});
test('signed journal detects edited paths and retains only safe unsigned M3 history',async () => {
 const directory=await mkdtemp(join(tmpdir(),'xscp-journal-mac-'));try {const path=join(directory,'journal.json'),journal=new TransferJournal(path);journal.key=Buffer.alloc(32,7);journal.update([job]);await journal.flush();assert.equal((await journal.load()).length,1);const value=JSON.parse(await readFile(path,'utf8'));value.jobs[0].target='/foreign';await writeFile(path,JSON.stringify(value));assert.deepEqual(await journal.load(),[]);assert.ok((await readdir(directory)).some(n => n.includes('.corrupt-')));await writeFile(path,JSON.stringify({version:1,jobs:[job]}));assert.equal((await journal.load()).length,1);} finally {await rm(directory,{recursive:true,force:true});}
});
test('unavailable secure storage disables journal operations without overwriting existing history',async () => {
 const directory=await mkdtemp(join(tmpdir(),'xscp-journal-disabled-'));try {const path=join(directory,'journal.json');await writeFile(path,'keep-existing-history');const journal=new TransferJournal(path);journal.disabled=true;assert.deepEqual(await journal.load(),[]);journal.update([job]);await journal.flush();assert.equal(await readFile(path,'utf8'),'keep-existing-history');} finally {await rm(directory,{recursive:true,force:true});}
});

test('cleared history survives journal reload with dependency metadata intact',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'filetandem-history-'));
 try {
  const journal=new TransferJournal(join(directory,'journal.json'));const queue=new TransferQueue({run:async()=>{},onChange:jobs=>journal.update(jobs)});
  queue.restore([{...job,state:'completed',kind:'directory',finalTarget:'/renamed'},{...job,id:'child',state:'failed',parentId:'job'}]);queue.clearHistory('profile','successful');await journal.flush();
  const restored=await journal.load();assert.equal(restored.find(j=>j.id==='job').historyHidden,true);assert.equal(restored.find(j=>j.id==='job').finalTarget,'/renamed');assert.equal(restored.find(j=>j.id==='child').historyHidden,undefined);
  queue.dispose();await journal.flush();
 } finally {await rm(directory,{recursive:true,force:true});}
});
