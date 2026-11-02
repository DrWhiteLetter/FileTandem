import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile,stat } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { registerImagePreviews,isPreviewImage,IMAGE_PREVIEW_LIMIT } from '../../src/vscode/image-preview.js';
function fixture({size=12,fail=false}={}) {
  const context={subscriptions:[]},tabs=[],jobs=[],calls=[];let changed;let target;
  const vscode={Uri:{file:path=>({fsPath:path,toString:()=>`file://${path}`})},window:{tabGroups:{all:[{tabs}],onDidChangeTabs:callback=>{changed=callback;return {dispose(){}};}},showInformationMessage:async()=> 'Download'},commands:{executeCommand:async(...args)=>{calls.push(args);if(fail) throw new Error('preview failed');tabs.push({input:{uri:args[1]}});changed();}}};
  const ui={guard(){},sessions:{transport:()=>({})},transfers:{changed:{event:()=>({dispose(){}})},engine:{queue:{list:()=>jobs},submit:async(_profile,_direction,_paths,folder)=>{target=join(folder,'photo.jpg');await writeFile(target,Buffer.alloc(12));jobs.push({id:'1',state:'completed',finalTarget:target});return {ids:['1']};}}}};
  const api=registerImagePreviews(context,ui,{vscode,openRemoteFiles:async()=>({stat:async()=>({kind:'file',size}),close(){}})});
  return {api,context,tabs,calls,target:()=>target,close:()=>{tabs.length=0;changed();}};
}
async function removed(path) {for(let i=0;i<100;i++){try{await stat(path);}catch(e){if(e.code==='ENOENT')return;throw e;}await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('temporary copy was not removed');}
test('local images use the image editor without a text document',async()=>{const f=fixture();assert.ok(isPreviewImage('PHOTO.JPG'));assert.equal(isPreviewImage('file.txt'),false);await f.api.openLocal('/photo.jpg');assert.equal(f.calls[0][0],'vscode.openWith');assert.equal(f.calls[0][2],'imagePreview.previewEditor');});
for(const protocol of ['sftp','scp']) test(`${protocol} preview keeps a private snapshot until its tab closes`,async()=>{const f=fixture();const uri=await f.api.openRemote({id:'p',protocol},'/photo.jpg');assert.equal(uri.fsPath,f.target());assert.equal((await stat(dirname(f.target()))).mode&0o777,0o700);assert.equal((await stat(f.target())).mode&0o777,0o400);f.close();await removed(dirname(f.target()));});
test('failed preview removes its downloaded snapshot',async()=>{const f=fixture({fail:true});await assert.rejects(f.api.openRemote({id:'p',protocol:'scp'},'/photo.jpg'),/preview failed/);await removed(dirname(f.target()));});
test('oversize offers download before creating a temporary copy',async()=>{const f=fixture({size:IMAGE_PREVIEW_LIMIT+1});let downloaded=false;await f.api.openRemote({id:'p',protocol:'sftp'},'/large.jpg',()=>{downloaded=true;});assert.equal(downloaded,true);assert.equal(f.target(),undefined);});
test('extension disposal removes open snapshots',async()=>{const f=fixture();await f.api.openRemote({id:'p',protocol:'sftp'},'/photo.jpg');f.context.subscriptions.at(-1).dispose();await removed(dirname(f.target()));});
