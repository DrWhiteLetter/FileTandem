import { vscode,t,language } from './localized-vscode.js';
export function registerConnectionsView(context,profileUI) {
  const changed=new vscode.EventEmitter();
  const provider={onDidChangeTreeData:changed.event,getChildren:() => profileUI.profiles.list().sort((a,b) => Number(b.favorite)-Number(a.favorite) || a.name.localeCompare(b.name,language())).map(profile => ({
    id:profile.id,label:`${profile.favorite ? '★ ':''}${profile.name}`,description:`${profile.protocol.toUpperCase()} · ${t({connecting:'Verbindet …',connected:'Verbunden',error:'Fehler',disconnected:'Getrennt'}[profileUI.sessions.snapshot(profile.id).state])}`,
    tooltip:`${profile.username}@${profile.host}:${profile.port}`,contextValue:'xscpProfile',profileId:profile.id,
    command:{command:'xscp.openProfile',title:t('Profil öffnen'),arguments:[profile.id]},iconPath:new vscode.ThemeIcon('server'),
  })),getTreeItem:item => item};
  const view=vscode.window.createTreeView('xscp.connections',{treeDataProvider:provider,showCollapseAll:false});
  context.subscriptions.push(changed,view,profileUI.changed.event(() => changed.fire()),vscode.commands.registerCommand('xscp.refreshConnections',() => changed.fire()));
}
