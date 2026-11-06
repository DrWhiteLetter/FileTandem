import { localPath } from '../adapters/local/files.js';import { remotePath } from '../adapters/sftp/files.js';
import { mkdir,readFile,open,rename,unlink } from 'node:fs/promises';
import { createHmac,timingSafeEqual } from 'node:crypto';
import { dirname } from 'node:path';import { randomUUID } from 'node:crypto';
const fields=['historyHidden','verification','automatic','id','batchId','profileId','profileKey','server','direction','source','target','lockKey','kind','protocol','metadata','parentId','name','state','bytes','error','errorCode','started','rate','reason','sha256','committed','finalTarget','partialPath','retryOf','attempt','resumeFrom','resumedBytes','partialCleaned'];
const states=['queued','running','completed','failed','cancelled','skipped','interrupted'];
export function journalJob(raw) {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).some(k => !fields.includes(k)) || !['id','batchId','profileId','server','source','target','lockKey'].every(k => typeof raw[k] === 'string' && raw[k].length > 0 && raw[k].length <= 32768) || !['upload','download'].includes(raw.direction) || !states.includes(raw.state) || !['file','directory','symlink','other','error'].includes(raw.kind)) throw new Error('Ungültiger Journaleintrag.');
  (raw.protocol==='local' || raw.direction === 'upload' ? localPath:remotePath)(raw.source);(raw.protocol==='local' || raw.direction !== 'upload' ? localPath:remotePath)(raw.target);
  if (raw.protocol==='local' && (raw.profileId!=='local-files' || raw.server!=='local' || raw.attempt || raw.resumeFrom || raw.automatic)) throw new Error('Ungültiger lokaler Auftrag.');
  if (raw.historyHidden!==undefined && (typeof raw.historyHidden!=='boolean' || raw.historyHidden && ['queued','running'].includes(raw.state))) throw new Error('Invalid transfer history state.');
  if(raw.verification!==undefined && !['sha256','size'].includes(raw.verification)) throw new Error('Invalid verification result.');
  if (raw.automatic!==undefined && typeof raw.automatic!=='boolean') throw new Error('Ungültiger automatischer Auftrag.');
  if (raw.partialCleaned !== undefined && typeof raw.partialCleaned!=='boolean') throw new Error('Ungültiger Bereinigungszustand.');
  if (raw.committed !== undefined && typeof raw.committed !== 'boolean') throw new Error('Ungültiger Journalabschluss.');
  if (raw.profileKey !== undefined && !/^[a-f0-9]{64}$/.test(raw.profileKey)) throw new Error('Ungültige Profilidentität.');
  if (raw.protocol !== undefined && !['scp','sftp','local'].includes(raw.protocol)) throw new Error('Ungültiges Journalprotokoll.');
  for (const key of ['bytes','started','rate']) if (!Number.isFinite(raw[key]) || raw[key] < 0) throw new Error('Ungültiger Journalfortschritt.');
  for (const key of ['parentId','name','errorCode','error','reason','sha256','finalTarget','partialPath','retryOf']) if (raw[key] !== undefined && (typeof raw[key] !== 'string' || raw[key].length > 32768)) throw new Error('Ungültige Journalmetadaten.');
  if (raw.metadata !== undefined && (!raw.metadata || Object.keys(raw.metadata).some(k => !['mode','modified'].includes(k)) || !Number.isInteger(raw.metadata.mode) || raw.metadata.mode < 0 || raw.metadata.mode > 511 || !Number.isFinite(raw.metadata.modified))) throw new Error('Ungültige Dateimetadaten.');
  if (raw.resumeFrom !== undefined && (typeof raw.resumeFrom!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(raw.resumeFrom))) throw new Error('Ungültiger Fortsetzungsauftrag.');
  if (raw.resumedBytes !== undefined && (!Number.isSafeInteger(raw.resumedBytes) || raw.resumedBytes<0)) throw new Error('Ungültiger Fortsetzungsfortschritt.');
  if (raw.attempt !== undefined) {
    const a=raw.attempt;if (!a || Object.keys(a).some(k => !['id','part','target','source','protocol','identity','sourceInfo','sourceHash','before'].includes(k)) || !/^[a-zA-Z0-9-]{1,64}$/.test(a.id ?? '') || !['sftp','scp'].includes(a.protocol) || !/^[a-f0-9]{64}$/.test(a.identity ?? '') || !/^[a-f0-9]{64}$/.test(a.sourceHash ?? '') || !['part','target','source'].every(k => typeof a[k]==='string' && a[k].length<=4096 && !a[k].includes('\0'))) throw new Error('Ungültige Teil-Datei-Zuordnung.');
    for (const info of [a.sourceInfo,a.before].filter(v => v!==null)) if (!info || typeof info!=='object' || Object.keys(info).some(k => !['id','path','name','kind','size','modified','mode','ino','dev','uid','gid','linkTarget','transferable'].includes(k)) || !['file','directory','symlink','other'].includes(info.kind) || !Number.isSafeInteger(info.size) || info.size<0 || !Number.isFinite(info.modified) || !Number.isInteger(info.mode) || ['uid','gid'].some(key => info[key]!==undefined && (!Number.isSafeInteger(info[key]) || info[key]<0))) throw new Error('Ungültiger Quellen-/Zielzustand.');
  }
  return {...raw,state:['queued','running'].includes(raw.state) ? 'interrupted':raw.state};
}
export class TransferJournal {
  constructor(path,onError=() => {}) {this.disabled=false;this.ready=Promise.resolve();this.key=undefined;this.path=path;this.onError=onError;this.pending=[];this.tail=Promise.resolve();this.timer=undefined;}
  async load() {
    await this.ready;if (this.disabled) return [];
    try {
      const data=await readFile(this.path);if (data.length > 32*1024*1024) throw new Error('Journal zu groß.');const value=JSON.parse(data);
      if (value.version !== 1 || !Array.isArray(value.jobs) || value.jobs.length > 10000) throw new Error('Unbekanntes Journalformat.');
      if (this.key) {const expected=createHmac('sha256',this.key).update(JSON.stringify({version:1,jobs:value.jobs})).digest('hex');if (value.mac !== undefined ? (typeof value.mac!=='string' || !/^[a-f0-9]{64}$/.test(value.mac) || !timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(value.mac,'hex'))) : value.jobs.some(j => j?.attempt || j?.resumeFrom)) throw new Error('Journalintegrität verletzt.');}
      const jobs=[],ids=new Set();let invalid=0;for (const raw of value.jobs) {try {const job=journalJob(raw);if (ids.has(job.id)) throw new Error();ids.add(job.id);jobs.push(job);} catch {invalid++;}}
      if (invalid) this.onError(`${invalid} beschädigte Journaleinträge wurden verworfen.`);return jobs;
    } catch(error) {if (error.code === 'ENOENT') return [];await rename(this.path,this.path+'.corrupt-'+randomUUID()).catch(() => {});this.onError('Transferjournal konnte nicht gelesen werden; Sicherung behalten, keine Transfers automatisch gestartet.');return [];}
  }
  // Queue snapshots are immutable; project persisted fields only at the write boundary.
  update(jobs) {this.pending=jobs;if (!this.timer) this.timer=setTimeout(() => {this.timer=undefined;void this.flush();},250);}
  flush() {
    clearTimeout(this.timer);this.timer=undefined;const jobs=this.pending;
    this.tail=this.tail.then(async () => {
      await this.ready;if (this.disabled) return;const temporary=this.path+'.tmp-'+randomUUID();
      try {
        if (jobs.length > 10000) throw new Error('Journalgrenze überschritten.');const payload={version:1,jobs:jobs.map(job => Object.fromEntries(fields.filter(k => job[k] !== undefined).map(k => [k,job[k]])))};const data=JSON.stringify({...payload,...(this.key ? {mac:createHmac('sha256',this.key).update(JSON.stringify(payload)).digest('hex')}:{})});if (Buffer.byteLength(data) > 32*1024*1024) throw new Error('Journalgrenze überschritten.');
        await mkdir(dirname(this.path),{recursive:true});const file=await open(temporary,'wx',0o600);try {await file.writeFile(data);await file.sync();} finally {await file.close();}await rename(temporary,this.path);
      } catch {await unlink(temporary).catch(() => {});this.onError('Transferjournal konnte nicht gesichert werden (maximal 10.000 Aufträge / 32 MiB).');}
    });return this.tail;
  }
}
