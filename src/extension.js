import { registerBrowser } from './vscode/browser-panel.js';
import { SessionManager } from './application/session-manager.js';
import { credentialProvider } from './vscode/credentials.js';
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
  profileUI.credentials=credentialProvider(context,profileUI);
  registerLocalProof(context);
  const { trust } = registerHostKeyProof(context);
  profileUI.sessions=new SessionManager({connect:connectSsh,credentials:profileUI.credentials,policy:{trust,confirmUnknown:unknownHostKeyDialog(vscode.window)},onChange:() => profileUI.changed.fire()});
  context.subscriptions.push(profileUI.sessions);
  profileUI.connect=async profile => {
    profileUI.guard();
    return vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:`xScp: Verbinde ${profile.name}`,cancellable:true},async (_,token) => {
      const controller=new AbortController(); const cancellation=token.onCancellationRequested(() => controller.abort());
      if (token.isCancellationRequested) controller.abort();
      try { return await profileUI.sessions.connect(profile,{signal:controller.signal}); } finally {cancellation.dispose();}
    });
  };
  profileUI.command('xscp.connectProfile',async id => {const p=typeof id === 'string' ? profileUI.profiles.get(id) : id?.profileId ? profileUI.profiles.get(id.profileId) : await profileUI.choose(); if (p) { await profileUI.connect(p); return profileUI.open(p); }});
  profileUI.command('xscp.disconnectProfile',async id => {const p=typeof id === 'string' ? profileUI.profiles.get(id) : id?.profileId ? profileUI.profiles.get(id.profileId) : await profileUI.choose(); if (p) return profileUI.sessions.disconnect(p.id);});
  const editorProof = registerEditorProvider(context, trust);
  registerManager(context);
  const manager = registerBrowser(context,profileUI);
  registerConnectionsView(context,profileUI);
  return {
    manager,
    profiles: {
      list:() => {profileUI.guard();return profileUI.profiles.list();},
      get:id => {profileUI.guard();return profileUI.profiles.get(id);},
      save:async raw => {profileUI.guard();const result=await profileUI.profiles.save(raw);profileUI.changed.fire();return result;},
      delete:async id => {profileUI.guard();await profileUI.profiles.delete(id);profileUI.changed.fire();},
      export:() => {profileUI.guard();return profileUI.profiles.export();},
    },
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
