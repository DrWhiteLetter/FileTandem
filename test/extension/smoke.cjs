const assert = require('node:assert/strict');
const vscode = require('vscode');

exports.run = async () => {
  const extension = vscode.extensions.getExtension('xscp-dev.xscp');
  assert.ok(extension, 'Extension aus dem Checkout gefunden');
  await extension.activate();
  assert.ok(extension.isActive, 'Host-Bundle aktiviert');
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
