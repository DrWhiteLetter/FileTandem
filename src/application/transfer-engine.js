import { randomUUID } from 'node:crypto';import { join,posix,resolve } from 'node:path';
import { LocalFiles,localPath } from '../adapters/local/files.js';import { RemoteFiles,remotePath } from '../adapters/sftp/files.js';
import { localTarget } from '../adapters/local/transfer-target.js';import { remoteTarget } from '../adapters/sftp/transfer-target.js';
import { TransferQueue } from './transfer-queue.js';import { discoverTree } from './transfer-tree.js';import { ConflictRules } from './transfer-conflicts.js';import { transferFile,targetSnapshot } from './transfer-file.js';
import { serverIdentity } from '../adapters/ssh/host-keys.js';
export class TransferEngine {
  constructor({sessions,profiles,choose,guard=() => {},onChange=() => {}}) {
    this.sessions=sessions;this.profiles=profiles;this.guard=guard;this.local=new LocalFiles();this.conflicts=new ConflictRules(choose);
    this.queue=new TransferQueue({run:(j,s,p) => this.run(j,s,p),onChange});
  }
  key(job,path) {if (job.direction === 'upload') return 'remote:'+job.server+':'+posix.normalize(path);const local=resolve(path).replaceAll('\\','/');return 'local:'+(process.platform === 'win32' ? local.toLowerCase():local);}
  async submit(profileId,direction,paths,destination) {
    this.guard();if (!['upload','download'].includes(direction) || !Array.isArray(paths) || !paths.length || paths.length > 1000) throw new Error('Ungültige Transferauswahl.');
    paths=paths.map(direction === 'upload' ? localPath:remotePath);destination=(direction === 'upload' ? remotePath:localPath)(destination);
    const profile=this.profiles.get(profileId);if (profile.protocol !== 'sftp') throw new Error('Transfers sind in M3 nur über SFTP verfügbar.');
    const server=serverIdentity(profile.host,profile.port).id;const transport=this.sessions.transport(profileId);if (transport.endpoint?.id && transport.endpoint.id !== server) throw new Error('Profil wurde geändert; bitte erneut verbinden.');const files=await RemoteFiles.open(transport);const batchId=randomUUID(),ids=[];
    const source=direction === 'upload' ? {stat:path => this.local.stat({scheme:'file',fsPath:path}),listNoFollow:path => this.local.listNoFollow(path)}:files;
    const targetJoin=direction === 'upload' ? posix.join:join;const sourceBase=direction === 'upload' ? p => p.replaceAll('\\','/').split('/').at(-1):posix.basename;
    try {for (const path of paths) {
      const parents=new Map();const root=targetJoin(destination,sourceBase(path));
      try {for await (const node of discoverTree(source,path)) {
        const id=randomUUID(),target=node.relative ? targetJoin(root,...node.relative.split('/')):root;
        const parent=node.relative ? parents.get(posix.dirname(node.relative) === '.' ? '':posix.dirname(node.relative)):undefined;
        const job={id,batchId,profileId,server,direction,source:node.source,target,kind:node.kind,metadata:node.metadata,parentId:parent,name:node.relative ? posix.basename(node.relative):sourceBase(path)};
        job.lockKey=this.key(job,target);this.queue.add(job);ids.push(id);if (node.kind === 'directory') parents.set(node.relative,id);
      }} catch {const job={id:randomUUID(),batchId,profileId,server,direction,source:path,target:root,kind:'error'};job.lockKey=this.key(job,root);this.queue.add(job);ids.push(job.id);}
    }} finally {files.close();}return {batchId,ids};
  }
  async run(job,signal,onProgress) {
    this.guard();signal.throwIfAborted();if (job.kind === 'error') throw Object.assign(new Error(),{publicMessage:'Transferbaum konnte nicht vollständig entdeckt werden.'});
    if (['symlink','other'].includes(job.kind)) return {skipped:true,reason:'Symlink/Spezialdatei übersprungen.'};
    const session=this.sessions.transport(job.profileId);const files=await RemoteFiles.open(session);
    try {
      const target=job.direction === 'upload' ? remoteTarget(files):localTarget;
      const parent=job.parentId && this.queue.list().find(j => j.id === job.parentId);
      const initial=parent?.finalTarget ? (job.direction === 'upload' ? posix.join:join)(parent.finalTarget,job.name):job.target;
      let path=initial,replace=false;
      if (!(job.kind === 'directory' && (await targetSnapshot(target,path))?.kind === 'directory')) {
        const decision=await this.conflicts.resolve({...job,target:path},target,signal);if (decision.skipped) return decision;path=decision.path;replace=decision.replace;
      }
      return await this.queue.withLock(job.id,this.key(job,path),async () => {
        this.guard();signal.throwIfAborted();
        if (job.kind === 'directory') {const existing=await targetSnapshot(target,path);if (!existing) await (job.direction === 'upload' ? files.mkdir(path):this.local.mkdir(path));else if (existing.kind !== 'directory') throw new Error('Ordnerziel ist keine directory.');return {bytes:0,committed:true,finalTarget:path};}
        const result=await transferFile(session,{...job,target:path},{target,replace,signal,onProgress});return {...result,finalTarget:path};
      },signal);
    } finally {files.close();}
  }
  dispose() {this.queue.dispose();}
}
