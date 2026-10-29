import test from 'node:test';
import assert from 'node:assert/strict';
import { coalescedRefresh } from '../../src/application/coalesced-refresh.js';

test('transfer refresh batches bursts, serializes requests and cancels work on disposal',async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let calls=0,release;
  const refresh=coalescedRefresh(() => {calls++;return new Promise(resolve => {release=resolve;});});
  refresh.request();refresh.request();refresh.request();
  t.mock.timers.tick(249);assert.equal(calls,0);
  t.mock.timers.tick(1);assert.equal(calls,1);
  refresh.request();refresh.request();t.mock.timers.tick(1000);assert.equal(calls,1,'no concurrent listings');
  release();await Promise.resolve();
  t.mock.timers.tick(250);assert.equal(calls,2,'one follow-up includes changes during the first listing');
  refresh.request();refresh.dispose();release();await Promise.resolve();
  t.mock.timers.tick(1000);assert.equal(calls,2,'closing the panel cancels pending follow-up');
  refresh.request();t.mock.timers.tick(1000);assert.equal(calls,2);
});

test('closing during the batching window cancels the timer',t => {
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  const refresh=coalescedRefresh(() => {calls++;});
  refresh.request();refresh.dispose();t.mock.timers.tick(250);assert.equal(calls,0);
});
