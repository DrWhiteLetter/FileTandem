import { vscode,t } from './localized-vscode.js';
import { randomUUID } from 'node:crypto';
import { validateProfile } from '../domain/profile.js';
import { Profiles } from '../application/profiles.js';
import { requireDesktopAccess } from '../application/access-policy.js';
import { executionLocation } from './local-proof.js';
export function registerProfiles(context) {
  const profiles=new Profiles(context.globalState);
  const changed=new vscode.EventEmitter(); context.subscriptions.push(changed);
  const guard=() => requireDesktopAccess(executionLocation(context),vscode.workspace.isTrusted);
  const choose=async () => { const item=await vscode.window.showQuickPick(profiles.list().map(profile => ({label:profile.name,description:`${profile.username}@${profile.host}:${profile.port}`,profile})),{title:"FileTandem: Select profile"}); return item?.profile; };
  const edit=async (existing,{quick=false}={}) => {
    guard(); const raw={version:1,id:existing?.id ?? randomUUID(),...(quick ? {name:t("Quick connection"),localPath:'',remotePath:'/'}:{}),...existing};
    for (const [key,title,fallback] of [['name',"Profile name","New server"],['host',"SSH host",''],['port','SSH port','22'],['username',"User",''],['localPath',"Local starting folder (empty = Home)",''],['remotePath',"Remote starting folder",'/']]) {
      if (quick && ['name','localPath','remotePath'].includes(key)) continue;
      const value=await vscode.window.showInputBox({title:`FileTandem: ${title}`,value:String(raw[key] ?? t(fallback)),ignoreFocusOut:true}); if (value === undefined) return;
      raw[key]=key === 'port' ? (/^\d+$/.test(value) ? Number(value) : NaN) : value;
    }
    const protocol=await vscode.window.showQuickPick(['sftp','scp'],{title:"Protocol (SCP requires a GNU/Linux shell)"}); if (!protocol) return; raw.protocol=protocol;
    const auth=await vscode.window.showQuickPick([{label:"Password",value:'password'},{label:"SSH key",value:'key'},{label:'SSH agent',value:'agent'},{label:"Interactive authentication (e.g. password / MFA)",value:'interactive'}],{title:"Authentication"}); if (!auth) return; raw.auth=auth.value; raw.keyPath=''; raw.agentPath='';
    if (auth.value === 'key') {
      const files=await vscode.window.showOpenDialog({title:"Select local private SSH key",canSelectMany:false,canSelectFolders:false}); if (!files?.length) return;
      if (files[0].scheme !== 'file' || files[0].authority) throw new Error("Only local key files are allowed."); raw.keyPath=files[0].fsPath;
    }
    if (auth.value === 'agent') { const value=await vscode.window.showInputBox({title:"Explicit SSH agent path",value:existing?.agentPath || (process.platform==='win32' ? '\\\\.\\pipe\\openssh-ssh-agent':process.env.SSH_AUTH_SOCK ?? ''),ignoreFocusOut:true}); if (value === undefined) return; raw.agentPath=value; }
    guard(); if (quick) return {...validateProfile(raw),ephemeral:true};
    if (existing) await api.sessions?.disconnect(raw.id);
    await profiles.save(raw); changed.fire(); return profiles.get(raw.id);
  };
  const command=(name,action) => context.subscriptions.push(vscode.commands.registerCommand(name,async (...args) => {try { guard(); return await action(...args); } catch(error) { void vscode.window.showErrorMessage(`FileTandem: ${error.message}`); }}));
  command('filetandem.addProfile',() => edit());
  command('filetandem.editProfile',async id => { const p=typeof id === 'string' ? profiles.get(id) : id?.profileId ? profiles.get(id.profileId) : await choose(); if (p) return edit(p); });
  command('filetandem.deleteProfile',async id => { const p=typeof id === 'string' ? profiles.get(id) : id?.profileId ? profiles.get(id.profileId) : await choose(); if (!p) return; if (await vscode.window.showWarningMessage(`Delete profile “${p.name}”?`,{modal:true},"Delete") !== "Delete") return; guard(); await profiles.delete(p.id); changed.fire(); });
  command('filetandem.exportProfiles',async () => { const document=await vscode.workspace.openTextDocument({content:profiles.export(),language:'json'}); await vscode.window.showTextDocument(document); });
  const api={profiles,changed,choose,edit,guard,command};
  return api;
}
