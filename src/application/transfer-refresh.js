import {dirname,normalize,posix} from 'node:path';
/** Only target panes whose visible directory actually changed need a new listing. */
export function transferRefreshSides(jobs,paths,{localMode=false}={}) {
  const changed=new Set();
  for(const job of jobs) {
    const side=job.direction==='upload' ? 'remote':'local',remote=side==='remote' && !localMode;
    const path=job.finalTarget ?? job.target,folder=paths[side];if(!path || !folder) continue;
    const normalized=value=>remote ? posix.normalize(value):process.platform==='win32' ? normalize(value).toLowerCase():normalize(value);
    if(normalized((remote ? posix.dirname:dirname)(path))===normalized(folder) || normalized(path)===normalized(folder)) changed.add(side);
  }
  return changed;
}
