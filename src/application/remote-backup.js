import {posix} from 'node:path';
import {isBackupPath} from './file-policy.js';
import {snapshotEqual} from './transfer-file.js';
import {requireNewTarget} from './file-operations.js';
const checkPath=path => {if(typeof path!=='string' || !path.startsWith('/') || path==='/' || posix.normalize(path)!==path || path.includes('\0') || path.length>4096) throw new Error('Invalid remote backup path.');};
/** Rename whole selected roots, never traverse links or overwrite an existing backup. */
export async function planRemoteBackup(service,paths) {
  if(!Array.isArray(paths) || !paths.length || paths.length>1000) throw new Error('Invalid remote backup selection.');
  const roots=[...new Set(paths)].sort((a,b)=>a.length-b.length),plan=[];
  for(const path of roots) {
    checkPath(path);if(isBackupPath(path)) throw new Error('Delete backup files separately to remove them permanently.');
    if(plan.some(entry=>path.startsWith(entry.path+'/'))) continue;
    const info=await service.stat(path);if(!['file','directory','symlink'].includes(info.kind)) throw new Error('This entry cannot be backed up by renaming.');
    plan.push({path,info});
  }
  return plan;
}
export async function backupRemoteEntry(service,path,allowed,expected) {
  checkPath(path);if(isBackupPath(path)) throw new Error('Backup files are excluded from automatic deletion.');
  const info=expected ?? await service.stat(path);
  for(let index=0;index<10000;index++) {
    const target=path+'.bak'+(index ? '.'+index:'');checkPath(target);
    if(Buffer.byteLength(posix.basename(target),'utf8')>255) throw new Error('Filename is too long for a .bak backup; rename it first.');
    try {await service.stat(target);continue;}catch(error){if(!['ENOENT',2].includes(error.code)) throw error;}
    if(!allowed()) throw new Error('Backup permission was revoked.');
    if(!snapshotEqual(info,await service.stat(path))) throw new Error('The entry changed before it could be backed up.');
    // SFTP v3 rename and the SCP no-clobber rename refuse an occupied destination.
    if(!allowed()) throw new Error('Backup permission was revoked.');
    await service.rename(path,target);return target;
  }
  throw new Error('No available backup filename found.');
}
export async function executeRemoteBackup(service,plan,allowed) {
  const result=[];for(const entry of plan) result.push({source:entry.path,target:await backupRemoteEntry(service,entry.path,allowed,entry.info)});return result;
}
export async function restoreRemoteBackup(service,path,allowed) {
  checkPath(path);if(!isBackupPath(path)) throw new Error('Select a .bak backup to restore.');
  const target=path.replace(/\.bak(?:\.\d+)?$/i,'');checkPath(target);
  const info=await service.stat(path);await requireNewTarget(service,target);
  if(!allowed()) throw new Error('Backup permission was revoked.');
  if(!snapshotEqual(info,await service.stat(path))) throw new Error('The backup changed before it could be restored.');
  if(!allowed()) throw new Error('Backup permission was revoked.');
  await service.rename(path,target);return target;
}
