import * as vscode from 'vscode';
export function registerConnectionsView(context) {
  const changed = new vscode.EventEmitter();
  const provider = {
    onDidChangeTreeData: changed.event,
    getChildren: () => [{ label: 'Demo-Dateimanager', description: 'Mock-Daten · keine Verbindung', command: { command: 'xscp.openManager', title: 'Demo öffnen' }, iconPath: new vscode.ThemeIcon('server') }],
    getTreeItem: item => item,
  };
  const view = vscode.window.createTreeView('xscp.connections', { treeDataProvider: provider, showCollapseAll: false });
  context.subscriptions.push(changed, view, vscode.commands.registerCommand('xscp.refreshConnections', () => changed.fire()));
}
