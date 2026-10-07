import { spawn,spawnSync } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,copyFile,rm } from 'node:fs/promises';
import { createHash,randomBytes } from 'node:crypto';
import { tmpdir,hostname } from 'node:os';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
// Normal isolated windows are required: --extensionTestsPath uses in-memory global storage.
const executable=process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const cli=process.env.VSCODE_CLI ?? (process.platform === 'darwin' ? join(dirname(executable),'../Resources/app/bin/code') : 'code');
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../package.json',import.meta.url)),'utf8'));
const vsix=join('out',`${manifest.name}-${manifest.version}.vsix`);
const directory=await mkdtemp(join(tmpdir(),'xscp-browser-installed-'));
const user=join(directory,'user'),extensions=join(directory,'extensions'),harness=join(extensions,'xscp-test.browser-harness-0.0.1');
const source=fileURLToPath(new URL('../test/extension/',import.meta.url));
const fixture=fileURLToPath(new URL('../test/fixtures/ssh/.runtime/',import.meta.url));
const marker=join(directory,'desktop-marker.txt'),content=randomBytes(128);
const environment=Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VSCODE_') && key !== 'ELECTRON_RUN_AS_NODE'));
let child;
try {
  await mkdir(harness,{recursive:true});await mkdir(join(user,'User'),{recursive:true});
  await writeFile(join(user,'User','settings.json'),JSON.stringify({'window.restoreWindows':'none','workbench.startupEditor':'none','security.workspace.trust.emptyWindow':true}));
  await writeFile(marker,content,{mode:0o600});
  await writeFile(join(harness,'package.json'),JSON.stringify({name:'browser-harness',publisher:'xscp-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],extensionKind:['ui']}));
  await copyFile(join(source,'transfers.cjs'),join(harness,'transfers.cjs'));await copyFile(join(source,'smoke.cjs'),join(harness,'smoke.cjs'));await copyFile(join(source,'browser.cjs'),join(harness,'browser.cjs'));
  await writeFile(join(harness,'main.cjs'),`exports.activate=async () => { const fs=require('node:fs/promises');try {await require('./smoke.cjs').run();await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:true}));} catch(error) {await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:false,error:error.stack}));} };`);
  const installed=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',vsix,'--force'],{env:environment,encoding:'utf8',timeout:120000,shell:process.platform === 'win32'});
  if (installed.error || installed.status !== 0) throw installed.error ?? new Error(installed.stderr);
  const expected=(await readFile(join(fixture,'servers/sftp-only/host_ed25519.pub'),'utf8')).split(' ')[1];
  for (const phase of ['write','restart']) {
    const resultPath=join(directory,`${phase}.json`);
    child=spawn(executable,['--user-data-dir',user,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes'],{env:{...environment,XSCP_TEST_RESULT:resultPath,XSCP_PROOF_FILE:marker,XSCP_PROOF_SHA256:createHash('sha256').update(content).digest('hex'),XSCP_PROOF_HOST:hostname(),XSCP_EXPECT_REMOTE:'local',XSCP_INSTALLED_EXTENSIONS:extensions,XSCP_M2_PHASE:phase,XSCP_M2_KEY:join(fixture,'client_ed25519'),XSCP_M2_EXPECTED_KEY:expected,XSCP_M2_PORT:String(Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+1)},stdio:['ignore','ignore','ignore']});
    let exited=false;const closed=new Promise(resolve => child.once('exit',() => {exited=true;resolve();}));child.on('error',() => {});
    let result;const deadline=Date.now()+45000;
    try {
      while (Date.now() < deadline && !exited) {try {result=JSON.parse(await readFile(resultPath,'utf8'));break;} catch {}await new Promise(resolve => setTimeout(resolve,100));}
      if (!result?.ok) throw new Error(result?.error ?? `Normaler VS-Code-Test ${phase} lieferte kein Ergebnis.`);
      console.log(`M2-09: normaler isolierter VS-Code-Start ${phase} bestanden.`);
    } finally {if (!exited) child.kill('SIGTERM');await closed;child=undefined;}
  }
} finally {child?.kill('SIGTERM');await rm(directory,{recursive:true,force:true});}
