import test from 'node:test';import assert from 'node:assert/strict';
import { browserSettings,browserDrag } from '../../src/shared/browser-settings.js';
import { browserRequest } from '../../src/shared/browser-messages.js';
test('Settings and internal drag reject malformed values, other sessions and stale destinations at bridge boundary',() => {
  assert.deepEqual(browserSettings(() => 'true'),{showHiddenFiles:false,commanderKeys:false});
  const drag={version:1,sessionId:'owned',side:'local',ids:['/file']};assert.equal(browserDrag(drag,'owned'),true);assert.equal(browserDrag(drag,'other'),false);assert.equal(browserDrag({...drag,secret:'never'},'owned'),false);assert.equal(browserDrag({...drag,ids:['/file','/file']},'owned'),false);
  const transfer={version:1,id:'request',sessionId:'owned',type:'transfer',side:'local',ids:['/file'],destination:'opposite',destinationPath:'/target'};assert.equal(browserRequest(transfer,'owned'),true);assert.equal(browserRequest({...transfer,destinationPath:'bad\0path'},'owned'),false);assert.equal(browserRequest({...transfer,overwrite:true},'owned'),false);
});
