import { transition,batchState,locksOverlap,TERMINAL } from '../domain/transfer-job.js';
export class TransferQueue {
  #jobs=new Map();#active=new Map();#scheduled=false;#disposed=false;
  constructor({run,onChange=() => {},limit=2}) {this.run=run;this.onChange=onChange;this.limit=limit;this.paused=false;}
  list(profileId) {return [...this.#jobs.values()].filter(j => !profileId || j.profileId === profileId).map(j => ({...j}));}
  batches() {return [...new Set(this.list().map(j => j.batchId))].map(id => ({id,state:batchState(this.list().filter(j => j.batchId === id))}));}
  add(raw) {
    if (this.#disposed || this.#jobs.has(raw.id) || !['upload','download'].includes(raw.direction) || ![raw.id,raw.batchId,raw.profileId,raw.server,raw.source,raw.target,raw.lockKey].every(v => typeof v === 'string' && v)) throw new Error('Ungültiger Transferauftrag.');
    const job={...raw,state:'queued',bytes:0,error:'',started:0,rate:0};this.#jobs.set(job.id,job);this.#notify();this.#schedule();return job.id;
  }
  #notify() {this.onChange(this.list());}
  #schedule() {if (!this.#scheduled) {this.#scheduled=true;queueMicrotask(() => {this.#scheduled=false;this.#pump();});}}
  #pump() {
    if (this.paused || this.#disposed) return;
    for (const job of this.#jobs.values()) {
      if (job.state !== 'queued') continue;
      const active=[...this.#active.values()];
      if (active.filter(a => a.job.server === job.server).length >= this.limit || active.some(a => locksOverlap(a.job.lockKey,job.lockKey))) continue;
      const controller=new AbortController();this.#active.set(job.id,{job,controller});
      this.#jobs.set(job.id,{...transition(job,'running'),started:Date.now()});this.#notify();
      Promise.resolve().then(() => this.run({...job},controller.signal,progress => {
        const current=this.#jobs.get(job.id);if (current.state !== 'running') return;
        const bytes=Number.isFinite(progress.bytes) ? progress.bytes:current.bytes;
        this.#jobs.set(job.id,{...current,bytes,rate:bytes/Math.max(.001,(Date.now()-current.started)/1000)});this.#notify();
      })).then(result => {
        const current=this.#jobs.get(job.id);this.#jobs.set(job.id,{...transition(current,controller.signal.aborted && !result?.committed ? 'cancelled':result?.skipped ? 'skipped':'completed'),...result, state:controller.signal.aborted && !result?.committed ? 'cancelled':result?.skipped ? 'skipped':'completed'});
      },error => {const current=this.#jobs.get(job.id);this.#jobs.set(job.id,{...transition(current,controller.signal.aborted || error.code === 'USER_CANCELLED' ? 'cancelled':'failed'),error:controller.signal.aborted ? 'Abgebrochen.':error.publicMessage ?? 'Transfer fehlgeschlagen; Quelle/Ziel und Verbindung prüfen.'});})
        .finally(() => {this.#active.delete(job.id);this.#notify();this.#schedule();});
    }
  }
  async idle() {while (this.list().some(j => !TERMINAL.includes(j.state))) await new Promise(resolve => setTimeout(resolve,10));}
  dispose() {this.#disposed=true;for (const a of this.#active.values()) a.controller.abort();for (const [id,j] of this.#jobs) if (j.state === 'queued') this.#jobs.set(id,transition(j,'cancelled'));}
}
