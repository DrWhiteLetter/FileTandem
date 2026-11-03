import test from 'node:test';
import assert from 'node:assert/strict';
import {TransferChannels} from '../../src/adapters/sftp/transfer-channels.js';
const session=()=>{let disconnect;return {closed:new Promise(r=>{disconnect=r;}),disconnect:()=>disconnect()};};
function fixture(options={}) {
 const opened=[];const pool=new TransferChannels({open:async owner=>{const file={owner,closed:false,close(){this.closed=true;}};opened.push(file);return file;},...options});return {pool,opened};
}
test('transfer channels are exclusive, reused within a transport, and isolated after reconnect',async()=>{
 const {pool,opened}=fixture(),a=session(),b=session();
 try {
  const first=await pool.acquire(a),second=await pool.acquire(a);assert.notEqual(first.files,second.files);
  first.release();const third=await pool.acquire(a);assert.equal(third.files,first.files);
  const other=await pool.acquire(b);assert.notEqual(other.files,third.files);assert.equal(opened.length,3);
  second.release();third.release();other.release();a.disconnect();await Promise.resolve();
  assert.ok(first.files.closed && second.files.closed);assert.equal(other.files.closed,false);
 } finally {pool.dispose();}
 assert.ok(opened.every(f=>f.closed));
});
test('aborted, failed, and externally closed channels are never reused',async()=>{
 const {pool}=fixture(),a=session(),abort=new AbortController();
 try {
  const first=await pool.acquire(a,abort.signal);abort.abort();first.release();assert.ok(first.files.closed);
  const second=await pool.acquire(a);assert.notEqual(second.files,first.files);second.release(false);
  const third=await pool.acquire(a);assert.notEqual(third.files,second.files);third.files.close();third.release();
  const fourth=await pool.acquire(a);assert.notEqual(fourth.files,third.files);fourth.release();fourth.release();
  assert.equal(pool.entries.size,1);
 } finally {pool.dispose();}
});
test('idle channels expire and disposal during open closes the late channel',async()=>{
 const {pool}=fixture({idleMs:5}),a=session();const first=await pool.acquire(a);first.release();
 await new Promise(r=>setTimeout(r,20));assert.ok(first.files.closed);assert.equal(pool.entries.size,0);pool.dispose();
 let complete;const files={closed:false,close(){this.closed=true;}};
 const pendingPool=new TransferChannels({open:()=>new Promise(r=>{complete=r;})});
 const pending=pendingPool.acquire(a);pendingPool.dispose();complete(files);
 await assert.rejects(pending,/closed/);assert.ok(files.closed);
});
