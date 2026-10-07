import test from 'node:test';
import assert from 'node:assert/strict';
import { ManagerSessions } from '../../src/application/manager-sessions.js';
import { validateRequest } from '../../src/shared/messages.js';
const request = { version: 1, type: 'ready', id: 'request-1', sessionId: 'session-1' };
test('Webview envelope rejects cross-session, credentials, exec, malformed and replayed messages', () => {
  for (const value of [null, [], {}, {...request,version:2}, {...request, sessionId:'other'}, {...request, password:'secret'}, {...request,type:'exec'}, {...request,id:'../escape'}, {...request,type:'setScenario',scenario:'arbitrary'}]) assert.equal(validateRequest(value,'session-1'),false);
  const sessions = new ManagerSessions(); sessions.create('session-1',{local:true,windowRemoteName:null});
  assert.equal(sessions.handle('other',request),undefined);
  assert.equal(sessions.handle('session-1',request).location.local,true);
  assert.equal(sessions.handle('session-1',request),undefined);
  assert.equal(sessions.handle('session-1',{...request,id:'2',type:'setScenario',scenario:'error'}).scenario,'error');
  sessions.remove('session-1'); assert.equal(sessions.handle('session-1',{...request,id:'3'}),undefined);
});
