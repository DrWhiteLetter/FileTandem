import test from 'node:test';import assert from 'node:assert/strict';import { localizeVSCode } from '../../src/application/localized-api.js';
test('English native dialogs preserve canonical choices, profile records and unmodified input values',async () => {
 const captured=[];const box={value:'Passwort',show(){return this.title;}};class FileError extends Error {static NoPermissions(message){return new FileError(message);}}
 const raw={env:{language:'en'},workspace:{getConfiguration:()=>({get:()=> 'auto'})},FileSystemError:FileError,window:{showWarningMessage:async (...args)=>{captured.push(args);return args.at(-1);},showQuickPick:async values=>{captured.push(values);return values[0];},showInputBox:async value=>{captured.push(value);assert.equal(await value.validateInput('x'),'Invalid permissions.');return value.value;},createInputBox:()=>box}};
 const {vscode}=localizeVSCode(raw);assert.equal(await vscode.window.showWarningMessage('Remote-Datei zum Bearbeiten freigeben?',{modal:true,detail:'Nicht verbunden.'},'Bearbeitung freigeben'),'Bearbeitung freigeben');assert.equal(captured[0][0],'Enable editing of this remote file?');assert.equal(captured[0][1].detail,'Not connected.');assert.equal(captured[0][2],'Enable editing');
 assert.equal(await vscode.window.showQuickPick(['Nur für diese Verbindung']),'Nur für diese Verbindung');const profile={id:'secret-free-profile'},choice={label:'Passwort',value:'password',profile};assert.equal(await vscode.window.showQuickPick([choice]),choice);assert.equal(captured.at(-1)[0].label,'Passwort');assert.equal(captured.at(-1)[0].profile,profile);
 assert.equal(await vscode.window.showInputBox({title:'Passwort',value:'Passwort',validateInput:()=> 'Ungültige Rechte.'}),'Passwort');const input=vscode.window.createInputBox();input.title='Passwort';assert.equal(input.show(),'Password');assert.equal(input.value,'Passwort');assert.equal(vscode.FileSystemError.NoPermissions('Nicht verbunden.').message,'Not connected.');
});

test('auto uses VS Code l10n with English keys and intact interpolation arguments',async () => {
 const {formatMessage}=await import('../../src/shared/localization.js');
 const german=JSON.parse(await (await import('node:fs/promises')).readFile('l10n/bundle.l10n.de.json','utf8'));
 for (const locale of ['de','de-DE','en','en-US','fr']) {
  const calls=[];const captured=[];let requested='auto';
  const raw={env:{language:locale},workspace:{getConfiguration:()=>({get:()=>requested})},FileSystemError:class {},
   l10n:{t:(key,...args)=>{calls.push([key,args]);return formatMessage(locale.startsWith('de') ? german[key] ?? key:key,args);}},
   window:{showWarningMessage:async(...args)=>{captured.push(args);return args.at(-1);}}};
  const {vscode,language,t}=localizeVSCode(raw);
  assert.equal(language(),locale.startsWith('de')?'de':'en');
  const endpoint='host-$&-[test]:22';
  assert.equal(t(`SSH host key changed: ${endpoint}`),`${locale.startsWith('de')?'SSH-Host-Key geändert':'SSH host key changed'}: ${endpoint}`);
  assert.deepEqual(calls.at(-1),['SSH host key changed: {0}',[endpoint]]);
  assert.equal(await vscode.window.showWarningMessage('Not connected.',{modal:true},'Cancel'),'Cancel','localized selection returns the English action, not the displayed label');
  assert.equal(captured.at(-1).at(-1),locale.startsWith('de')?'Abbrechen':'Cancel');
  requested='de';const before=calls.length;assert.equal(t('Password'),'Passwort');assert.equal(calls.length,before,'manual override uses the same shared catalog');
  requested='en';assert.equal(t('Passwort'),'Password');
  assert.equal(t('/home/Größe [test].txt'),'/home/Größe [test].txt');
 }
});

test('German and English host-key choices reach the same trust decision',async () => {
 const {changedHostKeyDialog}=await import('../../src/vscode/host-key-dialog.js');
 const {formatMessage}=await import('../../src/shared/localization.js');
 const german=JSON.parse(await (await import('node:fs/promises')).readFile('l10n/bundle.l10n.de.json','utf8'));
 const request={endpoint:{label:'example.test:22'},expected:{algorithm:'ssh-ed25519',fingerprint:'SHA256:old'},received:{algorithm:'ssh-ed25519',fingerprint:'SHA256:new'}};
 for (const locale of ['de','en']) {
  for (const action of ['Trust without verification and connect','Verify new key …',undefined]) {
   let inputs=0;
   const raw={env:{language:locale},workspace:{getConfiguration:()=>({get:()=> 'auto'})},FileSystemError:class {},
    l10n:{t:(key,...args)=>formatMessage(locale==='de' ? german[key] ?? key:key,args)},
    window:{showWarningMessage:async(message,options,...buttons)=>{
     assert.ok(options.detail.includes(request.received.fingerprint));
     assert.ok(options.detail.includes(locale==='de'?'Zugangsdaten':'credentials'));
     return buttons[action==='Verify new key …'?0:action?1:-1];
    },showInputBox:async()=>{inputs++;return request.received.fingerprint;}}};
   assert.equal(await changedHostKeyDialog(localizeVSCode(raw).vscode.window)(request),Boolean(action));
   assert.equal(inputs,action==='Verify new key …'?1:0);
  }
 }
});
