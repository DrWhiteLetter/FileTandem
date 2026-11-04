import test from 'node:test';import assert from 'node:assert/strict';
import {transferView} from '../../src/shared/transfer-view.js';
import {transferRefreshSides} from '../../src/application/transfer-refresh.js';
import {transferResponse} from '../../src/shared/browser-messages.js';
test('bounded history keeps all totals and retry IDs, omitting checkpoints and hidden row details',()=>{
 const jobs=Array.from({length:1500},(_,i)=>({id:'job-'+i,state:i===0?'failed':i<1300?'queued':'completed',source:'/local/'+i,target:'/remote/'+i,attempt:{sourceHash:'secret-to-view'}}));
 const view=transferView(jobs);assert.equal(view.queue.length,200);assert.deepEqual(view.queueSummary,{total:1500,active:1299,failures:1,retryIds:['job-0']});assert.equal(view.queue[0].attempt,true);assert.ok(!JSON.stringify(view).includes('secret-to-view'));
 const message={version:1,type:'transferModel',sessionId:'p',queuePaused:false,...view};assert.ok(transferResponse(message,'p'));assert.equal(transferResponse(message,'other'),false);
});
test('uploads refresh only the visible target directory; nested transfers do not rescan its ancestor',()=>{
 const paths={local:'/local',remote:'/remote'};
 assert.deepEqual([...transferRefreshSides([{direction:'upload',target:'/remote/file'}],paths)],['remote']);
 assert.equal(transferRefreshSides([{direction:'upload',target:'/remote/nested/file'}],paths).size,0);
 assert.deepEqual([...transferRefreshSides([{direction:'download',target:'/local/file'}],paths)],['local']);
 assert.deepEqual([...transferRefreshSides([{direction:'upload',target:'/remote/file'}],paths,{localMode:true})],['remote']);
});
