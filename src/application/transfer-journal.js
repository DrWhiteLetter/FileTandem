import { localPath } from '../adapters/local/files.js';import { remotePath } from '../adapters/sftp/files.js';
import { mkdir,readFile,open,rename,unlink } from 'node:fs/promises';
import { dirname } from 'node:path';import { randomUUID } from 'node:crypto';
const fields=['id','batchId','profileId','server','direction','source','target','lockKey','kind','protocol','metadata','parentId','name','state','bytes','error','started','rate','reason','sha256','committed','finalTarget','partialPath','retryOf'];
const states=['queued','running','completed','failed','cancelled','skipped','interrupted'];
export function journalJob(raw) {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).some(k => !fields.includes(k)) || !['id','batchId','profileId','server','source','target','lockKey'].every(k => typeof raw[k] === 'string' && raw[k].length > 0 && raw[k].length <= 32768) || !['upload','download'].includes(raw.direction) || !states.includes(raw.state) || !['file','directory','symlink','other','error'].includes(raw.kind)) throw new Error('Ungültiger Journaleintrag.');
  (raw.direction === 'upload' ? localPath:remotePath)(raw.source);(raw.direction === 'upload' ? remotePath:localPath)(raw.target);
  if (raw.committed !== undefined && typeof raw.committed !== 'boolean') throw new Error('Ungültiger Journalabschluss.');
  if (raw.protocol !== undefined && !['scp','sftp'].includes(raw.protocol)) throw new Error('Ungültiges Journalprotokoll.');
  for (const key of ['bytes','started','rate']) if (!Number.isFinite(raw[key]) || raw[key] < 0) throw new Error('Ungültiger Journalfortschritt.');
  for (const key of ['parentId','name','error','reason','sha256','finalTarget','partialPath','retryOf']) if (raw[key] !== undefined && (typeof raw[key] !== 'string' || raw[key].length > 32768)) throw new Error('Ungültige Journalmetadaten.');
  if (raw.metadata !== undefined && (!raw.metadata || Object.keys(raw.metadata).some(k => !['mode','modified'].includes(k)) || !Number.isInteger(raw.metadata.mode) || raw.metadata.mode < 0 || raw.metadata.mode > 511 || !Number.isFinite(raw.metadata.modified))) throw new Error('Ungültige Dateimetadaten.');
  return {...raw,state:['queued','running'].includes(raw.state) ? 'interrupted':raw.state};
}
export class TransferJournal {
  constructor(path,onError=() => {}) {this.path=path;this.onError=onError;this.pending=[];this.tail=Promise.resolve();this.timer=undefined;}
  async load() {
    try {
      const data=await readFile(this.path);if (data.length > 32*1024*1024) throw new Error('Journal zu groß.');const value=JSON.parse(data);
      if (value.version !== 1 || !Array.isArray(value.jobs) || value.jobs.length > 10000) throw new Error('Unbekanntes Journalformat.');
      const jobs=[],ids=new Set();let invalid=0;for (const raw of value.jobs) {try {const job=journalJob(raw);if (ids.has(job.id)) throw new Error();ids.add(job.id);jobs.push(job);} catch {invalid++;}}
      if (invalid) this.onError(`${invalid} beschädigte Journaleinträge wurden verworfen.`);return jobs;
    } catch(error) {if (error.code === 'ENOENT') return [];await rename(this.path,this.path+'.corrupt-'+randomUUID()).catch(() => {});this.onError('Transferjournal konnte nicht gelesen werden; Sicherung behalten, keine Transfers automatisch gestartet.');return [];}
  }
  update(jobs) {this.pending=jobs.map(job => Object.fromEntries(fields.filter(k => job[k] !== undefined).map(k => [k,job[k]])));if (!this.timer) this.timer=setTimeout(() => {this.timer=undefined;void this.flush();},250);}
  flush() {
    clearTimeout(this.timer);this.timer=undefined;const jobs=this.pending;
    this.tail=this.tail.then(async () => {
      const temporary=this.path+'.tmp-'+randomUUID();
      try {
        if (jobs.length > 10000) throw new Error('Journalgrenze überschritten.');const data=JSON.stringify({version:1,jobs});if (Buffer.byteLength(data) > 32*1024*1024) throw new Error('Journalgrenze überschritten.');
        await mkdir(dirname(this.path),{recursive:true});const file=await open(temporary,'wx',0o600);try {await file.writeFile(data);await file.sync();} finally {await file.close();}await rename(temporary,this.path);
      } catch {await unlink(temporary).catch(() => {});this.onError('Transferjournal konnte nicht gesichert werden (maximal 10.000 Aufträge / 32 MiB).');}
    });return this.tail;
  }
}
