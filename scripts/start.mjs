import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const executable = process.env.VSCODE_EXECUTABLE || (process.platform === 'darwin'
  ? '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
  : process.platform === 'win32' ? 'code.cmd' : 'code');
const args = ['--new-window', '--disable-extensions', `--extensionDevelopmentPath=${root}`,
  `--user-data-dir=${root}/.vscode-test/dev-user-data`,
  `--extensions-dir=${root}/.vscode-test/dev-extensions`];
// Windows CLI launchers are batch files; quote the path and every argument.
const quote = value => `"${value.replaceAll('"', '')}"`;
const child = process.platform === 'win32'
  ? spawn('cmd.exe', ['/d', '/s', '/c', [executable, ...args].map(quote).join(' ')], { stdio: 'inherit' })
  : spawn(executable, args, { stdio: 'inherit' });
child.on('error', error => {
  console.error(`VS Code konnte nicht gestartet werden: ${error.message}. VSCODE_EXECUTABLE auf den Code-CLI-Pfad setzen.`);
  process.exitCode = 1;
});
child.on('exit', code => { process.exitCode = code ?? 1; });
