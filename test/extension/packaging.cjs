const assert = require('node:assert/strict');
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
exports.run = async () => {
  const extension = vscode.extensions.getExtension('RootShellForge.xscp');
  assert.ok(extension, 'Installed VSIX found');
  assert.ok(extension.extensionUri.fsPath.startsWith(process.env.XSCP_PACKAGE_EXTENSIONS + path.sep), 'Loaded from isolated installed extensions, not development checkout');
  assert.equal(extension.extensionKind, vscode.ExtensionKind.UI);
  assert.equal(extension.packageJSON.dependencies.ssh2, '1.17.0');
  for (const name of ['node_modules', 'test', 'scripts']) await assert.rejects(fs.access(path.join(extension.extensionUri.fsPath, name)), { code: 'ENOENT' });
  await extension.activate(); assert.ok(extension.isActive);
  const { authMaterial, authPort } = await import(pathToFileURL(path.join(process.env.XSCP_PACKAGE_ROOT, 'test/helpers/auth.mjs')).href);
  const material = await authMaterial();
  const base = { host: '127.0.0.1', port: authPort, username: 'fixture', readyTimeout: 5000 };
  assert.equal(typeof extension.exports.editorProof.open, 'function', 'Installed bundle registers the editor API');
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.enableEditorEditing'));
  const probe = extension.exports.probeSshAuthentication;
  assert.equal(typeof probe, 'function');
  let prompts = 0;
  await assert.rejects(probe({ ...base, password: material.password }, { confirmUnknown: async () => false }), { code: 'HOST_KEY_REJECTED' });
  for (const [name, options] of [
    ['password', { password: material.password }],
    ['Ed25519', { privateKey: material.ed25519 }],
    ['RSA-3072', { privateKey: material.rsa }],
    ['encrypted Ed25519', { privateKey: material.encryptedEd25519, passphrase: material.passphrase }],
    ['encrypted RSA-3072', { privateKey: material.encryptedRsa, passphrase: material.passphrase }],
    ['Unix agent', { agent: process.env.XSCP_PACKAGE_AGENT }],
    ['PAM keyboard-interactive', { keyboardInteractive: request => {
      prompts++; assert.equal(request.prompts[0].echo, false); return request.prompts.map(() => material.password);
    } }],
  ]) {
    const result = await probe({ ...base, ...options }, { confirmUnknown: async key => { assert.equal(key.key, material.expected); return true; } });
    assert.equal(result.hostKey.key, material.expected);
    assert.equal(result.endpoint.port, authPort);
    console.log(`Installed VSIX: ${name} authentication passed`);
  }
  assert.ok(prompts > 0);
  await assert.rejects(probe({ ...base, password: 'wrong-fixture-password' }), /authentication methods failed/i);
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.verifySshHostKey'));
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.openManager'));
  await vscode.commands.executeCommand('filetandem.openManager');
  const deadline = Date.now() + 5000;
  const visible = () => vscode.window.tabGroups.all.flatMap(group => group.tabs).some(tab => tab.label === 'FileTandem' && tab.input instanceof vscode.TabInputWebview);
  while (!visible() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(visible(), 'Installed webview assets load');
  await fs.writeFile(process.env.XSCP_PACKAGE_RESULT, JSON.stringify({ vscode: vscode.version, extensionHostNode: process.version, electron: process.versions.electron }));
  console.log(`Installed VSIX: VS Code ${vscode.version}, host Node ${process.version}; actual bundled SSH, native optional fallback, host-key rejection and webview activation passed.`);
};
