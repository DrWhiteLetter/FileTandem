const assert = require('node:assert/strict');
const vscode = require('vscode');

exports.run = async () => {
  const extension = vscode.extensions.getExtension('xscp-dev.xscp');
  assert.ok(extension, 'Extension aus dem Checkout gefunden');
  if (process.env.XSCP_INSTALLED_EXTENSIONS) assert.ok(extension.extensionPath.startsWith(process.env.XSCP_INSTALLED_EXTENSIONS), 'Test loads installed VSIX, not checkout');
  await extension.activate();
  assert.ok(extension.isActive, 'Host-Bundle aktiviert');
  console.log('M6 host: '+JSON.stringify({vscode:vscode.version,extension:extension.packageJSON.version,platform:process.platform,arch:process.arch,node:process.version}));
  assert.deepEqual(extension.packageJSON.extensionKind, ['ui']);
  assert.equal(extension.extensionKind, vscode.ExtensionKind.UI);
  const api = extension.exports;
  assert.equal(api.executionLocation().local, true);
  assert.equal(vscode.env.remoteName ?? 'local', process.env.XSCP_EXPECT_REMOTE);
  if (process.env.XSCP_EXPECT_REMOTE === 'ssh-remote') {
    const remoteFolder = vscode.workspace.workspaceFolders?.find(folder => folder.uri.scheme === 'vscode-remote');
    assert.ok(remoteFolder, 'Remote-Workspace angefordert');
    const remoteStat = await vscode.workspace.fs.stat(remoteFolder.uri);
    assert.ok(remoteStat.type & vscode.FileType.Directory, 'Remote-Workspace tatsächlich erreichbar');
  }
  const proof = await api.verifyLocalFile(vscode.Uri.file(process.env.XSCP_PROOF_FILE));
  assert.equal(proof.sha256, process.env.XSCP_PROOF_SHA256, 'Desktop-Marker bytegleich gelesen');
  assert.equal(proof.bytesRead, 128);
  assert.equal(proof.hostName, process.env.XSCP_PROOF_HOST, 'Host entspricht Desktop-Teststarter');
  assert.equal(proof.windowRemoteName ?? 'local', process.env.XSCP_EXPECT_REMOTE);
  await assert.rejects(api.verifyLocalFile(vscode.Uri.parse('vscode-remote://ssh-remote+fixture/tmp/file')), /file:-URIs/);
  await assert.rejects(api.verifyLocalFile(vscode.Uri.parse('file://other-host/tmp/file')), /file:-URIs/);
  await assert.rejects(api.verifyLocalFile(vscode.Uri.file('/xscp-nonexistent-test-file')), /ENOENT/);
  await assert.rejects(api.verifyLocalFile(vscode.Uri.file(require('node:path').dirname(process.env.XSCP_PROOF_FILE))), /reguläre/);
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.verifyLocalFile'));
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.verifySshHostKey'));
  assert.equal(extension.packageJSON.dependencies.ssh2, '1.17.0');
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, false);
  assert.ok(extension.packageJSON.contributes.views.filetandem.some(view => view.id === 'filetandem.connections'));
  assert.equal(extension.packageJSON.contributes.keybindings, undefined, 'F5 is not globally overridden');
  assert.ok(!extension.packageJSON.activationEvents.includes('*'));
  assert.equal(vscode.workspace.workspaceFolders?.length ?? 0, process.env.XSCP_EXPECT_REMOTE === 'ssh-remote' ? 1 : 0);
  assert.equal(vscode.workspace.getConfiguration('filetandem').get('showHiddenFiles'), false);
  await vscode.commands.executeCommand('filetandem.refreshConnections');
  console.log(`M0-02: Desktop-Dateizugriff, SHA-256 und URI-Abgrenzung erfolgreich (${process.env.XSCP_EXPECT_REMOTE || 'lokales Fenster'}).`);
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.openManager'));
  await vscode.commands.executeCommand('filetandem.openManager');
  const hasTab = () => vscode.window.tabGroups.all.flatMap(group => group.tabs)
    .some(tab => tab.label === 'FileTandem' && tab.input instanceof vscode.TabInputWebview);
  const deadline = Date.now() + 5000;
  while (!hasTab() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(hasTab(),
    'Startbefehl öffnet einen Webview-Tab');
  const readyDeadline = Date.now() + 10000;
  while (api.manager.status().handshakes === 0 && Date.now() < readyDeadline) await new Promise(resolve => setTimeout(resolve,50));
  assert.ok(api.manager.status().handshakes > 0, 'Actual nonce-protected webview script sends a validated ready handshake');
  if (process.env.XSCP_M2_PHASE) await require('./browser.cjs').run(api);
  console.log('M1-03: tatsächlicher Webview-Handshake und Hostaktivierung erfolgreich.');
};
