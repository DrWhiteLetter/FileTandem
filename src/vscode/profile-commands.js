import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { Profiles } from '../application/profiles.js';
import { requireDesktopAccess } from '../application/access-policy.js';
import { executionLocation } from './local-proof.js';
export function registerProfiles(context) {
  const profiles=new Profiles(context.globalState);
  const changed=new vscode.EventEmitter(); context.subscriptions.push(changed);
  const guard=() => requireDesktopAccess(executionLocation(context),vscode.workspace.isTrusted);
  const choose=async () => { const item=await vscode.window.showQuickPick(profiles.list().map(profile => ({label:profile.name,description:`${profile.username}@${profile.host}:${profile.port}`,profile})),{title:'xScp: Profil auswählen'}); return item?.profile; };
  const edit=async existing => {
    guard(); const raw={version:1,id:existing?.id ?? randomUUID(),...existing};
    for (const [key,title,fallback] of [['name','Profilname','Neuer Server'],['host','SSH-Host',''],['port','SSH-Port','22'],['username','Benutzer',''],['localPath','Lokaler Startordner (leer = Home)',''],['remotePath','Remote-Startordner','/']]) {
      const value=await vscode.window.showInputBox({title:`xScp: ${title}`,value:String(raw[key] ?? fallback),ignoreFocusOut:true}); if (value === undefined) return;
      raw[key]=key === 'port' ? (/^\d+$/.test(value) ? Number(value) : NaN) : value;
    }
    const protocol=await vscode.window.showQuickPick(['sftp','scp'],{title:'Protokoll (SCP: GNU/Linux-Shell erforderlich)'}); if (!protocol) return; raw.protocol=protocol;
    const auth=await vscode.window.showQuickPick(['password','key','agent'],{title:'Anmeldung'}); if (!auth) return; raw.auth=auth; raw.keyPath=''; raw.agentPath='';
    if (auth === 'key') {
      const files=await vscode.window.showOpenDialog({title:'Lokalen privaten SSH-Schlüssel auswählen',canSelectMany:false,canSelectFolders:false}); if (!files?.length) return;
      if (files[0].scheme !== 'file' || files[0].authority) throw new Error('Nur lokale Schlüsseldateien sind erlaubt.'); raw.keyPath=files[0].fsPath;
    }
    if (auth === 'agent') { const value=await vscode.window.showInputBox({title:'Expliziter SSH-Agent-Pfad',value:existing?.agentPath ?? '',ignoreFocusOut:true}); if (value === undefined) return; raw.agentPath=value; }
    guard(); await profiles.save(raw); changed.fire(); return profiles.get(raw.id);
  };
  const command=(name,action) => context.subscriptions.push(vscode.commands.registerCommand(name,async (...args) => {try { guard(); return await action(...args); } catch(error) { void vscode.window.showErrorMessage(`xScp: ${error.message}`); }}));
  command('xscp.addProfile',() => edit());
  command('xscp.editProfile',async id => { const p=typeof id === 'string' ? profiles.get(id) : await choose(); if (p) return edit(p); });
  command('xscp.deleteProfile',async id => { const p=typeof id === 'string' ? profiles.get(id) : await choose(); if (!p) return; if (await vscode.window.showWarningMessage(`Profil „${p.name}“ löschen?`,{modal:true},'Löschen') !== 'Löschen') return; guard(); await profiles.delete(p.id); changed.fire(); });
  command('xscp.exportProfiles',async () => { const document=await vscode.workspace.openTextDocument({content:profiles.export(),language:'json'}); await vscode.window.showTextDocument(document); });
  return {profiles,changed,choose,edit,guard,command};
}
