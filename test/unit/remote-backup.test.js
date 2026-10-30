import test from 'node:test';import assert from 'node:assert/strict';
import {planRemoteBackup,executeRemoteBackup,restoreRemoteBackup,backupRemoteEntry} from '../../src/application/remote-backup.js';
const info=(kind='file',size=5)=>({kind,size,modified:1,mode:0o644});
function fixture(){const nodes=new Map([['/site',info('directory')],['/site/file',info()],['/site/file.bak',info('file',99)],['/site/folder',info('directory')],['/site/folder/child',info()],['/site/link',info('symlink')]]),renames=[];
 const service={stat:async path=>{if(!nodes.has(path)) throw Object.assign(new Error('missing'),{code:2});return {...nodes.get(path)};},rename:async(source,target)=>{assert.ok(!nodes.has(target),'must never overwrite backups or restored originals');renames.push([source,target]);for(const [path,value]of [...nodes]) if(path===source || path.startsWith(source+'/')){nodes.delete(path);nodes.set(target+path.slice(source.length),value);}},listNoFollow:()=>{throw Error('backup must not traverse directories or symlinks');}};
 return {service,nodes,renames};}
test('backup preserves occupied names, coalesces selected descendants and renames directories/links without traversing',async()=>{
 const f=fixture();const plan=await planRemoteBackup(f.service,['/site/file','/site/folder/child','/site/folder','/site/link']);
 const result=await executeRemoteBackup(f.service,plan,()=>true);assert.equal(result.length,3);
 assert.equal(f.nodes.get('/site/file.bak').size,99);assert.equal(f.nodes.get('/site/file.bak.1').size,5);
 assert.ok(f.nodes.has('/site/folder.bak/child'));assert.equal(f.nodes.get('/site/link.bak').kind,'symlink');
});
test('revoked permission, changed source and unexpected errors preserve originals',async()=>{
 const f=fixture(),plan=await planRemoteBackup(f.service,['/site/file']);
 await assert.rejects(executeRemoteBackup(f.service,plan,()=>false),/revoked/);assert.equal(f.renames.length,0);
 f.nodes.set('/site/file',info('file',10));await assert.rejects(executeRemoteBackup(f.service,plan,()=>true),/changed/);assert.equal(f.renames.length,0);
 await assert.rejects(backupRemoteEntry({...f.service,stat:async path=>{if(path.endsWith('.bak')) throw Object.assign(Error('denied'),{code:3});return f.service.stat(path);}},'/site/file',()=>true),/denied/);
 await assert.rejects(planRemoteBackup(f.service,['/']),/Invalid/);await assert.rejects(planRemoteBackup(f.service,['/site/file.bak']),/separately/);
});
test('restore refuses an existing original and restores a numbered backup without overwriting',async()=>{
 const f=fixture();await assert.rejects(restoreRemoteBackup(f.service,'/site/file.bak',()=>true),{code:'EEXIST'});
 await executeRemoteBackup(f.service,await planRemoteBackup(f.service,['/site/file']),()=>true);
 assert.equal(await restoreRemoteBackup(f.service,'/site/file.bak.1',()=>true),'/site/file');
 assert.equal(f.nodes.get('/site/file').size,5);assert.equal(f.nodes.get('/site/file.bak').size,99);
});

test('permission revoked while checking the source blocks rename, and oversized backup names fail safely',async()=>{
 const f=fixture();let allowed=true;const service={...f.service,stat:async path=>{const value=await f.service.stat(path);if(path==='/site/file') allowed=false;return value;}};
 await assert.rejects(backupRemoteEntry(service,'/site/file',()=>allowed,info()),/revoked/);assert.equal(f.renames.length,0);
 const long='/site/'+ 'x'.repeat(253);f.nodes.set(long,info());await assert.rejects(backupRemoteEntry(f.service,long,()=>true),/too long/);assert.ok(f.nodes.has(long));
});
