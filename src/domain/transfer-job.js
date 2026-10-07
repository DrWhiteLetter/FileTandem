/** @typedef {{id:string,batchId:string,profileId:string,server:string,direction:'upload'|'download',source:string,target:string,lockKey:string,state:string,bytes:number}} TransferJob */
export const TERMINAL=['completed','skipped','failed','cancelled','interrupted'];
const transitions={queued:['running','cancelled','interrupted','skipped'],running:['completed','skipped','failed','cancelled','interrupted']};
export function transition(job,state) {if (!transitions[job.state]?.includes(state)) throw new Error(`Ungültiger Auftragsübergang: ${job.state} → ${state}`);return {...job,state};}
export function batchState(jobs) {
  if (jobs.some(j => j.state === 'running')) return 'running';
  if (jobs.some(j => j.state === 'queued')) return 'queued';
  if (jobs.some(j => ['failed','interrupted'].includes(j.state))) return 'failed';
  if (jobs.some(j => j.state === 'cancelled')) return 'cancelled';
  return jobs.every(j => j.state === 'skipped') ? 'skipped':'completed';
}
export const locksOverlap=(a,b) => a === b || a.startsWith(b+'/') || b.startsWith(a+'/');
