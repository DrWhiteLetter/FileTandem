import { posix } from 'node:path';
/** Preflight creates a bounded postorder plan. Symlink targets are never read. */
export async function planRemoteDelete(service,paths) {
  const plan=[];const visited=new Set();
  const visit=async (path,depth=0) => {
    if (path === '/' || !path.startsWith('/') || depth > 100 || plan.length >= 10000 || visited.size >= 10000) throw new Error('Löschumfang überschreitet sichere Grenzen.');
    if (visited.has(path)) return;visited.add(path);
    const info=await service.stat(path);
    if (info.kind === 'directory') {
      const listing=await service.listNoFollow(path);
      for (const entry of listing.entries) {if (posix.dirname(entry.path) !== path) throw new Error('Ungültiger Unterpfad in Löschliste.');await visit(entry.path,depth+1);}
    }
    plan.push({path,kind:info.kind});
  };
  for (const path of paths) await visit(path);
  return plan;
}
export async function executeRemoteDelete(service,plan,allowed) {
  const dirs=new Set(plan.filter(e => e.kind === 'directory').map(e => e.path));
  for (const entry of plan) {
    if (!allowed()) throw new Error('Löschfreigabe wurde zurückgenommen.');
    for (let parent=posix.dirname(entry.path);parent !== '/';parent=posix.dirname(parent)) {
      if (dirs.has(parent) && (await service.stat(parent)).kind !== 'directory') throw new Error('Ordner wurde während des Löschens ersetzt.');
    }
    if ((await service.stat(entry.path)).kind !== entry.kind) throw new Error('Eintrag wurde während des Löschens ersetzt.');
    await service.call(entry.kind === 'directory' ? 'rmdir':'unlink',entry.path);
  }
}
