import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';
import { authMaterial, startTestAgent, runtime } from '../test/helpers/auth.mjs';

// Package/install only in an isolated profile. Nothing is published.
delete process.env.ELECTRON_RUN_AS_NODE;
const executable = process.env.VSCODE_TEST_EXECUTABLE;
if (!executable) throw new Error('Packaging-Abnahme benötigt VSCODE_TEST_EXECUTABLE (lokale VS-Code-Programmdatei).');
const cli = process.env.VSCODE_CLI ?? (process.platform === 'darwin'
  ? join(dirname(executable), '../Resources/app/bin/code') : 'code');
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'filetandem-package-'));
const vsix = join(directory, 'FileTandem.vsix');
const extensions = join(directory, 'extensions');
const user = join(directory, 'user');
const harness = join(directory, 'harness');
const hostResult = join(directory, 'host-result.json');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command}: ${result.error?.message ?? result.stderr ?? 'failed'}`);
  return result.stdout;
};
let agent;
try {
  await rm(join(runtime, 'packaging.json'), { force: true });
  run(process.execPath, ['scripts/build.mjs']);
  run('npm', ['exec', '--yes', '--package=@vscode/vsce@4.0.0', '--', 'vsce', 'package', '--no-dependencies',  '--allow-missing-repository', '--githubBranch','main', '--out', vsix]);
  // Python's standard ZIP reader avoids a new runtime/npm/native dependency.
  const inspection = JSON.parse(run('python3', ['-c', `
import json, pathlib, sys, zipfile
package, runtime = sys.argv[1:]
secrets = []
for path in pathlib.Path(runtime).rglob('*'):
    if path.is_file():
        data = path.read_bytes()
        if data.startswith(b'-----BEGIN OPENSSH PRIVATE KEY') or path.name == 'password_hash':
            secrets.append(data)
        if path.name == 'credentials.json':
            secrets.extend(value.encode() for value in json.loads(data).values())
with zipfile.ZipFile(package) as archive:
    names = archive.namelist()
    for name in names:
        parts = pathlib.PurePosixPath(name).parts
        assert '..' not in parts and not name.startswith('/'), 'Unsafe ZIP path'
        assert not any(part in ('test', 'scripts', 'node_modules', '.runtime', '.git', 'src', 'webview') for part in parts), 'Development material in VSIX'
        assert not name.endswith(('.node', '.exe', '.map')), 'Native/helper/source-map file in VSIX'
        assert not any(secret in archive.read(name) for secret in secrets), 'Fixture credential material in VSIX'
    for required in ('extension/LICENSE.txt', 'extension/package.json', 'extension/dist/extension.cjs', 'extension/dist/webview.js', 'extension/dist/webview.css', 'extension/THIRD_PARTY_NOTICES.md'):
        assert required in names, 'Missing runtime artifact/license notice'
    manifest = json.loads(archive.read('extension/package.json'))
    assert manifest.get('license') == 'MIT', 'Missing MIT license metadata'
    assert archive.read('extension/LICENSE.txt') == pathlib.Path('LICENSE').read_bytes(), 'Packaged license differs from source'
    assert manifest['extensionKind'] == ['ui']
    assert manifest['engines']['vscode'] == '^1.140.0', 'Unverified VS Code baseline in package'
    assert manifest['dependencies']['ssh2'] == '1.17.0'
    print(json.dumps({'files': len(names), 'bytes': pathlib.Path(package).stat().st_size, 'fixtureSecretsExcluded': True, 'nativeFilesExcluded': True}))
`, vsix, runtime]));
  await mkdir(harness, { recursive: true });
  await writeFile(join(harness, 'package.json'), JSON.stringify({ name: 'filetandem-package-test-harness', publisher: 'filetandem-test', version: '0.0.1', engines: { vscode: '^1.140.0' } }));
  run(cli, ['--user-data-dir', user, '--extensions-dir', extensions, '--install-extension', vsix, '--force']);
  const material = await authMaterial(); agent = await startTestAgent(material); agent.loadKey('encrypted_ed25519');
  await runTests({ vscodeExecutablePath: executable,
    extensionDevelopmentPath: harness,
    extensionTestsPath: fileURLToPath(new URL('../test/extension/packaging.cjs', import.meta.url)),
    extensionTestsEnv: { FILETANDEM_PACKAGE_EXTENSIONS: extensions, FILETANDEM_PACKAGE_AGENT: agent.socket,
      FILETANDEM_PACKAGE_ROOT: root, FILETANDEM_PACKAGE_RESULT: hostResult, FILETANDEM_SSH_PORT_BASE: process.env.FILETANDEM_SSH_PORT_BASE ?? '22220' },
    launchArgs: ['--user-data-dir', user, '--extensions-dir', extensions,
      '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
  });
  const hostVersions = JSON.parse(await readFile(hostResult, 'utf8'));
  await writeFile(join(runtime, 'packaging.json'), JSON.stringify({ item: 'M0-07', timestamp: new Date().toISOString(),
    platform: process.platform, arch: process.arch, node: process.version, vsce: '4.0.0', ...hostVersions, ...inspection,
    installedVsixAuthentication: ['password', 'Ed25519', 'RSA-3072', 'encrypted Ed25519', 'encrypted RSA-3072', 'Unix agent Ed25519', 'PAM keyboard-interactive'],
    windowsAgent: 'open: no Windows test system', linuxDesktop: 'open: no Linux desktop test system' }, null, 2) + '\n');
  console.log(`M0-07: isolated VSIX installation/activation/authentication passed; ${inspection.files} entries, no fixture credentials/native modules.`);
} finally {
  try { await agent?.stop(); } finally { await rm(directory, { recursive: true, force: true }); }
}
