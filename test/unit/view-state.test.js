import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreViewState,defaultViewState,restoredSessionId } from '../../src/shared/view-state.js';
test('restore bounded UI state without credentials, paths outside demo, or reconnect settings', () => {
  const state=restoreViewState({version:1,sessionId:'valid-session',paths:{local:'/Desktop/Demo/assets',remote:'/etc'},sorts:{local:{column:'size',direction:'desc'}},split:61,queueOpen:false,hidden:true,password:'secret',connect:true});
  assert.equal(state.paths.local,'/Desktop/Demo/assets'); assert.equal(state.paths.remote,'/srv/demo');
  assert.deepEqual(state.sorts.local,{column:'size',direction:'desc'}); assert.equal(state.split,61); assert.equal(state.queueOpen,false);
  assert.equal(state.password,undefined); assert.equal(state.connect,undefined);
  assert.deepEqual(restoreViewState({version:2,split:999}),defaultViewState());
  assert.equal(restoredSessionId({sessionId:'bad<script>'}),undefined);
});
