import {TERMINAL} from '../domain/transfer-job.js';

/** Freeze the selection before confirmation; newly finished transfers remain visible. */
export async function clearTransferHistory({queue,profileId,mode,confirm,isCurrent}) {
  if (!['successful','all'].includes(mode)) throw new Error('Invalid history selection.');
  const ids=queue.list(profileId).filter(job=>!job.historyHidden && (mode==='successful' ? job.state==='completed':TERMINAL.includes(job.state))).map(job=>job.id);
  if (!ids.length || mode==='all' && !await confirm() || !isCurrent()) return 0;
  return queue.clearHistory(profileId,mode,ids);
}
