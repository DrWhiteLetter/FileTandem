import { runTests } from '@vscode/test-electron';
import { mkdtemp, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir, homedir, hostname } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtime } from '../test/helpers/auth.mjs';
import { spawnSync } from 'node:child_process';
delete process.env.ELECTRON_RUN_AS_NODE;
const remote = process.argv.includes('--remote');
const directory = await mkdtemp(join(tmpdir(), 'xscp-editor-'));
const user = join(directory, 'user'); const extensions = join(directory, 'extensions');
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  await mkdir(join(user, 'User'), { recursive: true }); await mkdir(extensions);
  const settings = { 'files.autoSave': 'off', 'remote.SSH.configFile': join(runtime, 'ssh_config'), 'remote.SSH.useExecServer': false, 'remote.SSH.showLoginTerminal': false, 'remote.SSH.remotePlatform': { 'xscp-fixture-remote': 'linux' } };
  await writeFile(join(user, 'User/settings.json'), JSON.stringify(settings));
  if (remote) {
    for (const name of ['ms-vscode-remote.remote-ssh-0.128.0', 'ms-vscode-remote.remote-ssh-edit-0.87.0']) await cp(join(homedir(), '.vscode/extensions', name), join(extensions, name), { recursive: true });
  }
  const marker = join(directory, 'desktop-marker.bin');
  const markerBytes = randomBytes(128); await writeFile(marker, markerBytes);
  if (remote) {
    const files = {
      'package.json': JSON.stringify({ name: 'remote-editor-probe', publisher: 'xscp-test', version: '0.0.1', engines: { vscode: '^1.140.0' }, main: './extension.cjs', extensionKind: ['workspace'], activationEvents: ['onCommand:xscp.test.remoteEditorRead'], contributes: { commands: [{ command: 'xscp.test.remoteEditorRead', title: 'Fixture-only provider probe' }] } }),
      'extension.cjs': `const v = require('vscode'); exports.activate = c => c.subscriptions.push(v.commands.registerCommand('xscp.test.remoteEditorRead', async (uri, marker) => ({ host: require('node:os').hostname(), localMarkerExists: require('node:fs').existsSync(marker), content: Buffer.from(await v.workspace.fs.readFile(v.Uri.parse(uri))).toString('utf8') })));`,
    };
    const folder = '/home/fixture/.vscode-server/extensions/xscp-test.remote-editor-probe-0.0.1';
    const script = `mkdir -p '${folder}'\n` + Object.entries(files).map(([name,content]) => `printf '%s' '${Buffer.from(content).toString('base64')}' | base64 -d > '${folder}/${name}'`).join('\n');
    const install = spawnSync('ssh', ['-F', join(runtime, 'ssh_config'), 'xscp-fixture-remote', 'sh'], { input: script, encoding: 'utf8' });
    if (install.status !== 0) throw new Error(install.stderr);
  }
  const setup = spawnSync('ssh', ['-F', join(runtime, 'ssh_config'), 'xscp-fixture-remote', 'printf editor-initial > /data/editor-proof.txt'], { encoding: 'utf8' });
  if (setup.status !== 0) throw new Error(setup.stderr);
  await runTests({ version: '1.140.0', vscodeExecutablePath: process.env.VSCODE_TEST_EXECUTABLE,
    extensionDevelopmentPath: root, extensionTestsPath: join(root,process.argv.includes('--accessibility') ? 'test/extension/accessibility.cjs':'test/extension/editor.cjs'),
    extensionTestsEnv: { XSCP_EDITOR_RUNTIME: runtime, XSCP_EDITOR_REMOTE: remote ? 'yes' : 'no', XSCP_EDITOR_ROOT: root, XSCP_EDITOR_MARKER: marker, XSCP_EDITOR_MARKER_HASH: createHash('sha256').update(markerBytes).digest('hex'), XSCP_EDITOR_HOST: hostname(), XSCP_SSH_PORT_BASE: process.env.XSCP_SSH_PORT_BASE ?? '22220' },
    launchArgs: ['--user-data-dir', user, '--extensions-dir', extensions, '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', ...(remote ? ['--folder-uri', 'vscode-remote://ssh-remote+xscp-fixture-remote/data'] : [])],
  });
} finally { await rm(directory, { recursive: true, force: true }); }
