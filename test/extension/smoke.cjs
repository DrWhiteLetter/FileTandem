const assert = require('node:assert/strict');
const vscode = require('vscode');

exports.run = async () => {
  const extension = vscode.extensions.getExtension('xscp-dev.xscp');
  assert.ok(extension, 'Extension aus dem Checkout gefunden');
  if (process.env.XSCP_INSTALLED_EXTENSIONS) assert.ok(extension.extensionPath.startsWith(process.env.XSCP_INSTALLED_EXTENSIONS), 'Test loads installed VSIX, not checkout');
  await extension.activate();
  assert.ok(extension.isActive, 'Host-Bundle aktiviert');
  for (const [key, property] of Object.entries(extension.packageJSON.contributes.configuration.properties)) {
    assert.deepEqual(vscode.workspace.getConfiguration().inspect(key)?.defaultValue, property.default,
      `Installed setting is registered with its default: ${key}`);
  }
  const extensionApi=require('node:module').createRequire(require('node:path').join(extension.extensionPath,'dist/extension.cjs'))('vscode');
  if (process.env.XSCP_EXPECT_LOCALE) assert.equal(extensionApi.env.language,process.env.XSCP_EXPECT_LOCALE,'requested editor locale is actually active');
  const german=extensionApi.env.language.toLowerCase().startsWith('de');
  assert.equal(extensionApi.l10n.t('Password'),german ? 'Passwort':'Password','installed extension loads its native VS Code language bundle');
  assert.equal(extensionApi.l10n.t('SSH host key changed: {0}','example.test:22'),german ? 'SSH-Host-Key geändert: example.test:22':'SSH host key changed: example.test:22','native localization preserves placeholders');
  console.log('Native localization: '+extensionApi.env.language+'; bundle loaded: '+Boolean(extensionApi.l10n.bundle));
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
  await assert.rejects(api.verifyLocalFile(vscode.Uri.parse('vscode-remote://ssh-remote+fixture/tmp/file')), /file:.*URIs/);
  await assert.rejects(api.verifyLocalFile(vscode.Uri.parse('file://other-host/tmp/file')), /file:.*URIs/);
  await assert.rejects(api.verifyLocalFile(vscode.Uri.file('/xscp-nonexistent-test-file')), /ENOENT/);
  await assert.rejects(api.verifyLocalFile(vscode.Uri.file(require('node:path').dirname(process.env.XSCP_PROOF_FILE))), /regular/);
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.verifyLocalFile'));
  assert.ok((await vscode.commands.getCommands(true)).includes('filetandem.verifySshHostKey'));
  assert.equal(extension.packageJSON.dependencies.ssh2, '1.17.0');
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, false);
  assert.ok(extension.packageJSON.contributes.views.filetandem.some(view => view.id === 'filetandem.connections'));
  for (const binding of extension.packageJSON.contributes.keybindings ?? []) {
    assert.equal(binding.when, 'activeWebviewPanelId == filetandem.browser && config.filetandem.commanderKeys', 'Commander keys only apply inside FileTandem when enabled');
    assert.ok(['filetandem.consumeCommanderKey', 'filetandem.copySelection'].includes(binding.command));
  }
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
  const localDeadline=Date.now()+10000;
  while (!api.manager.status().views.some(v=>v.mode==='local' && v.local.status==='ready' && v.remote.status==='ready') && Date.now()<localDeadline) await new Promise(resolve=>setTimeout(resolve,50));
  const localView=api.manager.status().views.find(v=>v.mode==='local' && v.local.status==='ready' && v.remote.status==='ready');
  assert.ok(localView,'Local manager loads both local panes without an SSH profile');
  const markerFolder=require('node:path').dirname(process.env.XSCP_PROOF_FILE),leftPath=localView.local.path;
  await api.manager.navigate(localView.sessionId,'remote',markerFolder);
  const navigated=api.manager.status().views.find(v=>v.sessionId===localView.sessionId);
  assert.equal(navigated.local.path,leftPath,'Navigating the right local pane leaves the left path unchanged');
  assert.equal(navigated.remote.path,markerFolder);assert.equal(navigated.remote.status,'ready');assert.ok(navigated.remote.count>0);
  console.log('Local manager: both panes loaded; right local navigation is independent.');
  if (process.env.XSCP_M2_PHASE) await require('./browser.cjs').run(api);
  console.log('M1-03: tatsächlicher Webview-Handshake und Hostaktivierung erfolgreich.');
};
