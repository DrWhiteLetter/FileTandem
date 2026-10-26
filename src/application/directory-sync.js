import { posix } from 'node:path';

/** Read-only, bounded comparison. Links are never followed. */
export async function planDirectorySync({source,target,sourceRoot,targetRoot,sourcePath=posix,targetPath=posix,windowsTarget=false}) {
  const scan=async (service,root,paths) => {
    const nodes=new Map();let count=0;
    const visit=async (path,relative,depth) => {
      if (++count>10000 || depth>100) throw new Error('Abgleich überschreitet 10.000 Einträge/Tiefe 100.');
      const info=await service.stat(path);
      nodes.set(relative,{kind:info.kind,size:info.size,modified:info.modified,path});
      if (info.kind!=='directory') return;
      const listing=await service.listNoFollow(path);const names=new Set();
      for (const child of listing.entries) {
        if (!child.name || ['.','..'].includes(child.name) || /[\\/\0]/.test(child.name) || names.has(child.name)) throw new Error('Ungültiger Name im Abgleich.');
        names.add(child.name);await visit(paths.join(path,child.name),relative ? relative+'/'+child.name:child.name,depth+1);
      }
    };
    await visit(root,'',0);if (nodes.get('').kind!=='directory') throw new Error('Bitte zwei Ordner für den Abgleich auswählen.');return nodes;
  };
  const [left,right]=await Promise.all([scan(source,sourceRoot,sourcePath),scan(target,targetRoot,targetPath)]);
  const targetNodes=new Map();
  for (const [relative,node] of right) {const key=windowsTarget ? relative.toLowerCase():relative;if (targetNodes.has(key)) throw new Error('Mehrdeutige Zielnamen im Abgleich.');targetNodes.set(key,node);}
  const operations=[],skipped=[];const covered=[];const targets=new Set();
  for (const [relative,node] of left) {
    if (!relative) continue;
    if (windowsTarget && relative.split('/').some(name => /[<>:"|?*]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))) throw new Error('Name ist am Windows-Ziel nicht darstellbar.');
    const key=windowsTarget ? relative.toLowerCase():relative;
    if (targets.has(key)) throw new Error('Mehrdeutige Zielnamen im Abgleich.');targets.add(key);
    if (!['file','directory'].includes(node.kind)) {skipped.push(relative);continue;}
    if (covered.some(parent => relative.startsWith(parent+'/'))) continue;
    const other=targetNodes.get(key);
    if (other && other.kind!==node.kind) {skipped.push(relative);if (node.kind==='directory') covered.push(relative);continue;}
    if (node.kind==='directory') {
      if (!other) {operations.push({relative,source:node.path,destination:targetPath.dirname(targetPath.join(targetRoot,...relative.split('/'))),kind:'directory'});covered.push(relative);}
    } else if (!other || node.size!==other.size || Math.floor(node.modified/1000)!==Math.floor(other.modified/1000)) {
      operations.push({relative,source:node.path,destination:targetPath.dirname(targetPath.join(targetRoot,...relative.split('/'))),kind:'file'});
    }
  }
  if (operations.length>1000) throw new Error('Abgleich enthält mehr als 1.000 Transferauswahlen; bitte einen kleineren Ordner wählen.');
  const fingerprint=JSON.stringify([Array.from(left),Array.from(right)] .map(nodes => nodes.sort(([a],[b]) => a.localeCompare(b))));
  return {operations,skipped,fingerprint};
}
