import test from 'node:test';import assert from 'node:assert/strict';
import {transferView,transferProgress} from '../../src/shared/transfer-view.js';
import {transferRefreshSides} from '../../src/application/transfer-refresh.js';
import {transferResponse} from '../../src/shared/browser-messages.js';
test('bounded history keeps all totals and retry IDs, omitting checkpoints and hidden row details',()=>{
 const jobs=Array.from({length:1500},(_,i)=>({id:'job-'+i,state:i===0?'failed':i<1300?'queued':'completed',source:'/local/'+i,target:'/remote/'+i,attempt:{sourceHash:'secret-to-view'}}));
 const view=transferView(jobs);assert.equal(view.queue.length,200);assert.deepEqual({...view.queueSummary,progress:undefined},{progress:undefined,total:1500,active:1299,failures:1,successful:200,settled:201,retryIds:['job-0']});assert.equal(view.queue[0].attempt,true);assert.ok(!JSON.stringify(view).includes('secret-to-view'));
 const message={version:1,type:'transferModel',sessionId:'p',queuePaused:false,...view};assert.ok(transferResponse(message,'p'));assert.equal(transferResponse(message,'other'),false);
});
test('uploads refresh only the visible target directory; nested transfers do not rescan its ancestor',()=>{
 const paths={local:'/local',remote:'/remote'};
 assert.deepEqual([...transferRefreshSides([{direction:'upload',target:'/remote/file'}],paths)],['remote']);
 assert.equal(transferRefreshSides([{direction:'upload',target:'/remote/nested/file'}],paths).size,0);
 assert.deepEqual([...transferRefreshSides([{direction:'download',target:'/local/file'}],paths)],['local']);
 assert.deepEqual([...transferRefreshSides([{direction:'upload',target:'/remote/file'}],paths,{localMode:true})],['remote']);
});

test('progress excludes old history and reports all active batches, errors and live rates',()=>{
 const jobs=[{batchId:'old',state:'completed',bytes:9000,rate:900},{batchId:'a',state:'completed',bytes:100,rate:100},{batchId:'a',state:'running',bytes:50,rate:25},{batchId:'b',state:'queued'},{batchId:'b',state:'failed',bytes:10}];
 assert.deepEqual(transferProgress(jobs),{total:4,settled:2,completed:1,failed:1,skipped:0,cancelled:0,running:1,bytes:160,rate:25});
 jobs[2].state='completed';jobs[3].state='cancelled';
 assert.deepEqual(transferProgress(jobs),{total:2,settled:2,completed:0,failed:1,skipped:0,cancelled:1,running:0,bytes:10,rate:0});
 assert.equal(transferProgress([]).total,0);
});

test('cleared entries disappear from rows and retry totals while batch progress stays accurate',()=>{
 const jobs=[{id:'done',batchId:'b',state:'completed',historyHidden:true,bytes:100},{id:'failed',batchId:'b',state:'failed',historyHidden:true},{id:'active',batchId:'b',state:'running',bytes:50}];
 let view=transferView(jobs);assert.deepEqual(view.queue.map(j=>j.id),['active']);assert.equal(view.queueSummary.failures,0);assert.deepEqual(view.queueSummary.retryIds,[]);assert.equal(view.queueSummary.progress.total,3);assert.equal(view.queueSummary.progress.bytes,150);
 jobs[2].state='completed';view=transferView(jobs);assert.equal(view.queueSummary.successful,1);assert.equal(view.queueSummary.progress.total,3);
 jobs[2].historyHidden=true;view=transferView(jobs);assert.equal(view.queueSummary.total,0);assert.equal(view.queueSummary.progress.total,0);
});
