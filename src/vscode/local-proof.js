import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { hostname, homedir } from 'node:os';

/** @param {import('vscode').ExtensionContext} context */
export function executionLocation(context) {
  const local = context.extension.extensionKind === vscode.ExtensionKind.UI
    && context.extensionUri.scheme === 'file';
  return {
    local,
    extensionKind: context.extension.extensionKind === vscode.ExtensionKind.UI ? 'ui' : 'workspace',
    windowRemoteName: vscode.env.remoteName ?? null,
    hostName: hostname(),
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.versions.node,
    vscodeVersion: vscode.version,
  };
}

/** Read only a deliberately selected local regular file; never resolve workspace URIs.
 * @param {import('vscode').ExtensionContext} context
 * @param {import('vscode').Uri} uri
 */
export async function verifyLocalFile(context, uri) {
  const location = executionLocation(context);
  if (!location.local) {
    throw new Error('xScp muss auf dem Desktop im lokalen UI Extension Host laufen. Eine remote.extensionKind-Übersteuerung entfernen und xScp lokal installieren.');
  }
  if (!(uri instanceof vscode.Uri) || uri.scheme !== 'file' || uri.authority
    || uri.query || uri.fragment) {
    throw new Error('Nur lokale file:-URIs ohne Authority sind für diesen Nachweis erlaubt. Remote-Workspace-Pfade sind keine Desktop-Dateien.');
  }
  const handle = await open(uri.fsPath, 'r');
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw new Error('Bitte eine reguläre lokale Testdatei auswählen.');
    const hash = createHash('sha256');
    let bytesRead = 0;
    const buffer = Buffer.alloc(64 * 1024);
    for (;;) {
      const result = await handle.read(buffer, 0, buffer.length, null);
      if (result.bytesRead === 0) break;
      hash.update(buffer.subarray(0, result.bytesRead));
      bytesRead += result.bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs || BigInt(bytesRead) !== after.size) {
      throw new Error('Die Testdatei wurde während des Lesens verändert. Bitte erneut prüfen.');
    }
    return { ...location, source: 'Desktop-Dateisystem / Node.js',
      filePath: uri.fsPath, bytesRead, sha256: hash.digest('hex') };
  } finally {
    await handle.close();
  }
}

/** @param {import('vscode').ExtensionContext} context */
export function registerLocalProof(context) {
  const output = vscode.window.createOutputChannel('xScp: Ausführungsort');
  context.subscriptions.push(output, vscode.commands.registerCommand('xscp.verifyLocalFile', async () => {
    try {
      if (!executionLocation(context).local) {
        throw new Error('xScp läuft nicht im lokalen UI Extension Host. Bitte lokal installieren und remote.extensionKind prüfen.');
      }
      const selected = await vscode.window.showOpenDialog({
        defaultUri: vscode.Uri.file(homedir()),
        canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
        openLabel: 'Lokale Testdatei prüfen', title: 'xScp: Testdatei vom Desktop-Rechner',
      });
      if (!selected?.length) return;
      const proof = await verifyLocalFile(context, selected[0]);
      output.appendLine(JSON.stringify(proof, null, 2));
      output.show(true);
      return proof;
    } catch (error) {
      await vscode.window.showErrorMessage(`xScp: ${error.message}`);
    }
  }));
}
