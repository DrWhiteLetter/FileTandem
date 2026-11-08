import { spawnSync } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,rm,readFile } from 'node:fs/promises';
import { createHash,randomBytes } from 'node:crypto';
import { tmpdir,hostname } from 'node:os';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests,downloadAndUnzipVSCode,resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
delete process.env.ELECTRON_RUN_AS_NODE;
// Do not inherit the calling editor’s language when testing a requested locale.
delete process.env.VSCODE_NLS_CONFIG;
const executable = process.env.VSCODE_TEST_EXECUTABLE ?? await downloadAndUnzipVSCode('1.140.0');
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../package.json',import.meta.url)),'utf8'));
const vsix=join('out',`FileTandem-${manifest.version}.vsix`);
const directory = await mkdtemp(join(tmpdir(),'filetandem-installed-'));
const user=join(directory,'user'), extensions=join(directory,'extensions'), harness=join(directory,'harness');
const marker=join(directory,'desktop-marker.txt'); const content=randomBytes(128);
try {
  await mkdir(harness,{recursive:true});
  await writeFile(join(harness,'package.json'),JSON.stringify({name:'filetandem-installed-harness',publisher:'filetandem-test',version:'0.0.1',engines:{vscode:'^1.140.0'}}));
  await writeFile(marker,content,{mode:0o600});
  const [resolved,...prefix] = resolveCliArgsFromVSCodeExecutablePath(executable);
  const cli = process.env.VSCODE_CLI ?? (process.platform === 'darwin' ? join(dirname(executable),'../Resources/app/bin/code') : resolved);
  const installed=spawnSync(cli,[...(process.env.VSCODE_CLI || process.platform === 'darwin' ? [] : prefix),'--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',vsix,'--force'],{encoding:'utf8',timeout:120000,shell:process.platform === 'win32'});
  if (installed.error || installed.status !== 0) throw installed.error ?? new Error(installed.stderr);
  await runTests({vscodeExecutablePath:executable,extensionDevelopmentPath:harness,
    extensionTestsPath:fileURLToPath(new URL('../test/extension/smoke.cjs',import.meta.url)),
    extensionTestsEnv:{FILETANDEM_EXPECT_LOCALE:process.argv.includes('--english') ? 'en':'',FILETANDEM_PROOF_FILE:marker,FILETANDEM_PROOF_SHA256:createHash('sha256').update(content).digest('hex'),FILETANDEM_PROOF_HOST:hostname(),FILETANDEM_EXPECT_REMOTE:'local',FILETANDEM_INSTALLED_EXTENSIONS:extensions},
    launchArgs:[...(process.argv.includes('--english') ? ['--locale=en']:[]),'--user-data-dir',user,'--extensions-dir',extensions,'--skip-welcome','--skip-release-notes','--disable-workspace-trust'],
  });
  console.log('M1-07: installierte VSIX in sauberem Profil aktiviert; echter Commander-Handshake bestanden.');
} finally { await rm(directory,{recursive:true,force:true}); }
