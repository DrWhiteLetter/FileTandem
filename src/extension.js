import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';

/** @param {import('vscode').ExtensionContext} context */
export function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('xscp.openManager', () => {
    const assets = vscode.Uri.joinPath(context.extensionUri, 'dist');
    const panel = vscode.window.createWebviewPanel('xscp.manager', 'xScp',
      vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [assets] });
    const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'webview.js'));
    const style = panel.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'webview.css'));
    const nonce = randomBytes(24).toString('base64');
    panel.webview.html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${style}"><title>xScp</title></head>
<body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    context.subscriptions.push(panel);
  }));
}
