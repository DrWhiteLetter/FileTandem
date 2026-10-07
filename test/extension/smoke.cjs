const assert = require('node:assert/strict');
const vscode = require('vscode');

exports.run = async () => {
  const extension = vscode.extensions.getExtension('xscp-dev.xscp');
  assert.ok(extension, 'Extension aus dem Checkout gefunden');
  await extension.activate();
  assert.ok(extension.isActive, 'Host-Bundle aktiviert');
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
  assert.ok((await vscode.commands.getCommands(true)).includes('xscp.verifyLocalFile'));
  console.log(`M0-02: Desktop-Dateizugriff, SHA-256 und URI-Abgrenzung erfolgreich (${process.env.XSCP_EXPECT_REMOTE || 'lokales Fenster'}).`);
  assert.ok((await vscode.commands.getCommands(true)).includes('xscp.openManager'));
  await vscode.commands.executeCommand('xscp.openManager');
  const hasTab = () => vscode.window.tabGroups.all.flatMap(group => group.tabs)
    .some(tab => tab.label === 'xScp' && tab.input instanceof vscode.TabInputWebview);
  const deadline = Date.now() + 5000;
  while (!hasTab() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(hasTab(),
    'Startbefehl öffnet einen Webview-Tab');
  console.log('M0-01: Aktivierung und Webview-Start erfolgreich.');
};
