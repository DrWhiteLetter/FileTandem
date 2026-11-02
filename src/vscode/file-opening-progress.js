import { posix } from 'node:path';

/** Shared feedback for remote image previews and editor files. */
export function registerFileOpeningProgress(context,{vscode,t=value=>value,onChange=()=>{}}) {
  const pending=new Map();let disposed=false;
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,20);
  status.name='FileTandem';
  const key=(profile,path)=>JSON.stringify([profile.id,path]);
  const refresh=()=>{
    if (disposed) return;
    const active=[...pending.values()];
    if (!active.length) status.hide();
    else {
      const item=active[0];
      status.text=`$(loading~spin) FileTandem: ${posix.basename(item.path)} · ${t(item.message)}${active.length>1 ? ` (+${active.length-1})`:''}`;
      status.tooltip=active.map(item=>`${item.profile.name ?? item.profile.id}: ${item.path}\n${t(item.message)}`).join('\n\n');
      status.accessibilityInformation={label:status.tooltip};status.show();
    }
    onChange();
  };
  context.subscriptions.push({dispose(){disposed=true;pending.clear();status.dispose();}});
  return {
    state(profile,path) {return pending.get(key(profile,path))?.message;},
    run(profile,path,action,message='Opening file …') {
      if (disposed) return Promise.reject(new Error('File opening progress closed.'));
      const id=key(profile,path),existing=pending.get(id);if (existing) return existing.promise;
      const item={profile,path,message};pending.set(id,item);
      const report=message=>{if (item.message!==message) {item.message=message;refresh();}};
      item.promise=Promise.resolve().then(()=>action(report)).finally(()=>{pending.delete(id);refresh();});
      refresh();return item.promise;
    },
  };
}
