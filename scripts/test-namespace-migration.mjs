import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {downloadAndUnzipVSCode} from '@vscode/test-electron';
// Tests xscp -> filetandem storage keys within one publisher, not cross-publisher data transfer.
const executable=process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const root=await mkdtemp(join(tmpdir(),'ft-migrate-')),user=join(root,'user'),extensions=join(root,'extensions'),seed=join(root,'seed'),harness=join(extensions,'filetandem-test.migration-harness-0.0.1');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('VSCODE_')&&k!=='ELECTRON_RUN_AS_NODE'));
async function phase(testPath,label){
 const resultPath=join(root,label+'.json');
 await writeFile(join(harness,'main.cjs'),`exports.activate=async()=>{const fs=require('node:fs/promises');try{await require(${JSON.stringify(testPath)}).run();await fs.writeFile(process.env.XSCP_MIGRATION_RESULT,JSON.stringify({ok:true}));}catch(error){await fs.writeFile(process.env.XSCP_MIGRATION_RESULT,JSON.stringify({ok:false,error:error.stack}));}};`);
 const child=spawn(executable,['--user-data-dir',user,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes'],{env:{...env,XSCP_MIGRATION_RESULT:resultPath},stdio:'ignore'});const closed=new Promise(r=>child.once('exit',r));let error;child.once('error',e=>{error=e;});
 try{const end=Date.now()+60000;let result;while(Date.now()<end&&child.exitCode===null&&!error){try{result=JSON.parse(await readFile(resultPath,'utf8'));break;}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}await new Promise(r=>setTimeout(r,100));}if(!result?.ok)throw error??new Error(result?.error??'Migration phase timed out');console.log('Normal installed migration phase passed: '+label);}finally{if(child.exitCode===null)child.kill('SIGTERM');await closed;}
}
try {
 for(const dir of [seed,harness,join(user,'User')])await mkdir(dir,{recursive:true});
 await writeFile(join(user,'User/settings.json'),JSON.stringify({'xscp.commanderKeys':true,'xscp.language':'en','filetandem.showHiddenFiles':true}));
 await writeFile(join(seed,'package.json'),JSON.stringify({name:'xscp',publisher:'RootShellForge',version:'0.0.8',engines:{vscode:'^1.140.0'},main:'./main.cjs',extensionKind:['ui']}));
 await writeFile(join(seed,'main.cjs'),`exports.activate=async c=>{const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');await c.globalState.update('xscp.profiles.v1',{version:1,profiles:[{version:1,id:'legacy',name:'Legacy profile',host:'localhost',username:'fixture'}]});await c.globalState.update('xscp.host-key.v1.sentinel',{key:'trusted'});await c.secrets.store('xscp.profile.legacy.password','test-only-sentinel');const key='07'.repeat(32);await c.secrets.store('xscp.journal.integrity.v1',key);const job={id:'legacy-job',batchId:'legacy-batch',profileId:'legacy',server:'host:22',direction:'upload',source:'/source',target:'/target',lockKey:'remote:host:22:/target',kind:'file',state:'running',bytes:5,rate:10,started:100,error:''};const payload={version:1,jobs:[job]};await fs.mkdir(c.globalStorageUri.fsPath,{recursive:true});await fs.writeFile(path.join(c.globalStorageUri.fsPath,'transfers-v1.json'),JSON.stringify({...payload,mac:crypto.createHmac('sha256',Buffer.from(key,'hex')).update(JSON.stringify(payload)).digest('hex')}));};`);
 await writeFile(join(seed,'test.cjs'),`exports.run=async()=>{await require('vscode').extensions.getExtension('RootShellForge.xscp').activate();};`);
 await writeFile(join(harness,'package.json'),JSON.stringify({name:'migration-harness',publisher:'filetandem-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],extensionKind:['ui']}));
 const manifest=JSON.parse(await readFile('package.json','utf8'));
 const seedVsix=join(root,'legacy-seed.vsix');
 const zipped=spawnSync('python3',['-c',`import zipfile,sys,json
source,out,code=sys.argv[1:]
data=open(code,'rb').read()
with zipfile.ZipFile(source) as src,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as dst:
 for i in src.infolist():
  value=src.read(i.filename)
  if i.filename=='extension/dist/extension.cjs':value=data
  elif i.filename=='extension/package.json':
   m=json.loads(value);m['version']='0.0.8';value=json.dumps(m).encode()
  elif i.filename=='extension.vsixmanifest':value=value.replace(b'Version="${manifest.version}"',b'Version="0.0.8"')
  dst.writestr(i,value)
`,join('out',`FileTandem-${manifest.version}.vsix`),seedVsix,join(seed,'main.cjs')]);if(zipped.status!==0)throw new Error('Legacy seed package failed');
 const seedCli=process.platform==='darwin'?join(dirname(executable),'../Resources/app/bin/code'):'code';
 const seedInstall=spawnSync(seedCli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',seedVsix,'--force'],{env,encoding:'utf8',timeout:120000,shell:process.platform==='win32'});if(seedInstall.status!==0)throw new Error('Seed install failed');
 await phase(join(seed,'test.cjs'),'legacy-seed');
 const cli=process.platform==='darwin'?join(dirname(executable),'../Resources/app/bin/code'):'code';const installed=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',join(process.cwd(),'out',`FileTandem-${manifest.version}.vsix`),'--force'],{env,encoding:'utf8',timeout:120000,shell:process.platform==='win32'});if(installed.status!==0)throw new Error('Migration candidate installation failed');
 await writeFile(join(harness,'package.json'),JSON.stringify({name:'migration-harness',publisher:'filetandem-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],extensionKind:['ui']}));
 await writeFile(join(harness,'test.cjs'),`exports.run=async()=>{const v=require('vscode'),a=require('node:assert/strict');const api=await v.extensions.getExtension('RootShellForge.xscp').activate();await api.transfers.ready;a.equal(v.workspace.getConfiguration('filetandem').get('commanderKeys'),true);a.equal(v.workspace.getConfiguration('filetandem').get('language'),'en');a.equal(v.workspace.getConfiguration('filetandem').get('showHiddenFiles'),true);a.equal(v.workspace.getConfiguration().inspect('xscp.commanderKeys')?.globalValue,undefined);a.equal(api.profiles.get('legacy').name,'Legacy profile');const job=api.transfers.list().find(j=>j.id==='legacy-job');a.ok(job,'signed legacy journal loaded with migrated integrity key');a.equal(job.state,'interrupted');await new Promise(r=>setTimeout(r,100));a.equal(api.transfers.list().length,1,'no automatic retry');a.ok((await v.commands.getCommands()).includes('filetandem.openManager'));console.log('Installed namespace migration: settings, profiles and signed journal preserved; no automatic transfer.');};`);
 await phase(join(harness,'test.cjs'),'migrated');
}finally{if(process.env.XSCP_KEEP_MIGRATION_TEST)console.log('Migration test retained:',root);else await rm(root,{recursive:true,force:true});}
