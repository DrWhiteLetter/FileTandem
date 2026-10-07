import { runTests } from '@vscode/test-electron';
import { fileURLToPath } from 'node:url';

// Parent terminals may run inside Electron in Node mode. Tests need the GUI.
delete process.env.ELECTRON_RUN_AS_NODE;

await runTests({
  version: '1.139.1',
  ...(process.env.VSCODE_TEST_EXECUTABLE ? { vscodeExecutablePath: process.env.VSCODE_TEST_EXECUTABLE } : {}),
  extensionDevelopmentPath: fileURLToPath(new URL('..', import.meta.url)),
  extensionTestsPath: fileURLToPath(new URL('../test/extension/smoke.cjs', import.meta.url)),
  launchArgs: ['--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
});
