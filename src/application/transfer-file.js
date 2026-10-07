import { streamFile } from '../adapters/sftp/pipeline.js';
export const snapshotEqual=(a,b) => JSON.stringify(a && [a.kind,a.size,a.modified,a.mode,a.ino,a.dev]) === JSON.stringify(b && [b.kind,b.size,b.modified,b.mode,b.ino,b.dev]);
export async function targetSnapshot(target,path) {try {return await target.stat(path);} catch(error) {if (['ENOENT',2].includes(error.code)) return undefined;throw error;}}
export async function transferFile(session,job,{target,replace=false,signal,onProgress}) {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(job.id)) throw new Error('Ungültige Transfer-ID.');
  const before=await targetSnapshot(target,job.target);
  if (before && (!replace || before.kind !== 'file' || !target.atomicReplace)) throw Object.assign(new Error('Zielkonflikt.'),{publicMessage:'Ziel existiert; sichere Ersetzung nicht freigegeben oder verfügbar.'});
  const part=target.partial(job.target,job.id);signal?.throwIfAborted();
  const result=await streamFile(session,{direction:job.direction,local:job.direction === 'upload' ? job.source:part,remote:job.direction === 'upload' ? part:job.source,signal,onProgress});
  if ((await target.stat(part)).size !== result.bytes || await target.hash(part,signal) !== result.sha256) throw new Error('Teil-Datei hat falsche Größe oder Prüfsumme.');
  signal?.throwIfAborted();
  if (!snapshotEqual(before,await targetSnapshot(target,job.target))) throw Object.assign(new Error('Ziel wurde zwischenzeitlich geändert.'),{publicMessage:'Ziel wurde während des Transfers geändert; Teil-Datei bleibt zur Prüfung erhalten.'});
  await target.publish(part,job.target,!!before);return {...result,committed:true,partialPath:part};
}
