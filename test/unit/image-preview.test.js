import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile,stat } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { registerImagePreviews,isPreviewImage,IMAGE_PREVIEW_LIMIT } from '../../src/vscode/image-preview.js';
function fixture({size=12,fail=false,hold=false,statFail=false}={}) {
  const context={subscriptions:[]},tabs=[],jobs=[],calls=[];let changed;let target;const listeners=new Set(),status={visible:false,show(){this.visible=true;},hide(){this.visible=false;},dispose(){}};
  const vscode={StatusBarAlignment:{Left:1},Uri:{file:path=>({fsPath:path,toString:()=>`file://${path}`})},window:{createStatusBarItem:()=>status,tabGroups:{all:[{tabs}],onDidChangeTabs:callback=>{changed=callback;return {dispose(){}};}},showInformationMessage:async()=> 'Download'},commands:{executeCommand:async(...args)=>{calls.push(args);if(fail) throw new Error('preview failed');tabs.push({input:{uri:args[1]}});changed();}}};
  const ui={guard(){},sessions:{transport:()=>({})},transfers:{changed:{event:fn=>{listeners.add(fn);return {dispose(){listeners.delete(fn);}};}},engine:{queue:{list:()=>jobs},submit:async(_profile,_direction,_paths,folder)=>{target=join(folder,'photo.jpg');await writeFile(target,Buffer.alloc(12));jobs.push({id:'1',state:hold ? 'queued':'completed',finalTarget:target});return {ids:['1']};}}}};
  const api=registerImagePreviews(context,ui,{vscode,openRemoteFiles:async()=>({stat:async()=>{if(statFail) throw new Error('stat failed');return {kind:'file',size};},close(){}})});
  return {api,context,tabs,calls,status,jobs,queue:ui.transfers.engine.queue,emit:()=>{for(const fn of listeners) fn();},target:()=>target,close:()=>{tabs.length=0;changed();}};
}
async function removed(path) {for(let i=0;i<100;i++){try{await stat(path);}catch(e){if(e.code==='ENOENT')return;throw e;}await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('temporary copy was not removed');}
test('local images use the image editor without a text document',async()=>{const f=fixture();assert.ok(isPreviewImage('PHOTO.JPG'));assert.equal(isPreviewImage('file.txt'),false);await f.api.openLocal('/photo.jpg');assert.equal(f.calls[0][0],'vscode.openWith');assert.equal(f.calls[0][2],'imagePreview.previewEditor');});
for(const protocol of ['sftp','scp']) test(`${protocol} preview keeps a private snapshot until its tab closes`,async()=>{const f=fixture();const uri=await f.api.openRemote({id:'p',protocol},'/photo.jpg');assert.equal(uri.fsPath,f.target());if(process.platform!=='win32') assert.equal((await stat(dirname(f.target()))).mode&0o777,0o700);assert.equal((await stat(f.target())).mode&0o222,0);f.close();await removed(dirname(f.target()));});
test('failed preview removes its downloaded snapshot',async()=>{const f=fixture({fail:true});await assert.rejects(f.api.openRemote({id:'p',protocol:'scp'},'/photo.jpg'),/preview failed/);await removed(dirname(f.target()));});
test('oversize offers download before creating a temporary copy',async()=>{const f=fixture({size:IMAGE_PREVIEW_LIMIT+1});let downloaded=false;await f.api.openRemote({id:'p',protocol:'sftp'},'/large.jpg',()=>{downloaded=true;});assert.equal(downloaded,true);assert.equal(f.target(),undefined);});
test('extension disposal removes open snapshots',async()=>{const f=fixture();await f.api.openRemote({id:'p',protocol:'sftp'},'/photo.jpg');f.context.subscriptions.at(-1).dispose();await removed(dirname(f.target()));});

test('preview reports preparation, paused queue and loading globally; repeated opens share one download',async()=>{
  const f=fixture({hold:true}),profile={id:'p',protocol:'sftp'};
  const first=f.api.openRemote(profile,'/photo.jpg');
  assert.equal(f.status.visible,true);assert.equal(f.api.state(profile,'/photo.jpg'),'Preparing preview …');
  assert.equal(f.api.openRemote(profile,'/photo.jpg'),first);
  while(!f.jobs.length) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(f.api.state(profile,'/photo.jpg'),'Waiting for transfer …');
  f.queue.paused=true;f.emit();assert.equal(f.api.state(profile,'/photo.jpg'),'Preview waiting – transfers paused');
  f.jobs[0].state='running';f.emit();assert.match(f.status.text,/Loading image/);
  f.jobs[0].state='completed';f.emit();await first;
  assert.equal(f.calls.length,1);assert.equal(f.status.visible,false);assert.equal(f.api.state(profile,'/photo.jpg'),undefined);
  f.close();await removed(dirname(f.target()));
});
test('metadata failure clears both preview indicators before a transfer exists',async()=>{
  const f=fixture({statFail:true}),profile={id:'p',protocol:'sftp'};
  await assert.rejects(f.api.openRemote(profile,'/photo.jpg'),/stat failed/);
  assert.equal(f.status.visible,false);assert.equal(f.api.state(profile,'/photo.jpg'),undefined);assert.equal(f.target(),undefined);
});
