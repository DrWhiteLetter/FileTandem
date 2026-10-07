import * as vscode from 'vscode';
import { registerEditorProvider } from './vscode/editor-provider.js';
import { randomBytes } from 'node:crypto';
import { connectSsh } from './adapters/ssh/connect.js';
import { unknownHostKeyDialog } from './vscode/host-key-dialog.js';
import { registerHostKeyProof } from './vscode/host-key-proof.js';
import { executionLocation, registerLocalProof, verifyLocalFile } from './vscode/local-proof.js';

/** @param {import('vscode').ExtensionContext} context */
export function activate(context) {
  registerLocalProof(context);
  const { trust } = registerHostKeyProof(context);
  const editorProof = registerEditorProvider(context, trust);
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
    editorProof,
    // Technical probe for authentication/installed-package acceptance; never
    // returns a reconnectable client, credentials or a transfer session.
    probeSshAuthentication: async (config, { signal, confirmUnknown = unknownHostKeyDialog(vscode.window) } = {}) => {
      if (!executionLocation(context).local || !vscode.workspace.isTrusted) throw new Error('SSH-Nachweis benötigt den lokalen, vertrauenswürdigen UI Extension Host.');
      const session = await connectSsh(config, { trust, signal, confirmUnknown });
      try { return { endpoint: session.endpoint, hostKey: session.hostKey }; }
      finally { await session.close(); }
    },
    executionLocation: () => executionLocation(context),
    verifyLocalFile: uri => verifyLocalFile(context, uri),
  };
}
