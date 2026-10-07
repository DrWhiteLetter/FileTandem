import { streamFile } from '../adapters/sftp/pipeline.js';import { verifyResume } from './transfer-resume.js';
export const snapshotEqual=(a,b) => JSON.stringify(a && [a.kind,a.size,a.modified,a.mode,a.ino,a.dev]) === JSON.stringify(b && [b.kind,b.size,b.modified,b.mode,b.ino,b.dev]);
export async function targetSnapshot(target,path) {try {return await target.stat(path);} catch(error) {if (['ENOENT',2].includes(error.code)) return undefined;throw error;}}
export async function transferFile(session,job,{target,replace=false,signal,onProgress,stream=streamFile,source,identity,onCheckpoint=() => {}}) {
 if (!/^[a-zA-Z0-9-]{1,64}$/.test(job.id)) throw new Error('Ungültige Transfer-ID.');
 let before=await targetSnapshot(target,job.target),part=target.partial(job.target,job.id),offset=0,sourceHash,attempt;
 if (job.resumeFrom) {const verified=await verifyResume(job,{target,source,identity,signal});({before,part,offset,sourceHash,attempt}=verified);replace=!!before;}
 if (before && (!replace || before.kind !== 'file' || !target.atomicReplace)) throw Object.assign(new Error('Zielkonflikt.'),{publicMessage:'Ziel existiert; sichere Ersetzung nicht freigegeben oder verfügbar.'});
 signal?.throwIfAborted();
 if (source && !attempt) {const sourceInfo=await source.stat(job.source);if (sourceInfo.kind!=='file') throw new Error('Quelle ist keine reguläre Datei.');sourceHash=await source.hash(job.source,signal);if (!snapshotEqual(sourceInfo,await source.stat(job.source))) throw new Error('Quelle während der Vorprüfung geändert.');attempt={id:job.id,part,target:job.target,source:job.source,protocol:job.protocol ?? 'sftp',identity,sourceInfo,sourceHash,before:before ?? null};}
 if (attempt) await onCheckpoint(attempt);
 const result=await stream(session,{direction:job.direction,local:job.direction === 'upload' ? job.source:part,remote:job.direction === 'upload' ? part:job.source,signal,onProgress,offset,resume:!!job.resumeFrom});
 if ((sourceHash && result.sha256!==sourceHash) || (await target.stat(part)).size !== result.bytes || await target.hash(part,signal) !== result.sha256) throw new Error('Teil-Datei hat falsche Größe oder Prüfsumme; Quelle möglicherweise geändert.');
 await target.prepare?.(part,job.metadata);signal?.throwIfAborted();
 if (!snapshotEqual(before,await targetSnapshot(target,job.target))) throw Object.assign(new Error('Ziel wurde zwischenzeitlich geändert.'),{publicMessage:'Ziel wurde während des Transfers geändert; Teil-Datei bleibt zur Prüfung erhalten.'});
 await target.publish(part,job.target,!!before);return {...result,committed:true,partialPath:part};
}
