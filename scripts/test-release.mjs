import { spawn } from 'node:child_process';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { platform,arch,release } from 'node:os';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

// Fixtures must be started explicitly. Never connect to a real server.
const reportDirectory=resolve('out/m6');await mkdir(reportDirectory,{recursive:true});
const manifestVersion=JSON.parse(await readFile('package.json','utf8')).version;
const report={started:new Date().toISOString(),version:manifestVersion,platform:platform(),architecture:arch(),os:release(),node:process.version,steps:[]};
const env=Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VSCODE_') && key!=='ELECTRON_RUN_AS_NODE'));
const minimum=process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const stable=process.env.XSCP_STABLE_EXECUTABLE ?? await downloadAndUnzipVSCode(process.env.XSCP_STABLE_VERSION ?? 'stable');
async function run(name,args,extra={}) {
  const logPath=join(reportDirectory,name+'.log');const started=Date.now();let log='';
  console.log(`M6: ${name}`);
  const code=await new Promise((resolve,reject) => {
    const child=spawn(process.execPath,args,{env:{...env,...extra},stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',data => {log+=data;});child.stderr.on('data',data => {log+=data;});
    child.once('error',reject);child.once('exit',resolve);
  });
  await writeFile(logPath,log);
  report.steps.push({name,exitCode:code,seconds:(Date.now()-started)/1000,log:name+'.log'});
  await writeFile(join(reportDirectory,'regression.json'),JSON.stringify(report,null,2)+'\n');
  if (code!==0) throw new Error(`${name} failed (${code}); see ${logPath}`);
}
try {
  const npmCli=process.env.npm_execpath;
  if (!npmCli) throw new Error('Use npm run test:release so the selected Node/npm toolchain is preserved.');
  await run('quality',[npmCli,'run','quality']);
  await run('fixtures-verify',['scripts/ssh-fixtures.mjs','verify']);
  await run('protocols',[npmCli,'run','test:protocols']);
  await run('editor-service',[npmCli,'run','test:editor:service']);
  await run('integrity',[npmCli,'run','test:integrity']);
  if (process.platform==='darwin') await run('local-disk-full',['scripts/test-disk-full.mjs']);
  await run('package',[npmCli,'run','package']);
  await run('namespace-migration',['scripts/test-namespace-migration.mjs'],{VSCODE_TEST_EXECUTABLE:minimum});
  for (const [label,executable] of [['minimum',minimum],['stable',stable]]) {
    const settings={VSCODE_TEST_EXECUTABLE:executable};
    await run(label+'-installed',['scripts/test-installed.mjs'],settings);
    await run(label+'-browser-restart',['scripts/test-browser-installed.mjs'],settings);
    await run(label+'-editor',['scripts/test-editor.mjs','--installed','--english'],settings);
    await run(label+'-remote-editor',['scripts/test-editor.mjs','--installed','--remote','--english'],settings);
    await run(label+'-accessibility',['scripts/test-editor.mjs','--accessibility'],settings);
    await run(label+'-restricted',['scripts/test-restricted.mjs'],settings);
    await run(label+'-reload',['scripts/test-reload.mjs'],settings);
    await run(label+'-two-windows',['scripts/test-two-windows.mjs'],settings);
  }
  const manifest=JSON.parse(await readFile('package.json','utf8')),artifact=join('out',`FileTandem-${manifest.version}.vsix`);
  report.artifact={path:artifact,sha256:createHash('sha256').update(await readFile(artifact)).digest('hex'),version:manifest.version};
  report.completed=new Date().toISOString();report.ok=true;
} finally {await writeFile(join(reportDirectory,'regression.json'),JSON.stringify(report,null,2)+'\n');}
console.log('M6 regression complete: out/m6/regression.json');
