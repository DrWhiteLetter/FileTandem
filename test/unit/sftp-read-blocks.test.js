import test from 'node:test';
import assert from 'node:assert/strict';
import {readBlocks,SFTP_BLOCK_BYTES,SFTP_REQUEST_WINDOW} from '../../src/adapters/sftp/read-blocks.js';

test('bounded concurrent reads handle short replies and out-of-order completion in exact file order',async()=>{
 const source=Buffer.alloc(SFTP_BLOCK_BYTES*10+137);for(let i=0;i<source.length;i++)source[i]=i%251;
 let active=0,max=0;const call=async(_method,_handle,buffer,offset,length,position)=>{
  max=Math.max(max,++active);await new Promise(r=>setTimeout(r,position%3));
  const count=Math.min(length,17000,source.length-position);source.copy(buffer,offset,position,position+count);active--;return count;
 };
 const chunks=[];for await(const chunk of readBlocks(call,null,{start:13,end:source.length})) chunks.push(chunk);
 assert.deepEqual(Buffer.concat(chunks),source.subarray(13));assert.ok(max>1 && max<=SFTP_REQUEST_WINDOW);assert.ok(chunks.every(c=>c.length<=SFTP_BLOCK_BYTES));assert.equal(active,0);
});

test('early EOF and failure wait for outstanding reads; cancellation starts no new batch',async()=>{
 let active=0;const chunks=[];
 const call=async(_method,_handle,_buffer,_offset,_length,position)=>{active++;await new Promise(r=>setTimeout(r,2));active--;return position===0 ? 0:SFTP_BLOCK_BYTES;};
 await assert.rejects(async()=>{for await(const chunk of readBlocks(call,null,{end:8*SFTP_BLOCK_BYTES}))chunks.push(chunk);},{code:'TRANSFER_INTEGRITY'});assert.equal(active,0);assert.equal(chunks.length,0);
 const controller=new AbortController();let calls=0;
 await assert.rejects(async()=>{for await(const chunk of readBlocks(async()=>{calls++;controller.abort();return SFTP_BLOCK_BYTES;},null,{end:16*SFTP_BLOCK_BYTES,signal:controller.signal}))chunks.push(chunk);},{name:'AbortError'});
 assert.ok(calls<=8);assert.equal(chunks.length,0);
});
