import { hasDesktopAccess } from '../application/access-policy.js';
import { vscode } from './localized-vscode.js';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { executionLocation } from './local-proof.js';
import { connectSsh } from '../adapters/ssh/connect.js';
import { createHostKeyStore } from '../adapters/storage/host-key-store.js';
import { unknownHostKeyDialog, changedHostKeyDialog } from './host-key-dialog.js';
import { serverIdentity } from '../adapters/ssh/host-keys.js';

/** @param {import('vscode').ExtensionContext} context */
export function registerHostKeyProof(context) {
  const trust = createHostKeyStore(context.globalState);
  const output = vscode.window.createOutputChannel('FileTandem: SSH-Host-Key');
  const active = new Set();
  context.subscriptions.push(output, { dispose: () => { for (const controller of active) controller.abort(); } });
  context.subscriptions.push(vscode.commands.registerCommand('filetandem.verifySshHostKey', async () => {
    let session;
    const controller = new AbortController();
    try {
      if (!hasDesktopAccess(executionLocation(context), vscode.workspace.isTrusted)) throw new Error('FileTandem benötigt einen vertrauenswürdigen Workspace und den lokalen UI Extension Host.');
      const host = await vscode.window.showInputBox({ title: 'SSH-Host-Key prüfen: Host', value: '127.0.0.1', ignoreFocusOut: true });
      if (host === undefined) return;
      const portText = await vscode.window.showInputBox({ title: 'SSH-Port', value: '22220', ignoreFocusOut: true });
      if (portText === undefined) return;
      if (!/^\d+$/.test(portText)) throw new Error('Bitte einen numerischen SSH-Port eingeben.');
      const endpoint = serverIdentity(host, Number(portText));
      const username = await vscode.window.showInputBox({ title: 'SSH-Benutzer', value: 'fixture', ignoreFocusOut: true });
      if (username === undefined) return;
      const keys = await vscode.window.showOpenDialog({ defaultUri: vscode.Uri.file(homedir()), canSelectFiles: true,
        canSelectFolders: false, canSelectMany: false, openLabel: 'Privaten Testschlüssel auswählen' });
      if (!keys?.length) return;
      const uri = keys[0];
      if (uri.scheme !== 'file' || uri.authority || uri.query || uri.fragment) throw new Error('Bitte einen lokalen privaten Testschlüssel auswählen.');
      const metadata = await stat(uri.fsPath);
      if (!metadata.isFile() || metadata.size > 1024 * 1024) throw new Error('Ungültige SSH-Testschlüsseldatei.');
      const privateKey = await readFile(uri.fsPath);
      active.add(controller);
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification,
        title: `FileTandem: SSH-Host-Key für ${endpoint.label} prüfen`, cancellable: true }, async (_, token) => {
        const cancellation = token.onCancellationRequested(() => controller.abort());
        if (token.isCancellationRequested) controller.abort();
        try {
          session = await connectSsh({ host: endpoint.host, port: endpoint.port, username, privateKey },
            { trust, confirmUnknown: unknownHostKeyDialog(vscode.window), confirmChanged: changedHostKeyDialog(vscode.window), signal: controller.signal });
        } finally { cancellation.dispose(); }
      });
      output.appendLine(`${session.endpoint.label}: ${session.hostKey.algorithm} ${session.hostKey.fingerprint} – Host-Key geprüft, Authentifizierung erfolgreich.`);
      output.show(true);
    } catch (error) {
      if (error.code === 'HOST_KEY_CHANGED') {
        await vscode.window.showErrorMessage(error.message, { modal: true,
          detail: `Gespeichert: ${error.details.expected.fingerprint}\nEmpfangen: ${error.details.received.fingerprint}\n\nEs wurde keine Authentifizierung freigegeben. Den Schlüsselwechsel unabhängig klären; keine automatische Vertrauensänderung.` });
      } else if (error.code !== 'CONNECTION_ABORTED' && error.code !== 'HOST_KEY_REJECTED') {
        await vscode.window.showErrorMessage(`FileTandem: ${error.message}`);
      }
    } finally {
      if (session) await session.close();
      controller.abort();
      active.delete(controller);
    }
  }));
  return { trust };
}
