import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../../src/application/session-manager.js';
const profile={id:'p',protocol:'sftp'};
test('session cleanup, reconnect, cancellation during late connector response and safe snapshots',async () => {
  let closes=0,disposed=0,release; const connector=async () => { let closed; return {closed:new Promise(resolve => {closed=resolve;}),close:async () => {closes++;closed();}}; };
  const credentials=async () => ({config:{password:'private'},commit:async () => {},dispose:() => {disposed++;}});
  const manager=new SessionManager({connect:connector,credentials,policy:{}});
  await manager.connect(profile); assert.equal(manager.snapshot('p').state,'connected'); assert.ok(!JSON.stringify(manager.snapshot('p')).includes('private'));
  await manager.connect(profile); assert.equal(closes,1); await manager.disconnect('p'); assert.equal(closes,2); assert.equal(disposed,2);
  const late=new SessionManager({connect:async () => {await new Promise(r => {release=r;});return connector();},credentials,policy:{}});
  const pending=late.connect(profile); while (!release) await new Promise(r => setImmediate(r));
  await late.disconnect('p'); release(); await assert.rejects(pending); assert.equal(closes,3); assert.equal(late.snapshot('p').state,'disconnected'); manager.dispose(); late.dispose();
});
