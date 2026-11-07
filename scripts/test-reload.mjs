import { spawn,spawnSync } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { runtime } from '../test/helpers/auth.mjs';
const executable=process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const cli=process.env.VSCODE_CLI ?? (process.platform==='darwin' ? join(dirname(executable),'../Resources/app/bin/code'):'code');
const manifest=JSON.parse(await readFile('package.json','utf8'));
const directory=await mkdtemp(join(tmpdir(),'filetandem-reload-')),user=join(directory,'user'),extensions=join(directory,'extensions');
const harness=join(extensions,'xscp-test.reload-harness-0.0.1'),resultPath=join(directory,'result.json');
const expected=(await readFile(join(runtime,'servers/sftp-only/host_ed25519.pub'),'utf8')).split(' ')[1];
const env=Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VSCODE_') && key!=='ELECTRON_RUN_AS_NODE'));
let child,closed;
try {
  await mkdir(harness,{recursive:true});await mkdir(join(user,'User'),{recursive:true});await mkdir(join(directory,'download'));
  await writeFile(join(user,'User/settings.json'),JSON.stringify({'window.restoreWindows':'none','workbench.startupEditor':'none','security.workspace.trust.emptyWindow':true}));
  await writeFile(join(harness,'package.json'),JSON.stringify({name:'reload-harness',publisher:'xscp-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],extensionKind:['ui']}));
  await writeFile(join(harness,'main.cjs'),`exports.activate=async () => {
    const v=require('vscode'),a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
    const root=process.env.XSCP_RELOAD_DIRECTORY,proofPath=path.join(root,'proof.json'),destination=path.join(root,'download'),target=path.join(destination,'server-marker.txt');
    try {
      const extension=v.extensions.getExtension('RootShellForge.xscp');a.ok(extension.extensionPath.startsWith(path.join(root,'extensions')));
      const api=await extension.activate();await api.transfers.ready;let proof;try {proof=JSON.parse(await fs.readFile(proofPath,'utf8'));} catch(error) {if(error.code!=='ENOENT') throw error;}
      if (!proof) {
        const profile=await api.profiles.save({version:1,id:'m6-reload',name:'Disposable reload fixture',host:'127.0.0.1',port:Number(process.env.XSCP_RELOAD_PORT),username:'fixture',auth:'key',keyPath:process.env.XSCP_RELOAD_KEY,protocol:'sftp',localPath:destination,remotePath:'/data'});
        await api.probeSshAuthentication({host:profile.host,port:profile.port,username:profile.username,privateKey:await fs.readFile(profile.keyPath)},{confirmUnknown:async key => {a.equal(key.key,process.env.XSCP_RELOAD_HOST_KEY);return true;}});
        await v.commands.executeCommand('filetandem.connectProfile',profile.id);api.transfers.pause(true);
        const batch=await api.transfers.submit(profile.id,'download',['/data/server-marker.txt'],destination);
        a.equal(api.transfers.list().find(j => j.id===batch.ids[0]).state,'queued');
        await api.transfers.flush();await fs.writeFile(proofPath,JSON.stringify({id:batch.ids[0]}));
        // Reload terminates this host and can cancel the RPC; only the next host
        // may report success after checking the persisted state.
        void v.commands.executeCommand('workbench.action.reloadWindow').catch(() => {});return;
      }
      a.equal(api.transfers.list().find(j => j.id===proof.id).state,'interrupted','Reload never auto-starts queued writes');
      await a.rejects(fs.stat(target),{code:'ENOENT'});a.equal(api.profiles.get('m6-reload').host,'127.0.0.1');
      const batch=await api.transfers.retry([proof.id]);const deadline=Date.now()+15000;let jobs;
      while (Date.now()<deadline) {jobs=api.transfers.list().filter(j => j.batchId===batch);if(jobs.length && jobs.every(j => j.state==='completed')) break;a.ok(jobs.every(j => !['failed','cancelled'].includes(j.state)));await new Promise(resolve => setTimeout(resolve,20));}
      a.equal(jobs.length,1);a.equal(jobs[0].state,'completed');const data=await fs.readFile(target);a.equal(data.toString(),'xScp isolated sftp-only fixture\\n');a.equal(jobs[0].sha256,crypto.createHash('sha256').update(data).digest('hex'));
      await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:true,vscode:v.version,reloaded:true,interrupted:true,explicitRetry:true,sha256:jobs[0].sha256}));
    } catch(error) {await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:false,error:error.stack}));}
  };`);
  const installed=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',join(process.cwd(),'out',`FileTandem-${manifest.version}.vsix`),'--force'],{env,encoding:'utf8',timeout:120000,shell:process.platform==='win32'});
  if (installed.error || installed.status!==0) throw installed.error ?? new Error(installed.stderr);
  child=spawn(executable,['--user-data-dir',user,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes'],{env:{...env,XSCP_TEST_RESULT:resultPath,XSCP_RELOAD_DIRECTORY:directory,XSCP_RELOAD_KEY:join(runtime,'client_ed25519'),XSCP_RELOAD_PORT:String(Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+1),XSCP_RELOAD_HOST_KEY:expected},stdio:'ignore'});
  closed=new Promise(resolve => child.once('exit',resolve));let spawnError;child.once('error',error => {spawnError=error;});
  let result;const deadline=Date.now()+60000;
  while (Date.now()<deadline && child.exitCode===null && !spawnError) {try {result=JSON.parse(await readFile(resultPath,'utf8'));break;} catch(error) {if (error.code!=='ENOENT' && !(error instanceof SyntaxError)) throw error;}await new Promise(resolve => setTimeout(resolve,100));}
  if (!result?.ok) throw spawnError ?? new Error(result?.error ?? 'Reload test did not finish.');
  console.log('M6 real window reload: '+JSON.stringify(result));
} finally {if (child && child.exitCode===null) child.kill('SIGTERM');if (closed) await closed;await rm(directory,{recursive:true,force:true});}
