import { runTests } from '@vscode/test-electron';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir, homedir, hostname } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtime } from '../test/helpers/auth.mjs';
import { spawnSync } from 'node:child_process';
delete process.env.ELECTRON_RUN_AS_NODE;
const remote = process.argv.includes('--remote');const installed=process.argv.includes('--installed');
const directory = await mkdtemp(join(tmpdir(), 'filetandem-editor-'));
const user = join(directory, 'user'); const extensions = join(directory, 'extensions');
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  await mkdir(join(user, 'User'), { recursive: true }); await mkdir(extensions);
  const settings = { 'files.autoSave': 'off', 'remote.SSH.configFile': join(runtime, 'ssh_config'), 'remote.SSH.useExecServer': false, 'remote.SSH.showLoginTerminal': false, 'remote.SSH.remotePlatform': { 'filetandem-fixture-remote': 'linux' } };
  await writeFile(join(user, 'User/settings.json'), JSON.stringify(settings));
  if (remote) {
    for (const name of ['ms-vscode-remote.remote-ssh-0.128.0', 'ms-vscode-remote.remote-ssh-edit-0.87.0']) await cp(join(homedir(), '.vscode/extensions', name), join(extensions, name), { recursive: true });
  }
  const marker = join(directory, 'desktop-marker.bin');
  const markerBytes = randomBytes(128); await writeFile(marker, markerBytes);
  if (remote) {
    const files = {
      'package.json': JSON.stringify({ name: 'remote-editor-probe', publisher: 'filetandem-test', version: '0.0.1', engines: { vscode: '^1.140.0' }, main: './extension.cjs', extensionKind: ['workspace'], activationEvents: ['onCommand:filetandem.test.remoteEditorRead'], contributes: { commands: [{ command: 'filetandem.test.remoteEditorRead', title: 'Fixture-only provider probe' }] } }),
      'extension.cjs': `const v = require('vscode'); exports.activate = c => c.subscriptions.push(v.commands.registerCommand('filetandem.test.remoteEditorRead', async (uri, marker) => ({ host: require('node:os').hostname(), localMarkerExists: require('node:fs').existsSync(marker), content: Buffer.from(await v.workspace.fs.readFile(v.Uri.parse(uri))).toString('utf8') })));`,
    };
    const folder = '/home/fixture/.vscode-server/extensions/filetandem-test.remote-editor-probe-0.0.1';
    const script = `mkdir -p '${folder}'\n` + Object.entries(files).map(([name,content]) => `printf '%s' '${Buffer.from(content).toString('base64')}' | base64 -d > '${folder}/${name}'`).join('\n');
    const install = spawnSync('ssh', ['-F', join(runtime, 'ssh_config'), 'filetandem-fixture-remote', 'sh'], { input: script, encoding: 'utf8' });
    if (install.status !== 0) throw new Error(install.stderr);
  }
  let development=root;if (installed) {development=join(directory,'harness');await mkdir(development);await writeFile(join(development,'package.json'),JSON.stringify({name:'installed-editor-harness',publisher:'filetandem-test',version:'0.0.1',engines:{vscode:'^1.140.0'}}));const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));const executable=process.env.VSCODE_TEST_EXECUTABLE ?? '/Applications/Visual Studio Code.app/Contents/MacOS/Code';const cli=process.env.VSCODE_CLI ?? (process.platform==='darwin' ? join(executable,'../../Resources/app/bin/code'):'code');const env=Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VSCODE_') && key!=='ELECTRON_RUN_AS_NODE'));const result=spawnSync(cli,['--user-data-dir',user,'--extensions-dir',extensions,'--install-extension',join(root,'out',`FileTandem-${manifest.version}.vsix`),'--force'],{env,encoding:'utf8',timeout:120000});if (result.status!==0) throw new Error(result.stderr || result.error?.message);}
  const setup = spawnSync('ssh', ['-F', join(runtime, 'ssh_config'), 'filetandem-fixture-remote', 'printf editor-initial > /data/editor-proof.txt'], { encoding: 'utf8' });
  if (setup.status !== 0) throw new Error(setup.stderr);
  await runTests({ version: '1.140.0', vscodeExecutablePath: process.env.VSCODE_TEST_EXECUTABLE,
    extensionDevelopmentPath: development, extensionTestsPath: join(root,process.argv.includes('--accessibility') ? 'test/extension/accessibility.cjs':'test/extension/editor.cjs'),
    extensionTestsEnv: { FILETANDEM_INSTALLED_EDITOR_EXTENSIONS:installed ? extensions:'',FILETANDEM_EDITOR_RUNTIME: runtime, FILETANDEM_EDITOR_REMOTE: remote ? 'yes' : 'no', FILETANDEM_EDITOR_ROOT: root, FILETANDEM_EDITOR_MARKER: marker, FILETANDEM_EDITOR_MARKER_HASH: createHash('sha256').update(markerBytes).digest('hex'), FILETANDEM_EDITOR_HOST: hostname(), FILETANDEM_SSH_PORT_BASE: process.env.FILETANDEM_SSH_PORT_BASE ?? '22220' },
    launchArgs: [...(process.argv.includes('--english') ? ['--locale','en']:[]),'--user-data-dir', user, '--extensions-dir', extensions, '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', ...(remote ? ['--folder-uri', 'vscode-remote://ssh-remote+filetandem-fixture-remote/data'] : [])],
  });
} finally { await rm(directory, { recursive: true, force: true }); }
