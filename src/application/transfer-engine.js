import { profileIdentity } from './transfer-resume.js';
import { openRemoteFiles,targetFor,streamFor,pathFor } from './remote-files.js';
import { randomUUID } from 'node:crypto';import { join,posix,resolve } from 'node:path';
import { LocalFiles,localPath } from '../adapters/local/files.js';
import { localTarget } from '../adapters/local/transfer-target.js';
import { TransferQueue } from './transfer-queue.js';import { discoverTree } from './transfer-tree.js';import { ConflictRules } from './transfer-conflicts.js';import { transferFile,targetSnapshot } from './transfer-file.js';
import { serverIdentity } from '../adapters/ssh/host-keys.js';
export class TransferEngine {
  constructor({sessions,profiles,choose,guard=() => {},onChange=() => {}}) {
    this.ready=Promise.resolve();this.sessions=sessions;this.profiles=profiles;this.guard=guard;this.local=new LocalFiles();this.conflicts=new ConflictRules(choose);
    this.queue=new TransferQueue({run:(j,s,p) => this.run(j,s,p),onChange});
  }
  key(job,path) {if (job.direction === 'upload') return 'remote:'+job.server+':'+posix.normalize(path);const local=resolve(path).replaceAll('\\','/');return 'local:'+(process.platform === 'win32' ? local.toLowerCase():local);}
  async submit(profileId,direction,paths,destination) {
    await this.ready;this.guard();if (!['upload','download'].includes(direction) || !Array.isArray(paths) || !paths.length || paths.length > 1000) throw new Error('Ungültige Transferauswahl.');
    const profile=this.profiles.get(profileId);
    paths=paths.map(direction === 'upload' ? localPath:p => pathFor(p,profile.protocol));destination=direction === 'upload' ? pathFor(destination,profile.protocol):localPath(destination);
    if (this.sessions.matches && !this.sessions.matches(profile)) throw new Error('Profil wurde geändert; bitte erneut verbinden.');
    const server=serverIdentity(profile.host,profile.port).id;const transport=this.sessions.transport(profileId);if (transport.endpoint?.id && transport.endpoint.id !== server) throw new Error('Profil wurde geändert; bitte erneut verbinden.');const files=await openRemoteFiles(transport,profile.protocol);const batchId=randomUUID(),ids=[];
    const source=direction === 'upload' ? {stat:path => this.local.stat({scheme:'file',fsPath:path}),listNoFollow:path => this.local.listNoFollow(path)}:files;
    const targetJoin=direction === 'upload' ? posix.join:join;const sourceBase=direction === 'upload' ? p => p.replaceAll('\\','/').split('/').at(-1):posix.basename;
    try {for (const path of paths) {
      const parents=new Map();const root=targetJoin(destination,sourceBase(path));
      try {for await (const node of discoverTree(source,path)) {
        const id=randomUUID(),target=node.relative ? targetJoin(root,...node.relative.split('/')):root;
        if (profile.protocol === 'scp') pathFor(direction === 'upload' ? target:node.source,profile.protocol);
        const parent=node.relative ? parents.get(posix.dirname(node.relative) === '.' ? '':posix.dirname(node.relative)):undefined;
        const job={id,batchId,profileId,server,direction,source:node.source,target,kind:node.kind,metadata:node.metadata,profileKey:profileIdentity(profile),protocol:profile.protocol,parentId:parent,name:node.relative ? posix.basename(node.relative):sourceBase(path)};
        job.lockKey=this.key(job,target);this.queue.add(job);ids.push(id);if (node.kind === 'directory') parents.set(node.relative,id);
      }} catch {const job={id:randomUUID(),batchId,profileId,server,direction,source:path,target:root,kind:'error'};job.lockKey=this.key(job,root);this.queue.add(job);ids.push(job.id);}
    }} finally {files.close();}return {batchId,ids};
  }
  async run(job,signal,onProgress) {
    this.guard();signal.throwIfAborted();if (job.kind === 'error') throw Object.assign(new Error(),{publicMessage:'Transferbaum konnte nicht vollständig entdeckt werden.'});
    if (['symlink','other'].includes(job.kind)) return {skipped:true,reason:'Symlink/Spezialdatei übersprungen.'};
    const profile=this.profiles.get(job.profileId);if ((job.profileKey && job.profileKey!==profileIdentity(profile)) || ((job.protocol ?? 'sftp') !== profile.protocol) || serverIdentity(profile.host,profile.port).id !== job.server) throw Object.assign(new Error(),{publicMessage:'Profilziel wurde geändert; neuen Auftrag anlegen.'});
    if (this.sessions.matches && !this.sessions.matches(profile)) throw new Error('Profil wurde geändert; bitte erneut verbinden.');
    const session=this.sessions.transport(job.profileId);if (session.endpoint?.id && session.endpoint.id !== job.server) throw new Error('Verbindung gehört zu einem anderen Server.');const files=await openRemoteFiles(session,profile.protocol,{signal});
    try {
      const target=job.direction === 'upload' ? targetFor(files):localTarget;
      const parent=job.parentId && this.queue.list().find(j => j.id === job.parentId);
      const initial=job.resumeFrom ? job.attempt.target:parent?.finalTarget ? (job.direction === 'upload' ? posix.join:join)(parent.finalTarget,job.name):job.target;
      let path=initial,replace=false;
      if (!job.resumeFrom && !(job.kind === 'directory' && (await targetSnapshot(target,path))?.kind === 'directory')) {
        const decision=await this.conflicts.resolve({...job,target:path},target,signal);if (decision.skipped) return decision;path=decision.path;replace=decision.replace;
      }
      return await this.queue.withLock(job.id,this.key(job,path),async () => {
        this.guard();signal.throwIfAborted();
        if (job.kind === 'directory') {const existing=await targetSnapshot(target,path);if (!existing) await (job.direction === 'upload' ? files.mkdir(path):this.local.mkdir(path));else if (existing.kind !== 'directory') throw new Error('Ordnerziel ist keine directory.');return {bytes:0,committed:true,finalTarget:path};}
        const source=job.direction==='upload' ? localTarget:targetFor(files);
        const current=await source.stat(job.source);const metadata={mode:current.mode&0o777,modified:current.modified};
        const result=await transferFile(session,{...job,target:path,metadata},{target,source,identity:profileIdentity(profile),replace,signal,onProgress,stream:streamFor(profile.protocol),onCheckpoint:attempt => this.queue.checkpoint(job.id,attempt,this.key(job,attempt.target))});return {...result,finalTarget:path};
      },signal);
    } finally {files.close();}
  }
  async cleanup(id) {
    await this.ready;this.guard();const job=this.queue.list().find(j => j.id===id),a=job?.attempt;
    if (!job || !['failed','cancelled','interrupted','completed'].includes(job.state) || !a) throw new Error('Kein bereinigbarer eigener Teil-Auftrag.');
    const profile=this.profiles.get(job.profileId);if (a.identity!==profileIdentity(profile) || a.source!==job.source || a.target!==job.target || a.protocol!==profile.protocol) throw new Error('Profil/Teil-Auftrag wurde geändert; keine automatische Bereinigung.');
    return this.queue.maintain(this.key(job,a.target),async () => {
      this.guard();let files;try {
        if (job.direction==='upload') {const session=this.sessions.transport(job.profileId);if (session.endpoint?.id && session.endpoint.id!==job.server) throw new Error('Falsche Serververbindung.');files=await openRemoteFiles(session,profile.protocol);}
        const target=files ? targetFor(files):localTarget;
        if (!/^[a-zA-Z0-9-]{1,64}$/.test(a.id) || a.part!==target.partial(a.target,a.id)) throw new Error('Fremder Teil-Datei-Pfad wird nicht bereinigt.');
        const current=await targetSnapshot(target,a.part);if (current && (current.kind!=='file' || current.size>a.sourceInfo.size)) throw new Error('Teil-Datei wurde ersetzt; keine Bereinigung.');
        if (current) await target.remove(a.part);this.queue.clearPartial(a.part);return {removed:!!current};
      } finally {files?.close();}
    });
  }
  resume(ids) {this.guard();return this.queue.retry(ids,randomUUID,{resume:true});}
  dispose() {this.queue.dispose();}
}
