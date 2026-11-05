import test from 'node:test';import assert from 'node:assert/strict';
import {clearTransferHistory} from '../../src/application/transfer-history.js';

test('history confirmation cancels safely and rechecks the current profile before applying its frozen selection',async()=>{
 const jobs=[{id:'done',state:'completed'},{id:'fail',state:'failed'},{id:'active',state:'running'}];let applied,confirmed=0;
 const queue={list:owner=>{assert.equal(owner,'p');return jobs;},clearHistory:(...args)=>{applied=args;return args[2].length;}};
 const options={queue,profileId:'p',mode:'all',isCurrent:()=>true,confirm:async()=>{confirmed++;return false;}};
 assert.equal(await clearTransferHistory(options),0);assert.equal(applied,undefined);
 assert.equal(await clearTransferHistory({...options,confirm:async()=>true,isCurrent:()=>false}),0);assert.equal(applied,undefined);
 assert.equal(await clearTransferHistory({...options,confirm:async()=>{jobs[2].state='completed';return true;}}),2);
 assert.deepEqual(applied,['p','all',['done','fail']]);
 applied=undefined;assert.equal(await clearTransferHistory({...options,mode:'successful'}),2);assert.equal(confirmed,1);assert.deepEqual(applied[2],['done','active']);
});
