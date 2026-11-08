import { runTests } from '@vscode/test-electron';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';

// Parent terminals may run inside Electron in Node mode. Tests need the GUI.
delete process.env.ELECTRON_RUN_AS_NODE;
const remoteAuthority = process.env.FILETANDEM_TEST_REMOTE_AUTHORITY;
const remoteFolder = process.env.FILETANDEM_TEST_REMOTE_FOLDER;
if (remoteAuthority && (!remoteAuthority.startsWith('ssh-remote+') || !remoteFolder?.startsWith('/'))) {
  throw new Error('Remote-Test benötigt FILETANDEM_TEST_REMOTE_AUTHORITY=ssh-remote+<Testhostalias> und FILETANDEM_TEST_REMOTE_FOLDER=/absoluter/testordner.');
}
const fixtureDirectory = await mkdtemp(join(tmpdir(), 'filetandem-local-proof-'));
const fixture = join(fixtureDirectory, 'desktop-marker.txt');
const content = randomBytes(128);
await writeFile(fixture, content, { mode: 0o600 });
try {
  await runTests({
    version: '1.140.0',
    ...(process.env.VSCODE_TEST_EXECUTABLE ? { vscodeExecutablePath: process.env.VSCODE_TEST_EXECUTABLE } : {}),
    extensionDevelopmentPath: fileURLToPath(new URL('..', import.meta.url)),
    extensionTestsPath: fileURLToPath(new URL('../test/extension/smoke.cjs', import.meta.url)),
    extensionTestsEnv: {
      FILETANDEM_PROOF_FILE: fixture,
      FILETANDEM_PROOF_SHA256: createHash('sha256').update(content).digest('hex'),
      FILETANDEM_PROOF_HOST: hostname(),
      FILETANDEM_EXPECT_REMOTE: remoteAuthority ? 'ssh-remote' : 'local',
    },
    launchArgs: [
      ...(remoteAuthority ? ['--folder-uri', `vscode-remote://${remoteAuthority}${remoteFolder}`] : ['--disable-extensions']),
      '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
    ],
  });
} finally {
  await rm(fixtureDirectory, { recursive: true, force: true });
}
