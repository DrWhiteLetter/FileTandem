import * as vscode from 'vscode';
import { randomUUID, randomBytes } from 'node:crypto';
import { ManagerSessions } from '../application/manager-sessions.js';
import { executionLocation } from './local-proof.js';
import { requireDesktopAccess } from '../application/access-policy.js';

export function registerManager(context) {
  const sessions = new ManagerSessions();
  let handshakes = 0;
  context.subscriptions.push({ dispose: () => sessions.dispose() });
  const open = () => {
    requireDesktopAccess(executionLocation(context), vscode.workspace.isTrusted);
    const sessionId = randomUUID();
    sessions.create(sessionId, executionLocation(context), vscode.workspace.getConfiguration('xscp').get('demoScenario'));
    const assets = vscode.Uri.joinPath(context.extensionUri,'dist');
    const panel = vscode.window.createWebviewPanel('xscp.manager','xScp',vscode.ViewColumn.One,{ enableScripts: true, localResourceRoots: [assets] });
    const receive = panel.webview.onDidReceiveMessage(message => {
      // Recheck location/trust for each request, not only at panel creation.
      try {
        requireDesktopAccess(executionLocation(context), vscode.workspace.isTrusted);
        const response = sessions.handle(sessionId,message);
        if (response) { if (message.type === 'ready') handshakes++; void panel.webview.postMessage(response); }
      } catch { /* No effect or credential/error details sent to the webview. */ }
    });
    panel.onDidDispose(() => { receive.dispose(); sessions.remove(sessionId); });
    const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.js'));
    const style = panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.css'));
    const nonce = randomBytes(24).toString('base64');
    panel.webview.html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="xscp-session" content="${sessionId}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; font-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"><title>xScp</title></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    context.subscriptions.push(panel);
    return panel;
  };
  context.subscriptions.push(vscode.commands.registerCommand('xscp.openManager', () => {
    try { open(); } catch (error) { void vscode.window.showErrorMessage(error.message); }
  }));
  return { open, status: () => ({ handshakes }) };
}
