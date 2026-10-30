import { vscode,t,language } from './localized-vscode.js';
export function registerConnectionsView(context,profileUI) {
  const changed=new vscode.EventEmitter();
  const provider={onDidChangeTreeData:changed.event,getChildren:() => profileUI.profiles.list().sort((a,b) => Number(b.favorite)-Number(a.favorite) || a.name.localeCompare(b.name,language())).map(profile => ({
    id:profile.id,label:`${profile.favorite ? '★ ':''}${profile.name}`,description:`${profile.protocol.toUpperCase()} · ${t({connecting:"Connecting …",connected:"Connected",error:"Error",disconnected:"Disconnected"}[profileUI.sessions.snapshot(profile.id).state])}`,
    tooltip:`${profile.username}@${profile.host}:${profile.port}`,contextValue:'filetandemProfile',profileId:profile.id,
    command:{command:'filetandem.openProfile',title:t("Open profile"),arguments:[profile.id]},iconPath:new vscode.ThemeIcon('server'),
  })),getTreeItem:item => item};
  const view=vscode.window.createTreeView('filetandem.connections',{treeDataProvider:provider,showCollapseAll:false});
  context.subscriptions.push(changed,view,profileUI.changed.event(() => changed.fire()),vscode.workspace.onDidChangeConfiguration(event => {if(event.affectsConfiguration('filetandem.language')) changed.fire();}),vscode.commands.registerCommand('filetandem.refreshConnections',() => changed.fire()));
}
