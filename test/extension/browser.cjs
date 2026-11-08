const assert=require('node:assert/strict');
const vscode=require('vscode');
const fs=require('node:fs/promises');
const path=require('node:path');
exports.run=async api => {
  const id='m2-native-fixture';const local=path.join(path.dirname(process.env.FILETANDEM_PROOF_FILE),'browser');
  const port=Number(process.env.FILETANDEM_M2_PORT);
  if (process.env.FILETANDEM_M2_PHASE === 'write') {
    await fs.mkdir(local);await fs.mkdir(path.join(local,'child'));await fs.writeFile(path.join(local,'own.txt'),'test');
    await api.profiles.save({version:1,id,name:'M2 native SFTP-only',host:'127.0.0.1',port,username:'fixture',auth:'key',keyPath:process.env.FILETANDEM_M2_KEY,protocol:'sftp',localPath:local,remotePath:'/data'});
    await api.probeSshAuthentication({host:'127.0.0.1',port,username:'fixture',privateKey:await fs.readFile(process.env.FILETANDEM_M2_KEY)},{confirmUnknown:async key => {assert.equal(key.key,process.env.FILETANDEM_M2_EXPECTED_KEY);return true;}});
    await vscode.commands.executeCommand('filetandem.favoriteProfile',{profileId:id});
  }
  assert.equal(api.profiles.get(id).favorite,true,'Profile persisted across actual application restart');
  assert.equal(api.profiles.get(id).localPath,local);
  await vscode.commands.executeCommand('filetandem.openProfile',{profileId:id});
  const ready=() => api.manager.status().views.some(view => view.connection.id === id && view.connection.state === 'connected' && view.remote.path === '/data' && view.remote.status === 'ready' && view.remote.count > 0 && view.local.path === local && view.local.status === 'ready');
  const wait=async condition => {const deadline=Date.now()+10000;while (!condition() && Date.now() < deadline) await new Promise(r => setTimeout(r,50));assert.ok(condition(),'Actual local and SFTP lists ready');};
  await wait(ready);
  await vscode.commands.executeCommand('filetandem.disconnectProfile',{profileId:id});
  assert.ok(api.manager.status().views.every(view => view.connection.id !== id || view.connection.state === 'disconnected'));
  await vscode.commands.executeCommand('filetandem.reconnectProfile',{profileId:id});await wait(ready);
  const old=vscode.Uri.file(path.join(local,'old'));const existing=vscode.Uri.file(path.join(local,'existing'));const target=vscode.Uri.file(path.join(local,'renamed'));
  await vscode.workspace.fs.createDirectory(old);await vscode.workspace.fs.createDirectory(existing);
  await assert.rejects(vscode.workspace.fs.rename(old,existing,{overwrite:false}));
  await vscode.workspace.fs.rename(old,target,{overwrite:false});
  await vscode.workspace.fs.delete(target,{recursive:true,useTrash:true});
  await vscode.workspace.fs.delete(existing,{recursive:true,useTrash:true});
  await require('./protocols.cjs').run(api,local);
  await require('./transfers.cjs').run(api,id,local);
  console.log(`M2-09 ${process.env.FILETANDEM_M2_PHASE}: persisted favorite/profile/trust, SFTP-only Commander, disconnect/reconnect, local rename conflict and real OS trash passed.`);
};
