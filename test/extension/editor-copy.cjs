const assert=require('node:assert/strict'),vscode=require('vscode'),fs=require('node:fs/promises'),path=require('node:path'),{spawnSync}=require('node:child_process');
exports.run=async (api,runtime) => {
  const remote='/data/m5-editor-copy.txt';const ssh=command => {const p=spawnSync('ssh',['-F',path.join(runtime,'ssh_config'),'xscp-fixture-scp',command],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);return p.stdout;};ssh('printf copy-initial > '+remote);
  const port=Number(process.env.XSCP_SSH_PORT_BASE)+2,privateKey=await fs.readFile(path.join(runtime,'client_ed25519'));
  await api.probeSshAuthentication({host:'127.0.0.1',port,username:'fixture',privateKey},{confirmUnknown:async () => true});
  const profile=await api.profiles.save({version:1,id:'m5-editor-scp',name:'M5 SCP copy',host:'127.0.0.1',port,username:'fixture',auth:'key',keyPath:path.join(runtime,'client_ed25519'),protocol:'scp',localPath:runtime,remotePath:'/data'});await vscode.commands.executeCommand('xscp.connectProfile',profile.id);
  const uri=await api.editorCopies.open(profile,remote);const doc=await vscode.workspace.openTextDocument(uri),editor=await vscode.window.showTextDocument(doc);
  const wait=async condition => {const deadline=Date.now()+15000;while (!condition()) {if (Date.now()>deadline) throw new Error('Copy acceptance timeout '+JSON.stringify(api.transfers.list()));await new Promise(r => setTimeout(r,100));}};
  try {
    const uploads=() => api.transfers.list().filter(j => j.profileId===profile.id && j.direction==='upload').length;const before=uploads();
    await vscode.workspace.getConfiguration('files').update('autoSaveDelay',300,vscode.ConfigurationTarget.Global);await vscode.workspace.getConfiguration('files').update('autoSave','afterDelay',vscode.ConfigurationTarget.Global);
    await editor.edit(b => b.replace(new vscode.Range(0,0,doc.lineCount,0),'copy-draft'));await wait(() => !doc.isDirty);assert.equal(await fs.readFile(uri.fsPath,'utf8'),'copy-draft');assert.equal(ssh('cat '+remote),'copy-initial');assert.equal(uploads(),before,'Local Auto Save never enqueues SCP');
    assert.equal(await api.editorCopies.upload(uri,async () => false),undefined);assert.equal(uploads(),before);
    const batch=await api.editorCopies.upload(uri,async () => true);await wait(() => api.transfers.list().find(j => j.id===batch.ids[0]).state==='completed');assert.equal(ssh('cat '+remote),'copy-draft');
    ssh('printf evil-draft > '+remote);await editor.edit(b => b.replace(new vscode.Range(0,0,doc.lineCount,0),'next-draft'));await wait(() => !doc.isDirty);
    const conflict=await api.editorCopies.upload(uri,async () => true);await wait(() => api.transfers.list().find(j => j.id===conflict.ids[0]).state==='failed');assert.equal(api.transfers.list().find(j => j.id===conflict.ids[0]).errorCode,'EDITOR_CONFLICT');assert.equal(ssh('cat '+remote),'evil-draft');
    await api.editorCopies.remove(uri,async () => true);assert.equal(api.editorCopies.status().copies,0);console.log('M5-08: real SCP-only copy, local Auto Save without upload, explicit verified queue upload and external conflict passed.');
  } finally {await vscode.workspace.getConfiguration('files').update('autoSave','off',vscode.ConfigurationTarget.Global);ssh('rm -f -- '+remote);}
};
