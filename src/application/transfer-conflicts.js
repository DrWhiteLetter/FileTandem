import { targetSnapshot } from './transfer-file.js';
export class ConflictRules {
  constructor(choose) {this.choose=choose;this.rules=new Map();this.pending=new Map();}
  async resolve(job,target,signal) {
    // The queue runs files in parallel. Serialize conflict decisions within each
    // batch so a second file sees the first dialog's apply-to-all choice.
    const previous=this.pending.get(job.batchId) ?? Promise.resolve();
    let release;const turn=new Promise(resolve => {release=resolve;});
    const tail=previous.then(() => turn);this.pending.set(job.batchId,tail);
    void tail.then(() => {if (this.pending.get(job.batchId)===tail) this.pending.delete(job.batchId);});
    let abort;
    try {
      signal?.throwIfAborted();
      // Only decisions are serialized; independent metadata requests may overlap.
      const snapshot=targetSnapshot(target,job.target).then(value=>({value}),error=>({error}));
      if (signal) await Promise.race([previous,new Promise((_,reject) => {
        abort=() => reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
      })]);
      else await previous;
      signal?.throwIfAborted();
      const result=await snapshot;signal?.throwIfAborted();if(result.error) throw result.error;
      return await this.resolveConflict(job,target,signal,result.value);
    } finally {if (abort) signal.removeEventListener('abort',abort);release();}
  }
  async resolveConflict(job,target,signal,existing) {
    if (!existing) return {path:job.target,replace:false};
    const safeReplace=target.atomicReplace && existing.kind === 'file';
    let choice=this.rules.get(job.batchId);
    if (!choice || (choice === 'replace' && !safeReplace)) {
      signal?.throwIfAborted();let abort;const cancelled=new Promise((_,reject) => {abort=() => reject(signal.reason ?? new Error('Abgebrochen.'));signal?.addEventListener('abort',abort,{once:true});});let answer;try {answer=await Promise.race([this.choose({direction:job.direction,path:job.target,safeReplace,kind:existing.kind,signal}),cancelled]);} finally {signal?.removeEventListener('abort',abort);}signal?.throwIfAborted();
      choice=answer?.choice ?? 'cancel';if (!['replace','skip','keep','cancel'].includes(choice) || (choice === 'replace' && !safeReplace)) throw new Error('Ungültige Konfliktentscheidung.');
      if (answer?.apply && choice !== 'cancel') this.rules.set(job.batchId,choice);
    }
    if (choice === 'cancel') throw Object.assign(new Error('Auftrag abgebrochen.'),{code:'USER_CANCELLED',publicMessage:'Konfliktentscheidung: Abgebrochen.'});
    if (choice === 'skip') return {skipped:true};
    if (choice === 'replace') return {path:job.target,replace:true};
    for (let index=2;index <= 10000;index++) {signal?.throwIfAborted();const path=target.alternative(job.target,index);if (!await targetSnapshot(target,path)) return {path,replace:false};}
    throw new Error('Kein freier Alternativname gefunden.');
  }
}
