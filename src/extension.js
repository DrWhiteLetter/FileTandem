import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { executionLocation, registerLocalProof, verifyLocalFile } from './vscode/local-proof.js';

/** @param {import('vscode').ExtensionContext} context */
export function activate(context) {
  registerLocalProof(context);
  context.subscriptions.push(vscode.commands.registerCommand('xscp.openManager', () => {
    const location = executionLocation(context);
    if (!location.local) {
      void vscode.window.showErrorMessage('xScp benötigt den lokalen UI Extension Host. Bitte lokal installieren und remote.extensionKind prüfen.');
      return;
    }
    const assets = vscode.Uri.joinPath(context.extensionUri, 'dist');
    const panel = vscode.window.createWebviewPanel('xscp.manager', 'xScp',
      vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [assets] });
    context.subscriptions.push(panel.webview.onDidReceiveMessage(message => {
      if (message && message.type === 'ready') {
        void panel.webview.postMessage({ type: 'executionLocation', local: location.local,
          remoteWindow: location.windowRemoteName !== null });
      }
    }));
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
  return {
    executionLocation: () => executionLocation(context),
    verifyLocalFile: uri => verifyLocalFile(context, uri),
  };
}
