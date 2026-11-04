/** Send only displayed rows; keep totals and retry actions for the entire history. */
export function transferView(jobs) {
  let active=0,failures=0;const retryIds=[];
  for(const job of jobs) {
    if(['queued','running'].includes(job.state)) active++;
    if(['failed','interrupted'].includes(job.state)) failures++;
    if(retryIds.length<1000 && ['failed','cancelled','interrupted'].includes(job.state)) retryIds.push(job.id);
  }
  const fields=['verification','id','source','target','finalTarget','direction','protocol','state','bytes','rate','error','reason','partialCleaned','committed'];
  return {queue:jobs.slice(-200).map(job=>({...Object.fromEntries(fields.filter(key=>job[key]!==undefined).map(key=>[key,job[key]])),attempt:!!job.attempt})),queueSummary:{total:jobs.length,active,failures,retryIds}};
}
