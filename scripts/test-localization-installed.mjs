import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {tmpdir,hostname} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {downloadAndUnzipVSCode} from '@vscode/test-electron';
// Normal windows are required: extension test mode uses in-memory language-pack storage.
const executable=process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const cli=process.env.VSCODE_CLI ?? (process.platform==='darwin' ? join(dirname(executable),'../Resources/app/bin/code'):'code');
const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('VSCODE_') && key!=='ELECTRON_RUN_AS_NODE'));
const manifest=JSON.parse(await readFile('package.json','utf8'));
const directory=await mkdtemp(join(tmpdir(),'ft-l10n-'));
const user=join(directory,'user'),extensions=join(directory,'extensions'),harness=join(extensions,'filetandem-test.localization-0.0.1');
const marker=join(directory,'marker.txt'),content=randomBytes(128);
let child;
try {
 await mkdir(harness,{recursive:true});await mkdir(join(user,'User'),{recursive:true});
 await writeFile(join(user,'User/settings.json'),JSON.stringify({'window.restoreWindows':'none','workbench.startupEditor':'none','security.workspace.trust.emptyWindow':true}));
 await writeFile(marker,content,{mode:0o600});
 await writeFile(join(harness,'package.json'),JSON.stringify({name:'localization',publisher:'filetandem-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],extensionKind:['ui']}));
 await copyFile(fileURLToPath(new URL('../test/extension/smoke.cjs',import.meta.url)),join(harness,'smoke.cjs'));
 await writeFile(join(harness,'main.cjs'),`exports.activate=async()=>{const fs=require('node:fs/promises');try{await require('./smoke.cjs').run();await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:true,locale:require('vscode').env.language}));}catch(error){await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:false,error:error.stack}));}};`);
 for (const extension of ['MS-CEINTL.vscode-language-pack-de',join('out',`FileTandem-${manifest.version}.vsix`)]) {
  const result=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',extension,'--force'],{env:environment,encoding:'utf8',timeout:120000,shell:process.platform==='win32'});
  if (result.error || result.status!==0) throw result.error ?? new Error(result.stderr);
 }
 for (const locale of ['en','de']) {
  const resultPath=join(directory,locale+'.json');
  child=spawn(executable,[`--locale=${locale}`,'--user-data-dir',user,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes'],{env:{...environment,XSCP_TEST_RESULT:resultPath,XSCP_EXPECT_LOCALE:locale,XSCP_PROOF_FILE:marker,XSCP_PROOF_SHA256:createHash('sha256').update(content).digest('hex'),XSCP_PROOF_HOST:hostname(),XSCP_EXPECT_REMOTE:'local',XSCP_INSTALLED_EXTENSIONS:extensions},stdio:'ignore'});
  let exited=false,spawnError;const closed=new Promise(resolve=>child.once('close',()=>{exited=true;resolve();}));child.on('error',error=>{spawnError=error;});
  try {
   let result;const deadline=Date.now()+45000;
   while(Date.now()<deadline && !exited) {try{result=JSON.parse(await readFile(resultPath,'utf8'));break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
   if(!result?.ok) throw spawnError ?? new Error(result?.error ?? `No localization result for ${locale}.`);
   console.log(`Installed VSIX: native VS Code localization and webview handshake passed (${result.locale}).`);
  } finally {if(!exited) child.kill('SIGTERM');await closed;child=undefined;}
 }
} finally {child?.kill('SIGTERM');await rm(directory,{recursive:true,force:true});}
