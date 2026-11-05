/** Send only displayed rows; keep totals and retry actions for the entire history. */
export function transferView(jobs) {
  let active=0,failures=0;const retryIds=[];
  for(const job of jobs) {
    if(['queued','running'].includes(job.state)) active++;
    if(['failed','interrupted'].includes(job.state)) failures++;
    if(retryIds.length<1000 && ['failed','cancelled','interrupted'].includes(job.state)) retryIds.push(job.id);
  }
  const fields=['batchId','verification','id','source','target','finalTarget','direction','protocol','state','bytes','rate','error','reason','partialCleaned','committed'];
  return {queue:jobs.slice(-200).map(job=>({...Object.fromEntries(fields.filter(key=>job[key]!==undefined).map(key=>[key,job[key]])),attempt:!!job.attempt})),queueSummary:{total:jobs.length,active,failures,retryIds,progress:transferProgress(jobs)}};
}

/** Active batches, or the latest batch after completion; never dilute with old history. */
export function transferProgress(jobs) {
  const batches=new Set(jobs.filter(job=>['queued','running'].includes(job.state)).map(job=>job.batchId));
  if(!batches.size && jobs.length) batches.add(jobs.at(-1).batchId);
  const progress={total:0,settled:0,completed:0,failed:0,skipped:0,cancelled:0,running:0,bytes:0,rate:0};
  for(const job of jobs) {
    if(!batches.has(job.batchId)) continue;
    progress.total++;
    if(!['queued','running'].includes(job.state)) progress.settled++;
    if(job.state==='completed') progress.completed++;
    if(['failed','interrupted'].includes(job.state)) progress.failed++;
    if(job.state==='skipped') progress.skipped++;
    if(job.state==='cancelled') progress.cancelled++;
    if(job.state==='running') {progress.running++;progress.rate+=Math.max(0,Number(job.rate)||0);}
    progress.bytes+=Math.max(0,Number(job.bytes)||0);
  }
  return progress;
}
