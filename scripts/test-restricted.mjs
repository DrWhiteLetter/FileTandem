import { spawn,spawnSync } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

// test-electron's runTests always disables workspace trust. Use a normal window.
const executable=process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const cli=process.env.VSCODE_CLI ?? (process.platform==='darwin' ? join(dirname(executable),'../Resources/app/bin/code'):'code');
const manifest=JSON.parse(await readFile('package.json','utf8'));
const directory=await mkdtemp(join(tmpdir(),'filetandem-restricted-'));
const user=join(directory,'user'),extensions=join(directory,'extensions');
const harness=join(extensions,'xscp-test.restricted-harness-0.0.1'),resultPath=join(directory,'result.json');
const env=Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VSCODE_') && key!=='ELECTRON_RUN_AS_NODE'));
let child,closed;
try {
  await mkdir(harness,{recursive:true});await mkdir(join(user,'User'),{recursive:true});
  await writeFile(join(user,'User/settings.json'),JSON.stringify({'workbench.startupEditor':'none','window.restoreWindows':'none','security.workspace.trust.enabled':true,'security.workspace.trust.emptyWindow':false,'security.workspace.trust.startupPrompt':'never','security.workspace.trust.banner':'never'}));
  await writeFile(join(harness,'package.json'),JSON.stringify({name:'restricted-harness',publisher:'xscp-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'./main.cjs',activationEvents:['onStartupFinished'],capabilities:{untrustedWorkspaces:{supported:true}}}));
  await writeFile(join(harness,'main.cjs'),`exports.activate=async () => {
    const v=require('vscode'),a=require('node:assert/strict'),fs=require('node:fs/promises');
    try {
      a.equal(v.workspace.workspaceFolders?.length ?? 0,0,'Separate empty-window trust fixture');
      a.equal(v.workspace.isTrusted,false,'Fresh empty window really runs in Restricted Mode');
      const installed=JSON.parse(await fs.readFile(process.env.XSCP_RESTRICTED_PACKAGE,'utf8'));
      a.equal(installed.name,'xscp');a.equal(installed.publisher,'xscp-dev');
      a.equal(installed.capabilities.untrustedWorkspaces.supported,false);
      const extension=v.extensions.getExtension('xscp-dev.xscp');
      // VS Code can omit trust-disabled extensions from this API altogether.
      if (extension) {try {await extension.activate();} catch {}}
      a.equal(extension?.isActive ?? false,false,'VS Code blocks activation in untrusted window');
      a.equal(extension?.exports,undefined);
      await a.rejects(v.workspace.fs.stat(v.Uri.parse('xscp://untrusted/data/probe')));
      await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:true,vscode:v.version,trusted:v.workspace.isTrusted,active:extension?.isActive ?? false,installed:installed.version}));
    } catch(error) {await fs.writeFile(process.env.XSCP_TEST_RESULT,JSON.stringify({ok:false,error:error.stack}));}
  };`);
  const installed=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',join(process.cwd(),'out',`FileTandem-${manifest.version}.vsix`),'--force'],{env,encoding:'utf8',timeout:120000,shell:process.platform==='win32'});
  if (installed.error || installed.status!==0) throw installed.error ?? new Error(installed.stderr);
  child=spawn(executable,['--user-data-dir',user,'--extensions-dir',extensions,'--new-window','--skip-welcome','--skip-release-notes'],{env:{...env,XSCP_TEST_RESULT:resultPath,XSCP_RESTRICTED_PACKAGE:join(extensions,`${manifest.publisher}.${manifest.name}-${manifest.version}`,'package.json')},stdio:'ignore'});
  closed=new Promise(resolve => child.once('exit',resolve));let spawnError;child.once('error',error => {spawnError=error;});
  let result;const deadline=Date.now()+45000;
  while (Date.now()<deadline && child.exitCode===null && !spawnError) {
    try {result=JSON.parse(await readFile(resultPath,'utf8'));break;} catch(error) {if (error.code!=='ENOENT' && !(error instanceof SyntaxError)) throw error;}
    await new Promise(resolve => setTimeout(resolve,100));
  }
  if (!result?.ok) throw spawnError ?? new Error(result?.error ?? 'Restricted-Mode harness did not finish.');
  console.log('M6 Restricted Mode: '+JSON.stringify(result));
} finally {
  if (child && child.exitCode===null) child.kill('SIGTERM');
  if (closed) await closed;
  await rm(directory,{recursive:true,force:true});
}
