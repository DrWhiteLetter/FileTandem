// Real installed-package upgrade in disposable VS Code storage, without network connections or credentials.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
const executable=process.env.VSCODE_TEST_EXECUTABLE ?? '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const cli=process.env.VSCODE_CLI ?? join(dirname(executable),'../Resources/app/bin/code');
const from=process.argv[2] ?? 'out/FileTandem-1.0.3.vsix',to=process.argv[3] ?? 'out/FileTandem-1.0.4.vsix';
const root=await mkdtemp(join(tmpdir(),'filetandem-profile-upgrade-'));
const user=join(root,'user'),extensions=join(root,'extensions'),harness=join(extensions,'filetandem-test.profile-upgrade-0.0.1');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('VSCODE_')&&key!=='ELECTRON_RUN_AS_NODE'));
const profiles=[{version:1,id:'sftp-upgrade',name:'SFTP upgrade fixture',host:'example.invalid',username:'fixture',protocol:'sftp',auth:'password',port:22,localPath:root,remotePath:'/test',favorite:true},{version:1,id:'scp-upgrade',name:'SCP upgrade fixture',host:'example.invalid',username:'fixture',protocol:'scp',auth:'agent',agentPath:join(root,'fixture-agent.sock'),port:2222,localPath:root,remotePath:'/other'}];
const results=[];
function install(file) {
 const r=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',resolve(file),'--force'],{env,encoding:'utf8',timeout:120000});
 assert.equal(r.status,0,r.stderr||r.error?.message);
}
async function phase(label,seed=false) {
 const output=join(root,label+'.json');
 await writeFile(join(harness,'main.cjs'),`exports.activate=async()=>{const fs=require('node:fs/promises'),v=require('vscode'),a=require('node:assert/strict');try {const ext=v.extensions.getExtension('RootShellForge.filetandem');a.ok(ext);const api=await ext.activate();const samples=${JSON.stringify(profiles)};if(${seed}) {a.equal(api.profiles.list().length,0);for(const p of samples)await api.profiles.save(p);await fs.writeFile(${JSON.stringify(join(root,'expected.json'))},api.profiles.export());}const expected=JSON.parse(await fs.readFile(${JSON.stringify(join(root,'expected.json'))},'utf8'));a.deepEqual(JSON.parse(api.profiles.export()),expected);a.equal(api.profiles.list().length,2);for(const p of samples){a.equal(api.profiles.get(p.id).name,p.name);a.equal(api.profiles.get(p.id).protocol,p.protocol);}a.equal(api.transfers.list().length,0);await fs.writeFile(${JSON.stringify(output)},JSON.stringify({ok:true,version:ext.packageJSON.version,count:api.profiles.list().length}));}catch(e){await fs.writeFile(${JSON.stringify(output)},JSON.stringify({ok:false,error:e.stack}));}};`);
 const child=spawn(executable,['--user-data-dir',user,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes','--disable-updates'],{env,stdio:'ignore'});
 const closed=new Promise(resolve=>child.once('close',resolve));let spawnError;child.once('error',error=>{spawnError=error;});
 try {
  let result;const end=Date.now()+45000;
  while(Date.now()<end&&child.exitCode===null&&!spawnError){try{result=JSON.parse(await readFile(output,'utf8'));break;}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(result?.ok,result?.error??spawnError?.message??'Upgrade phase timed out');
  results.push({phase:label,...result});console.log(`${label}: version ${result.version}, ${result.count} profiles preserved`);
 } finally {if(child.exitCode===null)child.kill('SIGTERM');await closed;}
}
try {
 await mkdir(harness,{recursive:true});await mkdir(join(user,'User'),{recursive:true});
 await writeFile(join(user,'User/settings.json'),JSON.stringify({'window.restoreWindows':'none','workbench.startupEditor':'none','security.workspace.trust.emptyWindow':true,'extensions.autoUpdate':false,'extensions.autoCheckUpdates':false,'update.mode':'none'}));
 await writeFile(join(harness,'package.json'),JSON.stringify({name:'profile-upgrade',publisher:'filetandem-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],extensionKind:['ui']}));
 install(from);await phase('seed-before-upgrade',true);await phase('restart-before-upgrade');
 install(to);await phase('after-upgrade');await phase('restart-after-upgrade');
 await mkdir('out',{recursive:true});await writeFile('out/profile-upgrade-1.0.3-to-1.0.4.json',JSON.stringify({from,to,credentialsUsed:false,realConnections:false,results},null,2)+'\n');
} finally {await rm(root,{recursive:true,force:true});}
