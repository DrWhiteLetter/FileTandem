import { registerProfiles } from './vscode/profile-commands.js';
import * as vscode from 'vscode';
import { requireDesktopAccess } from './application/access-policy.js';
import { registerConnectionsView } from './vscode/connections-view.js';
import { probeAuthentication } from './application/authentication-probe.js';
import { registerEditorProvider } from './vscode/editor-provider.js';
import { registerManager } from './vscode/manager-panel.js';
import { connectSsh } from './adapters/ssh/connect.js';
import { unknownHostKeyDialog } from './vscode/host-key-dialog.js';
import { registerHostKeyProof } from './vscode/host-key-proof.js';
import { executionLocation, registerLocalProof, verifyLocalFile } from './vscode/local-proof.js';

/** @param {import('vscode').ExtensionContext} context */
export function activate(context) {
  const profileUI=registerProfiles(context);
  registerLocalProof(context);
  registerConnectionsView(context);
  const { trust } = registerHostKeyProof(context);
  const editorProof = registerEditorProvider(context, trust);
  const manager = registerManager(context);
  return {
    manager,
    profiles:profileUI.profiles,
    editorProof,
    // Technical probe for authentication/installed-package acceptance; never
    // returns a reconnectable client, credentials or a transfer session.
    probeSshAuthentication: async (config, { signal, confirmUnknown = unknownHostKeyDialog(vscode.window) } = {}) => {
      requireDesktopAccess(executionLocation(context), vscode.workspace.isTrusted);
      return probeAuthentication(connectSsh, config, { trust, signal, confirmUnknown });
    },
    executionLocation: () => executionLocation(context),
    verifyLocalFile: uri => verifyLocalFile(context, uri),
  };
}
