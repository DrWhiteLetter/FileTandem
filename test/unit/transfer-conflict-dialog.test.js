import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTransferConflict } from '../../src/application/transfer-conflict-dialog.js';
const request={direction:'upload',path:'/target/file',safeReplace:true};
test('replace authorizes this file in one modal, batch replacement is explicit',async () => {
  for (const [answer,apply] of [['Ersetzen',false],['Alle ersetzen',true]]) {
    let calls=0;
    const result=await chooseTransferConflict(request,async (message,options,...buttons) => {
      calls++;assert.equal(options.modal,true);assert.ok(options.detail.includes(request.path));assert.ok(buttons.some(button => button.title===answer));return answer;
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
    assert.ok(!buttons.some(button => button.title==='Ersetzen'));assert.ok(!buttons.some(button => button.title==='Alle ersetzen'));return 'Ersetzen';
  });assert.deepEqual(result,{choice:'cancel'});
});
test('abort before or during the dialog never authorizes replacement',async () => {
  const controller=new AbortController();const pending=chooseTransferConflict({...request,signal:controller.signal},async () => {controller.abort();return 'Ersetzen';});
  assert.deepEqual(await pending,{choice:'cancel'});
  assert.deepEqual(await chooseTransferConflict({...request,signal:controller.signal},() => {assert.fail('dialog after abort');}),{choice:'cancel'});
});

test('one explicit close action prevents an extra native Cancel button and never authorizes a write',async () => {
  for (const safeReplace of [true,false]) {
    const result=await chooseTransferConflict({...request,safeReplace},async (_,options,...buttons) => {
      const close=buttons.filter(button => button.isCloseAffordance);
      assert.equal(close.length,1);
      assert.equal(close[0].title,'Abbrechen');
      assert.equal(buttons.filter(button => button.title==='Abbrechen').length,1);
      return close[0];
    });
    assert.deepEqual(result,{choice:'cancel'});
  }
});
test('native message items preserve the replace-all batch decision',async () => {
  assert.deepEqual(await chooseTransferConflict(request,async (_,options,...buttons) => buttons.find(button => button.title==='Alle ersetzen')),{choice:'replace',apply:true});
});

test('localized native buttons keep cancellation and replace-all semantics',async () => {
  const {localizeVSCode}=await import('../../src/application/localized-api.js');
  for (const locale of ['de','en']) for (const cancel of [true,false]) {
    const raw={env:{language:locale},workspace:{getConfiguration:()=>({get:()=>locale})},FileSystemError:class {},window:{showWarningMessage:async (_,options,...buttons) => {
      const close=buttons.filter(button=>button.isCloseAffordance);
      assert.equal(close.length,1);assert.equal(close[0].title,locale==='de'?'Abbrechen':'Cancel');
      const replaceAll=buttons.find(button=>button.title===(locale==='de'?'Alle ersetzen':'Replace all'));
      assert.ok(replaceAll);return cancel?close[0]:replaceAll;
    }}};
    const {vscode}=localizeVSCode(raw);
    assert.deepEqual(await chooseTransferConflict(request,vscode.window.showWarningMessage),cancel?{choice:'cancel'}:{choice:'replace',apply:true});
  }
});
