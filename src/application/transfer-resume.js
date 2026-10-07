import { createHash } from 'node:crypto';import { snapshotEqual,targetSnapshot } from './transfer-file.js';
export const profileIdentity=profile => createHash('sha256').update(JSON.stringify([profile.host.toLowerCase(),profile.port,profile.username,profile.protocol])).digest('hex');
const mismatch=message => Object.assign(new Error(message),{code:'RESUME_RESTART_REQUIRED',publicMessage:message+' Bitte vollständig neu starten; vorhandenes Ziel bleibt erhalten.'});
export async function verifyResume(job,{target,source,identity,signal}) {
 const a=job.attempt;
 if (!a || a.protocol !== 'sftp' || a.identity !== identity || a.source !== job.source || a.target !== job.target || !/^[a-zA-Z0-9-]{1,64}$/.test(a.id) || a.part !== target.partial(a.target,a.id) || !a.sourceInfo || !/^[a-f0-9]{64}$/.test(a.sourceHash ?? '')) throw mismatch('Teil-Datei ist keinem passenden eigenen Auftrag zugeordnet.');
 const current=await source.stat(job.source);if (!snapshotEqual(current,a.sourceInfo) || current.kind !== 'file' || await source.hash(job.source,signal)!==a.sourceHash) throw mismatch('Quelle wurde seit der Unterbrechung geändert.');
 if (!snapshotEqual(a.before ?? undefined,await targetSnapshot(target,job.target))) throw mismatch('Ziel wurde seit der Unterbrechung geändert.');
 const partial=await targetSnapshot(target,a.part);if (!partial || partial.kind !== 'file' || !Number.isSafeInteger(partial.size) || partial.size<0 || partial.size>current.size) throw mismatch('Teil-Datei fehlt oder hat einen ungültigen Typ/Umfang.');
 if (await target.hash(a.part,signal,partial.size)!==await source.hash(job.source,signal,partial.size)) throw mismatch('Vorhandener Datei-Präfix stimmt nicht mit der Quelle überein.');
 signal?.throwIfAborted();return {part:a.part,offset:partial.size,before:a.before ?? undefined,sourceHash:a.sourceHash,attempt:a};
}
