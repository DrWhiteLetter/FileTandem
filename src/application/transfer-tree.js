/** Incremental no-follow discovery; directories precede their children. */
export async function* discoverTree(service,path,relative='',depth=0,counter={count:0},exclude=()=>false,listed) {
  if (++counter.count > 10000 || depth > 100) throw new Error('Transferbaum überschreitet 10.000 Einträge/Tiefe 100.');
  // Reuse listed leaf metadata; directories are rechecked before traversal.
  const entry=listed && ['file','symlink','other'].includes(listed.kind) ? listed:await service.stat(path);if(exclude(path,entry.kind)) return;yield {source:path,relative,kind:entry.kind,metadata:{mode:entry.mode & 0o777,modified:entry.modified}};
  if (entry.kind !== 'directory') return;
  const result=await service.listNoFollow(path);
  for (const child of result.entries) {if (!child.name || ['.','..'].includes(child.name) || /[\/\0]/.test(child.name)) throw new Error('Ungültiger Name im Transferbaum.');yield* discoverTree(service,child.path,relative ? relative+'/'+child.name:child.name,depth+1,counter,exclude,child);}
}
