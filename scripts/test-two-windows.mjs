import assert from 'node:assert/strict';
import { spawn,spawnSync } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { runtime } from '../test/helpers/auth.mjs';
import { releaseFixture } from '../test/helpers/release-fixture.mjs';
import { openRemoteFiles,targetFor } from '../src/application/remote-files.js';
import { localTarget } from '../src/adapters/local/transfer-target.js';
const executable=process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const cli=process.env.VSCODE_CLI ?? (process.platform==='darwin' ? join(dirname(executable),'../Resources/app/bin/code'):'code');
const manifest=JSON.parse(await readFile('package.json','utf8')),name='m6-windows-'+randomUUID();
const directory=await mkdtemp(join(tmpdir(),'filetandem-two-windows-')),env=Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VSCODE_') && key!=='ELECTRON_RUN_AS_NODE'));
const children=[],closures=[],results=[];
const keys={};for (const [protocol,mode] of [['sftp','sftp-only'],['scp','scp']]) keys[protocol]=(await readFile(join(runtime,'servers',mode,'host_ed25519.pub'),'utf8')).split(' ')[1];
try {
  for (const index of [0,1]) {
    const root=join(directory,String(index)),user=join(root,'user'),extensions=join(root,'extensions'),harness=join(extensions,'xscp-test.window-harness-0.0.1');
    await mkdir(harness,{recursive:true});await mkdir(join(user,'User'),{recursive:true});await mkdir(join(root,'source'));
    await writeFile(join(root,'source',name),Buffer.alloc(64*1024**2,index ? 0x79:0x36));
    await writeFile(join(user,'User/settings.json'),JSON.stringify({'workbench.startupEditor':'none','window.restoreWindows':'none','security.workspace.trust.emptyWindow':true}));
    await writeFile(join(harness,'package.json'),JSON.stringify({name:'window-harness',publisher:'xscp-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],extensionKind:['ui']}));
    await writeFile(join(harness,'main.cjs'),`exports.activate=async () => {
      const v=require('vscode'),a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
      const root=process.env.XSCP_WINDOWS_ROOT,index=Number(process.env.XSCP_WINDOWS_INDEX),shared=path.dirname(root),result=[];
      const wait=async predicate => {const end=Date.now()+30000;while(!await predicate()) {if(Date.now()>end) throw new Error('Two-window synchronization timeout');await new Promise(r => setTimeout(r,10));}};
      try {
        const extension=v.extensions.getExtension('xscp-dev.xscp');a.ok(extension.extensionPath.startsWith(path.join(root,'extensions')));const api=await extension.activate();await api.transfers.ready;
        for (const [protocol,offset] of [['sftp',1],['scp',2]]) {
          const profile=await api.profiles.save({version:1,id:'m6-'+protocol,name:'Two window '+protocol,host:'127.0.0.1',port:Number(process.env.XSCP_WINDOWS_PORT)+offset,username:'fixture',auth:'key',keyPath:process.env.XSCP_WINDOWS_KEY,protocol,localPath:path.join(root,'source'),remotePath:'/data'});
          await api.probeSshAuthentication({host:profile.host,port:profile.port,username:profile.username,privateKey:await fs.readFile(profile.keyPath)},{confirmUnknown:async key => {a.equal(key.key,JSON.parse(process.env.XSCP_WINDOWS_KEYS)[protocol]);return true;}});
          await v.commands.executeCommand('xscp.connectProfile',profile.id);api.transfers.pause(true);
          const batch=await api.transfers.submit(profile.id,'upload',[path.join(root,'source',process.env.XSCP_WINDOWS_NAME)],'/data');
          await fs.writeFile(path.join(shared,protocol+'-ready-'+index),'ready');
          await wait(async () => {try {await fs.stat(path.join(shared,protocol+'-ready-'+(1-index)));return true;} catch {return false;}});
          api.transfers.pause(false);await wait(() => ['completed','failed'].includes(api.transfers.list().find(j => j.id===batch.ids[0]).state));
          const job=api.transfers.list().find(j => j.id===batch.ids[0]);result.push({protocol,state:job.state,sha256:job.sha256,errorCode:job.errorCode,partial:job.attempt?.part});
        }
        await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:true,vscode:v.version,index,result}));
      } catch(error) {await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:false,error:error.stack}));}
    };`);
    const installed=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',join(process.cwd(),'out',`FileTandem-${manifest.version}.vsix`),'--force'],{env,encoding:'utf8',timeout:120000,shell:process.platform==='win32'});
    if (installed.error || installed.status!==0) throw installed.error ?? new Error(installed.stderr);
    const child=spawn(executable,['--user-data-dir',user,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes'],{env:{...env,XSCP_TEST_RESULT:join(root,'result.json'),XSCP_WINDOWS_ROOT:root,XSCP_WINDOWS_INDEX:String(index),XSCP_WINDOWS_NAME:name,XSCP_WINDOWS_PORT:process.env.XSCP_SSH_PORT_BASE ?? '22220',XSCP_WINDOWS_KEY:join(runtime,'client_ed25519'),XSCP_WINDOWS_KEYS:JSON.stringify(keys)},stdio:'ignore'});
    children.push(child);closures.push(new Promise(resolve => {child.once('exit',resolve);child.once('error',resolve);}));
  }
  const deadline=Date.now()+75000;
  while (Date.now()<deadline && results.filter(Boolean).length<2) {
    for (const index of [0,1]) if (!results[index]) {try {const result=JSON.parse(await readFile(join(directory,String(index),'result.json'),'utf8'));if (!result.ok) throw new Error(result.error);results[index]=result;} catch(error) {if (error.code!=='ENOENT' && !(error instanceof SyntaxError)) throw error;}}
    if (results.filter(Boolean).length===2) break;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.equal(results.filter(Boolean).length,2,'Both actual windows finish');
  for (const protocol of ['sftp','scp']) {
    const jobs=results.map(r => r.result.find(j => j.protocol===protocol));assert.equal(jobs.filter(j => j.state==='completed').length,1,'Exactly one independent window publishes to the new shared target');assert.equal(jobs.filter(j => j.state==='failed').length,1,'Other window reports collision, without silent replacement');
    const session=await releaseFixture(protocol),files=await openRemoteFiles(session,protocol),target=targetFor(files);
    try {const winner=jobs.findIndex(j => j.state==='completed');assert.equal(await target.hash('/data/'+name),await localTarget.hash(join(directory,String(winner),'source',name)));assert.equal((await target.stat('/data/'+name)).size,64*1024**2);
      for (const path of ['/data/'+name,...jobs.map(j => j.partial).filter(Boolean)]) await target.remove(path).catch(() => {});
    } finally {files.close();await session.close();}
  }
  console.log('M6 two concurrent installed windows: '+JSON.stringify(results));
} finally {for (const child of children) if (child.exitCode===null) child.kill('SIGTERM');await Promise.all(closures);await rm(directory,{recursive:true,force:true});}
