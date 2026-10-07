import { fileName } from '../domain/file-name.js';
export async function requireNewTarget(service,path) {
  try {await service.stat(path);} catch(error) {if (['ENOENT',2].includes(error.code)) return;throw error;}
  throw Object.assign(new Error('Ziel existiert bereits; es wird nichts überschrieben.'),{code:'EEXIST'});
}
export async function createFolder(service,parent,name,{windows=false,join}) {
  const target=join(parent,fileName(name,windows));await requireNewTarget(service,target);await service.mkdir(target);return target;
}
export async function renameEntry(service,path,parent,name,{windows=false,join}) {
  const target=join(parent,fileName(name,windows));if (target === path) return path;
  await requireNewTarget(service,target);await service.rename(path,target);return target;
}
