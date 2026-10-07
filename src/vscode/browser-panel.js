import * as vscode from 'vscode';
import { randomUUID,randomBytes } from 'node:crypto';
import { posix } from 'node:path';
import { RemoteFiles } from '../adapters/sftp/files.js';
import { LocalFiles,localPath,localParent,localStart } from '../adapters/local/files.js';
import { DirectoryBrowser } from '../application/directory-browser.js';
import { browserRequest } from '../shared/browser-messages.js';
export function registerBrowser(context,profileUI) {
  const files=new LocalFiles();let handshakes=0;
  const open=(profile,restored={},panel) => {
    profileUI.guard();
    const sessionId=randomUUID();const assets=vscode.Uri.joinPath(context.extensionUri,'dist');
    panel ??= vscode.window.createWebviewPanel('xscp.browser','xScp',vscode.ViewColumn.One,{});
    panel.webview.options={enableScripts:true,localResourceRoots:[assets]};
    let alive=true;const recent=new Set();
    const model=() => ({version:1,type:'browserModel',sessionId,local:local.state,remote:remote.state,connection:profile ? {...profileUI.sessions.snapshot(profile.id),name:profile.name} : {state:'disconnected',name:'Kein Server'}});
    const publish=() => {if (alive) void panel.webview.postMessage(model());};
    let start;try {start=localStart(restored.paths?.local ?? profile?.localPath);} catch {start=localStart();}
    const local=new DirectoryBrowser({start,parent:localParent,list:path => files.list(vscode.Uri.file(localPath(path))),onChange:publish});
    let remoteFiles,remoteTransport;
    const service=async () => {
      if (!profile) throw Object.assign(new Error('Nicht verbunden.'),{code:'NOT_CONNECTED'});
      if (profile.protocol !== 'sftp') throw new Error('SCP-Dateiverwaltung folgt mit M4; bitte ein SFTP-Profil verwenden.');
      const transport=profileUI.sessions.transport(profile.id);
      if (transport !== remoteTransport) {remoteFiles?.close();remoteFiles=await RemoteFiles.open(transport);remoteTransport=transport;}
      return remoteFiles;
    };
    const remote=new DirectoryBrowser({start:profile?.remotePath ?? '/',parent:path => posix.dirname(path),list:async path => (await service()).list(path),onChange:publish});
    remote.state.status='disconnected';
    const receive=panel.webview.onDidReceiveMessage(async message => {
      if (!alive || !browserRequest(message,sessionId) || recent.has(message.id)) return;
      recent.add(message.id);if (recent.size > 256) recent.delete(recent.values().next().value);
      try {
        profileUI.guard();const browser=message.side === 'remote' ? remote : local;
        if (message.type === 'ready') {handshakes++;await Promise.all([local.refresh(),...(profile ? [remote.refresh()] : [])]);publish();}
        else if (message.type === 'navigate') await browser.navigate(message.path);
        else if (message.type === 'refresh') await browser.refresh();
        else if (message.type === 'history') await browser[message.direction]();
      } catch {if (alive) void vscode.window.showErrorMessage('xScp: Aktion wurde abgewiesen.');}
    });
    panel.onDidDispose(() => {alive=false;receive.dispose();local.invalidate();remote.invalidate();remoteFiles?.close();});
    const script=panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.js'));const style=panel.webview.asWebviewUri(vscode.Uri.joinPath(assets,'webview.css'));const nonce=randomBytes(24).toString('base64');
    panel.webview.html=`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="xscp-session" content="${sessionId}"><meta name="xscp-mode" content="browser"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; font-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    context.subscriptions.push(panel);return panel;
  };
  profileUI.command('xscp.openManager',() => open());
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('xscp.browser',{async deserializeWebviewPanel(panel,state) {try {open(undefined,state ?? {},panel);} catch {panel.dispose();}}}));
  return {open,status:() => ({handshakes})};
}
