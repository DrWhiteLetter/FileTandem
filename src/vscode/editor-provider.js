import { hasDesktopAccess } from '../application/access-policy.js';
import { vscode,t } from './localized-vscode.js';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { connectSsh } from '../adapters/ssh/connect.js';
import { openEditorFile } from '../adapters/sftp/editor-file.js';
import { executionLocation } from './local-proof.js';
import { unknownHostKeyDialog } from './host-key-dialog.js';

export function registerEditorProvider(context, trust, currentEditor) {
  const entries = new Map();
  const changes = new vscode.EventEmitter();
  const guard = () => {
    if (!hasDesktopAccess(executionLocation(context), vscode.workspace.isTrusted)) throw vscode.FileSystemError.NoPermissions('Lokaler, vertrauenswürdiger UI Extension Host erforderlich.');
  };
  const entry = uri => {
    guard();
    const value = entries.get(uri.authority);
    if (uri.scheme !== 'xscp-remote' || uri.query || uri.fragment || !value || value.uri.path !== uri.path) throw vscode.FileSystemError.Unavailable('Editor-Sitzung geschlossen. Datei neu öffnen.');
    return value;
  };
  const changed = uri => changes.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  const denied = () => { throw vscode.FileSystemError.NoPermissions('Nur die ausgewählte bestehende Datei kann bearbeitet werden.'); };
  const provider = {
    onDidChangeFile: changes.event,
    watch: () => new vscode.Disposable(() => {}),
    async stat(uri) { const e = entry(uri); const s = await e.file.metadata(); return { type: vscode.FileType.File, size: s.size, ctime: 0, mtime: Math.max(s.mtime * 1000, e.modified), ...(e.allowed ? {} : { permissions: vscode.FilePermission.Readonly }) }; },
    readFile: async uri => {try {return await entry(uri).file.read();} catch(e) {e.message=t(e.message);throw e;}},
    async writeFile(uri, data, options) {
      const e = entry(uri);
      if (!e.allowed) throw vscode.FileSystemError.NoPermissions('Bearbeitung zuerst ausdrücklich freigeben.');
      if (!options.overwrite) throw vscode.FileSystemError.FileExists(uri);
      try {await e.file.write(Buffer.from(data), () => entries.get(uri.authority) === e && e.allowed && hasDesktopAccess(executionLocation(context), vscode.workspace.isTrusted));} catch(e) {e.message=t(e.message);throw e;}
      e.modified = Math.max(Date.now(), e.modified + 1); changed(uri);
    },
    readDirectory: denied, createDirectory: denied, delete: denied, rename: denied,
  };
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 20);
  const refresh = () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    const e = uri?.scheme === 'xscp-remote' && entries.get(uri.authority);
    if (!e) return status.hide();
    status.text = e.allowed ? '$(edit) xScp: Bearbeitung freigegeben' : '$(lock) xScp: Schreibgeschützt';
    status.tooltip = `${e.endpoint}: ${uri.path}\nSpeichern und Auto Save schreiben nach Freigabe direkt auf den Server.`;
    status.command = e.allowed ? 'xscp.lockEditorFile' : 'xscp.enableEditorEditing'; status.show();
  };
  const api = {
    async open(config, path, { confirmUnknown = unknownHostKeyDialog(vscode.window) } = {}) {
      guard();
      const session = await connectSsh(config, { trust, confirmUnknown });
      try {
        const file = await openEditorFile(session, path);
        const uri = vscode.Uri.from({ scheme: 'xscp-remote', authority: randomUUID(), path });
        entries.set(uri.authority, { uri, file, endpoint: session.endpoint.label, allowed: false, modified: 0 });
        return uri;
      } catch (error) { await session.close(); throw error; }
    },
    async enable(uri, confirm = async detail => (await vscode.window.showWarningMessage('Remote-Datei zum Bearbeiten freigeben?', { modal: true, detail }, 'Bearbeitung freigeben')) === 'Bearbeitung freigeben') {
      const e = entry(uri);
      if (await confirm(`${e.endpoint}: ${uri.path}\n\nSpeichern und Auto Save schreiben direkt auf den Server. Die Freigabe gilt nur für diese Datei in dieser Sitzung.`) !== true) return false;
      guard();
      if (entries.get(uri.authority) !== e) return false;
      e.allowed = true; changed(uri); refresh(); return true;
    },
    lock(uri) { const e = entry(uri); e.allowed = false; changed(uri); refresh(); },
    async close(uri) { const e = entries.get(uri.authority); if (!e) return; e.allowed = false; entries.delete(uri.authority); await e.file.close(); refresh(); },
  };
  const command = (name, action) => context.subscriptions.push(vscode.commands.registerCommand(name, async () => {
    try { await action(); } catch (e) { await vscode.window.showErrorMessage(`xScp: ${e.message}`); }
  }));
  command('xscp.openEditorProof', async () => {
    guard();
    const host = await vscode.window.showInputBox({ title: 'SFTP-Editor: Host', value: '127.0.0.1' }); if (host === undefined) return;
    const port = await vscode.window.showInputBox({ title: 'SSH-Port', value: '22221' }); if (port === undefined) return;
    if (!/^\d+$/.test(port)) throw new Error('Numerischen Port eingeben.');
    const username = await vscode.window.showInputBox({ title: 'SSH-Benutzer', value: 'fixture' }); if (username === undefined) return;
    const path = await vscode.window.showInputBox({ title: 'Absoluter Remote-Dateipfad', value: '/data/server-marker.txt' }); if (path === undefined) return;
    const keys = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true, canSelectFolders: false, openLabel: 'Lokalen privaten Schlüssel auswählen' }); if (!keys?.length) return;
    const key = keys[0]; if (key.scheme !== 'file' || key.authority || key.query || key.fragment) throw new Error('Lokalen Schlüssel auswählen.');
    const info = await stat(key.fsPath); if (!info.isFile() || info.size > 1024 * 1024) throw new Error('Ungültige Schlüsseldatei.');
    const uri = await api.open({ host, port: Number(port), username, privateKey: await readFile(key.fsPath) }, path);
    try { await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri)); } catch (e) { await api.close(uri); throw e; }
  });
  const active = () => { const uri = vscode.window.activeTextEditor?.document.uri; if (!uri || uri.scheme !== 'xscp-remote') throw new Error('Zuerst eine xScp-Remote-Datei öffnen.'); return uri; };
  command('xscp.enableEditorEditing', () => vscode.window.activeTextEditor?.document.uri.scheme==='xscp' ? currentEditor.enable(vscode.window.activeTextEditor.document.uri):api.enable(active()));
  command('xscp.lockEditorFile', () => vscode.window.activeTextEditor?.document.uri.scheme==='xscp' ? currentEditor.lock(vscode.window.activeTextEditor.document.uri):api.lock(active()));
  context.subscriptions.push(changes, status, vscode.workspace.registerFileSystemProvider('xscp-remote', provider, { isCaseSensitive: true }), vscode.window.onDidChangeActiveTextEditor(refresh), vscode.workspace.onDidCloseTextDocument(document => {
    if (document.uri.scheme === 'xscp-remote' && entries.has(document.uri.authority)) void api.close(document.uri);
  }), { dispose() { for (const e of entries.values()) { e.allowed = false; void e.file.close(); } entries.clear(); } });
  return api;
}
