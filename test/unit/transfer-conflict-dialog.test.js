import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTransferConflict } from '../../src/application/transfer-conflict-dialog.js';
const request={direction:'upload',path:'/target/file',safeReplace:true};
test('replace authorizes this file in one modal, batch replacement is explicit',async () => {
  for (const [answer,apply] of [['Ersetzen',false],['Alle weiteren ersetzen',true]]) {
    let calls=0;
    const result=await chooseTransferConflict(request,async (message,options,...buttons) => {
      calls++;assert.equal(options.modal,true);assert.ok(options.detail.includes(request.path));assert.ok(buttons.includes(answer));return answer;
    });
    assert.equal(calls,1);assert.deepEqual(result,{choice:'replace',apply});
  }
});
test('skip and keep affect only this file; dismissal and unknown choices cancel',async () => {
  for (const [answer,expected] of [['Überspringen',{choice:'skip',apply:false}],['Beide behalten',{choice:'keep',apply:false}],['Abbrechen',{choice:'cancel'}],[undefined,{choice:'cancel'}],['unexpected',{choice:'cancel'}]]) {
    assert.deepEqual(await chooseTransferConflict(request,async () => answer),expected);
  }
});
test('unsafe replacement is neither offered nor accepted',async () => {
  const result=await chooseTransferConflict({...request,safeReplace:false},async (_,options,...buttons) => {
    assert.ok(!buttons.includes('Ersetzen'));assert.ok(!buttons.includes('Alle weiteren ersetzen'));return 'Ersetzen';
  });assert.deepEqual(result,{choice:'cancel'});
});
test('abort before or during the dialog never authorizes replacement',async () => {
  const controller=new AbortController();const pending=chooseTransferConflict({...request,signal:controller.signal},async () => {controller.abort();return 'Ersetzen';});
  assert.deepEqual(await pending,{choice:'cancel'});
  assert.deepEqual(await chooseTransferConflict({...request,signal:controller.signal},() => {assert.fail('dialog after abort');}),{choice:'cancel'});
});
