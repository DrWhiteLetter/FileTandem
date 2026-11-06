import { streamFile } from '../adapters/sftp/pipeline.js';import { verifyResume } from './transfer-resume.js';
const autoConflict=message => Object.assign(new Error(message),{code:'AUTO_UPLOAD_CONFLICT',publicMessage:message});
export const snapshotEqual=(a,b) => JSON.stringify(a && [a.kind,a.size,a.modified,a.mode,a.ino,a.dev]) === JSON.stringify(b && [b.kind,b.size,b.modified,b.mode,b.ino,b.dev]);
export async function targetSnapshot(target,path) {try {return await target.stat(path);} catch(error) {if (['ENOENT',2].includes(error.code)) return undefined;throw error;}}
export async function transferFile(session,job,{target,replace=false,verification='sha256',checkUploadOwnership=false,signal,onProgress,stream=streamFile,source,identity,onCheckpoint=() => {},beforePublish=() => {}}) {
 if(!['sha256','size'].includes(verification) || verification==='size' && (job.protocol!=='sftp' || job.direction!=='upload' || job.resumeFrom || job.automatic || job.reviewedReplacement || Object.hasOwn(job,'expectedTarget'))) throw new Error('Invalid transfer verification mode.');
 if (!/^[a-zA-Z0-9-]{1,64}$/.test(job.id)) throw new Error('Ungültige Transfer-ID.');
 let before=await targetSnapshot(target,job.target),part=target.partial(job.target,job.id),offset=0,sourceHash,attempt;
 if (job.resumeFrom) {const verified=await verifyResume(job,{target,source,identity,signal});({before,part,offset,sourceHash,attempt}=verified);replace=!!before;}
 if (before && (!replace || before.kind !== 'file' || !target.atomicReplace)) throw Object.assign(new Error('Zielkonflikt.'),{publicMessage:'Ziel existiert; sichere Ersetzung nicht freigegeben oder verfügbar.'});
 if (job.reviewedReplacement && (!before || before.kind!=='file' || await target.hash(job.target,signal)!==job.reviewedReplacement)) throw Object.assign(new Error('Serverstand der Editorkopie wurde geändert.'),{code:'EDITOR_CONFLICT',publicMessage:'Serverstand der Editorkopie wurde geändert; Kopie neu herunterladen und Änderungen vergleichen.'});
 if (Object.hasOwn(job,'expectedTarget') && !snapshotEqual(job.expectedTarget ?? undefined,before)) throw autoConflict('Remote-Datei wurde seit Aktivierung der Überwachung geändert.');
 if (job.expectedTargetHash && (!before || await target.hash(job.target,signal)!==job.expectedTargetHash)) throw autoConflict('Remote-Datei wurde seit dem letzten automatischen Upload geändert.');
 signal?.throwIfAborted();
 if (source && !attempt) {const sourceInfo=await source.stat(job.source);if (sourceInfo.kind!=='file') throw new Error('Quelle ist keine reguläre Datei.');sourceHash=await source.hash(job.source,signal,Infinity,sourceInfo.size);if (!snapshotEqual(sourceInfo,await source.stat(job.source))) throw new Error('Quelle während der Vorprüfung geändert.');attempt={id:job.id,part,target:job.target,source:job.source,protocol:job.protocol ?? 'sftp',identity,sourceInfo,sourceHash,before:before ?? null};}
 if (attempt) await onCheckpoint(attempt);
 const result=await stream(session,{direction:job.direction,local:job.direction === 'upload' ? job.source:part,remote:job.direction === 'upload' ? part:job.source,signal,onProgress,offset,resume:!!job.resumeFrom});
 const [partInfo,partHash]=await Promise.all([target.stat(part),verification==='sha256' ? target.hash(part,signal,Infinity,result.bytes):Promise.resolve(undefined)]);
 if ((sourceHash && result.sha256!==sourceHash) || partInfo.kind!=='file' || partInfo.size !== result.bytes || verification==='sha256' && partHash !== result.sha256) throw Object.assign(new Error('Teil-Datei hat falsche Größe oder Prüfsumme; Quelle möglicherweise geändert.'),{code:'TRANSFER_INTEGRITY',publicMessage:'Quelle oder Teil-Datei hat sich verändert; Ziel bleibt erhalten.'});
 await target.prepare?.(part,job.metadata);signal?.throwIfAborted();
 const currentTarget=await targetSnapshot(target,job.target);
 if (!snapshotEqual(before,currentTarget)) throw Object.assign(new Error('Ziel wurde zwischenzeitlich geändert.'),{publicMessage:'Ziel wurde während des Transfers geändert; Teil-Datei bleibt zur Prüfung erhalten.'});
 if (job.reviewedReplacement && await target.hash(job.target,signal)!==job.reviewedReplacement) throw Object.assign(new Error('Serverstand wurde während des Uploads geändert.'),{code:'EDITOR_CONFLICT',publicMessage:'Serverstand wurde während des Uploads geändert; Ziel bleibt erhalten.'});
 // Compare the actual partial file with the existing target before rename.
 // Reuse metadata already fetched by integrity/concurrency checks; never chown.
 if (checkUploadOwnership && job.direction==='upload' && before) {
   const known=info => info && ['uid','gid'].every(key => Number.isSafeInteger(info[key]) && info[key]>=0);
   if (![before,currentTarget,partInfo].every(known)) throw Object.assign(new Error('Upload ownership unavailable.'),{code:'UPLOAD_OWNERSHIP_UNKNOWN',publicMessage:'Eigentümerprüfung nicht möglich: Die Eigentümer- und Gruppenangaben sind unvollständig. Die bestehende Datei bleibt erhalten. Upload neu starten oder Anmeldung und Server prüfen; eigene Teil-Datei bei Bedarf bereinigen.'});
   if (['uid','gid'].some(key => before[key]!==currentTarget[key] || currentTarget[key]!==partInfo[key])) throw Object.assign(new Error('Upload would change ownership.'),{code:'UPLOAD_OWNERSHIP_CHANGED',publicMessage:'Upload gestoppt: Eigentümer oder Gruppe würde sich beim Ersetzen ändern. Die bestehende Datei bleibt erhalten. Mit dem passenden Serverbenutzer verbinden oder die Serverrechte prüfen; eigene Teil-Datei bei Bedarf bereinigen.'});
 }
 await beforePublish();
 if (job.expectedTargetHash && await target.hash(job.target,signal)!==job.expectedTargetHash) throw autoConflict('Remote-Datei wurde während des automatischen Uploads geändert.');
 signal?.throwIfAborted();await target.publish(part,job.target,!!before);return {...result,verification,committed:true,partialPath:part};
}
