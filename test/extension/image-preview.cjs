const vscode=require('vscode');
const assert=require('node:assert/strict');
const {mkdtemp,writeFile,rm,stat}=require('node:fs/promises');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
exports.run=async()=>{
 const {registerImagePreviews}=require('../../out/image-preview-service.cjs');
 const folder=await mkdtemp(join(tmpdir(),'filetandem-image-test-'));
 const context={subscriptions:[]};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const jobs=[];
 const ui={guard(){},sessions:{transport:()=>({})},transfers:{changed:{event:()=>({dispose(){}})},engine:{queue:{list:()=>jobs},submit:async(_p,_d,_s,target)=>{const file=join(target,'image.png');await writeFile(file,png);jobs.push({id:String(jobs.length),state:'completed',finalTarget:file});return {ids:[jobs.at(-1).id]};}}}};
 const api=registerImagePreviews(context,ui,{vscode,openRemoteFiles:async()=>({stat:async()=>({kind:'file',size:png.length}),close(){}})});
 try {
  const local=join(folder,'image.png');await writeFile(local,png);await api.openLocal(local);
  for(const protocol of ['sftp','scp']) {
   const uri=await api.openRemote({id:'test',protocol},'/image.png');
   const tab=vscode.window.tabGroups.all.flatMap(g=>g.tabs).find(t=>t.input?.uri?.toString()===uri.toString());
   assert.ok(tab?.input instanceof vscode.TabInputCustom,'built-in image editor opened');
   assert.equal(tab.input.viewType,'imagePreview.previewEditor');
   await vscode.window.tabGroups.close(tab);
   let deleted=false;for(let i=0;i<100;i++){try{await stat(uri.fsPath);}catch(e){if(e.code==='ENOENT'){deleted=true;break;}throw e;}await new Promise(r=>setTimeout(r,20));}
   assert.ok(deleted,'remote snapshot removed after actual image tab closed');
  }
  console.log('Image preview: real VS Code image tabs and snapshot cleanup passed');
 }finally{for(const d of context.subscriptions)d.dispose();await vscode.commands.executeCommand('workbench.action.closeAllEditors');await rm(folder,{recursive:true,force:true});}
};
