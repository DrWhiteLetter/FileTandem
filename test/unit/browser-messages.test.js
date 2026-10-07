import test from 'node:test';
import assert from 'node:assert/strict';
import { browserRequest } from '../../src/shared/browser-messages.js';
import { browserViewState } from '../../src/shared/browser-view-state.js';
test('browser requests isolate sessions and reject shell, secrets and forged extra fields',() => {
  const request={version:1,type:'action',sessionId:'session-a',id:'request',side:'remote',action:'delete',ids:['/folder/file']};
  assert.equal(browserRequest(request,'session-a'),true);assert.equal(browserRequest(request,'session-b'),false);
  for (const extra of [{password:'secret'},{command:'rm -rf /'},{path:'/other'}]) assert.equal(browserRequest({...request,...extra},'session-a'),false);
  assert.equal(browserRequest({...request,action:'exec'},'session-a'),false);assert.equal(browserRequest({...request,ids:['a','a']},'session-a'),false);
  const restored=browserViewState({version:1,profileId:'p1',password:'secret',split:999,panes:{local:{favorites:['/path'],sort:{column:'size',direction:'desc'}}}});
  assert.equal(restored.password,undefined);assert.equal(restored.split,50);assert.equal(restored.profileId,'p1');assert.deepEqual(restored.panes.local.sort,{column:'size',direction:'desc'});
});
