const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');const vscode=require('vscode');
exports.run=async (api,id,local) => {
 await api.transfers.ready;
 const marker=path.join(local,'transfer-proof.json');let proof;
 const wait=async ids => {const end=Date.now()+15000;while (Date.now()<end) {const jobs=api.transfers.list().filter(j => ids.includes(j.id));if (jobs.length===ids.length && jobs.every(j => ['completed','skipped','failed','cancelled'].includes(j.state))) {assert.ok(jobs.every(j => ['completed','skipped'].includes(j.state)),JSON.stringify(jobs.map(j => ({state:j.state,error:j.error}))));return jobs;}await new Promise(r => setTimeout(r,30));}throw new Error('Native transfer timeout');};
 if (process.env.XSCP_M2_PHASE==='write') {
  const name='m3-native-'+crypto.randomUUID(),root=path.join(local,name);await fs.mkdir(path.join(root,'nested','empty'),{recursive:true});const content=crypto.randomBytes(1024*1024+13);await fs.writeFile(path.join(root,'nested','binary'),content);
  api.transfers.pause(true);const upload=await api.transfers.submit(id,'upload',[root],'/data');assert.ok(api.transfers.list().filter(j => upload.ids.includes(j.id)).every(j => j.state==='queued'));
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');api.transfers.pause(false);const jobs=await wait(upload.ids);assert.equal(jobs.find(j => j.kind==='file').sha256,crypto.createHash('sha256').update(content).digest('hex'),'Installed upload hash');
  const download=path.join(local,'download');await fs.mkdir(download);const batch=await api.transfers.submit(id,'download',['/data/'+name],download);await wait(batch.ids);assert.deepEqual(await fs.readFile(path.join(download,name,'nested','binary')),content);assert.ok((await fs.stat(path.join(download,name,'nested','empty'))).isDirectory());
  await vscode.commands.executeCommand('xscp.showTransfers');const pending=path.join(local,'pending');await fs.mkdir(pending);api.transfers.pause(true);const queued=await api.transfers.submit(id,'download',['/data/'+name+'/nested/binary'],pending);proof={pending:queued.ids[0],target:path.join(pending,'binary'),sha:crypto.createHash('sha256').update(content).digest('hex'),completed:api.transfers.list().filter(j => j.state==='completed').map(j => j.id)};await fs.writeFile(marker,JSON.stringify(proof));await api.transfers.flush();
 } else {
  proof=JSON.parse(await fs.readFile(marker,'utf8'));assert.equal(api.transfers.list().find(j => j.id===proof.pending).state,'interrupted');await assert.rejects(fs.stat(proof.target),{code:'ENOENT'});assert.ok(proof.completed.every(id => api.transfers.list().some(j => j.id===id && j.state==='completed')));
  const batch=api.transfers.retry([proof.pending]);const ids=api.transfers.list().filter(j => j.batchId===batch).map(j => j.id);await wait(ids);assert.equal(crypto.createHash('sha256').update(await fs.readFile(proof.target)).digest('hex'),proof.sha);assert.equal(api.transfers.list().filter(j => j.retryOf).length,1);await api.transfers.flush();
 }
 console.log('M3 native installed: recursive hashes, tab-independent transfer, journal restart and explicit targeted retry passed.');
};
