import {TransferChannels} from '../adapters/sftp/transfer-channels.js';
import {streamFile} from '../adapters/sftp/pipeline.js';
import {LOCAL_PROFILE_ID,localCopyPlan,copyLocalFile} from './local-transfer.js';
import {filePolicy} from './file-policy.js';
import { profileIdentity } from './transfer-resume.js';
import { openRemoteFiles,targetFor,streamFor,pathFor } from './remote-files.js';
import { randomUUID } from 'node:crypto';import { join,posix,resolve } from 'node:path';
import { LocalFiles,localPath } from '../adapters/local/files.js';
import { localTarget } from '../adapters/local/transfer-target.js';
import { TransferQueue } from './transfer-queue.js';import { discoverTree } from './transfer-tree.js';import { ConflictRules } from './transfer-conflicts.js';import { transferFile,targetSnapshot } from './transfer-file.js';
import { serverIdentity } from '../adapters/ssh/host-keys.js';
export class TransferEngine {
  constructor({sessions,profiles,choose,guard=() => {},onChange=() => {},notifyInterval=0,getPolicy=()=>filePolicy()}) {
    this.getPolicy=getPolicy;this.autoUploads=new Map();this.autoJobs=new Map();this.ready=Promise.resolve();this.sessions=sessions;this.profiles=profiles;this.guard=guard;this.local=new LocalFiles();this.conflicts=new ConflictRules(choose);
    this.channels=new TransferChannels();
    this.queue=new TransferQueue({limit:job=>job.protocol==='sftp' ? 4:2,notifyInterval,run:(j,s,p) => this.run(j,s,p),onChange});
  }
  key(job,path) {if (job.direction === 'upload') return 'remote:'+job.server+':'+posix.normalize(path);const local=resolve(path).replaceAll('\\','/');return 'local:'+(process.platform === 'win32' ? local.toLowerCase():local);}
  assertManual(profileId) {if (this.autoUploads.has(profileId)) throw new Error('Automatischer Upload aktiv; zuerst die Überwachung stoppen.');}
  beginAutoUpload(profileId,permission) {
    this.guard();this.assertManual(profileId);
    if (this.queue.list(profileId).some(job => ['queued','running'].includes(job.state))) throw new Error('Bitte laufende Transfers zuerst abschließen oder abbrechen.');
    this.autoUploads.set(profileId,permission);
  }
  endAutoUpload(profileId,permission) {
    if (this.autoUploads.get(profileId)!==permission) return;
    this.autoUploads.delete(profileId);
    for (const [id,owner] of this.autoJobs) if (owner===permission) {const job=this.queue.list(profileId).find(job => job.id===id);if (job && ['queued','running'].includes(job.state)) this.queue.cancel(id);this.autoJobs.delete(id);}
  }
  async submit(profileId,direction,paths,destination,{reviewedReplacement,automatic}={}) {
    if (reviewedReplacement!==undefined && (direction!=='upload' || paths?.length!==1 || !/^[a-f0-9]{64}$/.test(reviewedReplacement))) throw new Error('Ungültige geprüfte Ersetzung.');
    await this.ready;this.guard();if (!['upload','download'].includes(direction) || !Array.isArray(paths) || !paths.length || paths.length > 1000) throw new Error('Ungültige Transferauswahl.');
    const authorized=() => {
      if (!automatic) this.assertManual(profileId);
      else {if (direction!=='upload' || this.autoUploads.get(profileId)!==automatic) throw new Error('Überwachung wurde beendet.');automatic.validate();}
    };authorized();
    const profile=this.profiles.get(profileId);
    paths=paths.map(direction === 'upload' ? localPath:p => pathFor(p,profile.protocol));destination=direction === 'upload' ? pathFor(destination,profile.protocol):localPath(destination);
    if (this.sessions.matches && !this.sessions.matches(profile)) throw new Error('Profil wurde geändert; bitte erneut verbinden.');
    const server=serverIdentity(profile.host,profile.port).id;const transport=this.sessions.transport(profileId);if (transport.endpoint?.id && transport.endpoint.id !== server) throw new Error('Profil wurde geändert; bitte erneut verbinden.');const files=direction==='download' ? await openRemoteFiles(transport,profile.protocol):undefined;const batchId=randomUUID(),ids=[];
    const source=direction === 'upload' ? {stat:path => this.local.stat({scheme:'file',fsPath:path}),listNoFollow:path => this.local.listNoFollow(path)}:files;
    const targetJoin=direction === 'upload' ? posix.join:join;const sourceBase=direction === 'upload' ? p => p.replaceAll('\\','/').split('/').at(-1):posix.basename;
    try {
      const policy=this.getPolicy();
      if(policy.excludes(destination,'directory')) throw new Error('Selected destination is excluded by FileTandem settings.');
      for(const path of paths) {if(policy.excludes(path,(await source.stat(path)).kind)) throw new Error('Selected entry is excluded by FileTandem settings.');}
      for (const path of paths) {
      const parents=new Map();const root=targetJoin(destination,sourceBase(path));
      try {for await (const node of discoverTree(source,path,'',0,{count:0},policy.excludes)) {
        const id=randomUUID(),target=node.relative ? targetJoin(root,...node.relative.split('/')):root;
        if (profile.protocol === 'scp') pathFor(direction === 'upload' ? target:node.source,profile.protocol);
        const parent=node.relative ? parents.get(posix.dirname(node.relative) === '.' ? '':posix.dirname(node.relative)):undefined;
        const job={id,batchId,profileId,server,direction,source:node.source,target,kind:node.kind,metadata:node.metadata,profileKey:profileIdentity(profile),protocol:profile.protocol,...(reviewedReplacement && node.kind==='file' && !node.relative ? {reviewedReplacement}:{}),parentId:parent,name:node.relative ? posix.basename(node.relative):sourceBase(path)};
        authorized();if (automatic) {job.automatic=true;this.autoJobs.set(job.id,automatic);}job.lockKey=this.key(job,target);this.queue.add(job);ids.push(id);if (node.kind === 'directory') parents.set(node.relative,id);
      }} catch(error) {if (automatic) throw error;authorized();const job={id:randomUUID(),batchId,profileId,server,direction,source:path,target:root,kind:'error'};job.lockKey=this.key(job,root);this.queue.add(job);ids.push(job.id);}
    }} finally {files?.close();}return {batchId,ids};
  }
  async submitLocal(direction,paths,destination) {
    await this.ready;this.guard();
    if (!['upload','download'].includes(direction)) throw new Error('Invalid transfer direction.');
    const policy=this.getPolicy(),plan=await localCopyPlan(paths,destination,policy),batchId=randomUUID(),ids=[],parents=new Map();
    this.guard();if (this.getPolicy().signature!==policy.signature) throw new Error('Exclusion rules changed; transfer stopped.');
    for (const node of plan) {
      const id=randomUUID(),parent=node.relative ? parents.get(node.root+':'+posix.dirname(node.relative)):undefined;
      const job={id,batchId,profileId:LOCAL_PROFILE_ID,server:'local',protocol:'local',direction,source:node.source,target:node.target,kind:node.kind,metadata:node.metadata,parentId:parent,name:node.relative ? posix.basename(node.relative):node.target.split(/[\\/]/).at(-1)};
      job.lockKey=this.key({...job,direction:'download'},job.target);this.queue.add(job);ids.push(id);
      if (node.kind==='directory') parents.set(node.root+':'+(node.relative || '.'),id);
    }
    return {batchId,ids};
  }
  async runLocal(job,signal,onProgress) {
    const validate=() => {this.guard();signal.throwIfAborted();if (this.getPolicy().excludes(job.source,job.kind) || this.getPolicy().excludes(job.target,job.kind)) throw new Error('Exclusion rules changed; transfer stopped.');};
    validate();if (['symlink','other'].includes(job.kind)) return {skipped:true,reason:'Symlink/Spezialdatei übersprungen.'};
    const parent=job.parentId && this.queue.get(job.parentId),initial=parent?.finalTarget ? join(parent.finalTarget,job.name):job.target;
    const existing=await targetSnapshot(localTarget,initial),source=await localTarget.stat(job.source);
    if (resolve(job.source)===resolve(initial) || existing && source.ino===existing.ino && source.dev===existing.dev) throw new Error('Cannot copy an entry onto itself or into its own folder.');
    const decision=job.kind==='directory' && existing?.kind==='directory' ? {path:initial,replace:false}:await this.conflicts.resolve({...job,direction:'local',target:initial},localTarget,signal);
    if (decision.skipped) return decision;
    return this.queue.withLock(job.id,this.key({...job,direction:'download'},decision.path),async () => {
      validate();
      if (job.kind==='directory') {const current=await targetSnapshot(localTarget,decision.path);if (!current) await this.local.mkdir(decision.path);else if (current.kind!=='directory') throw new Error('Destination is not a folder.');return {bytes:0,committed:true,finalTarget:decision.path};}
      const result=await copyLocalFile({...job,target:decision.path,metadata:{mode:source.mode&0o777,modified:source.modified}},{replace:decision.replace,signal,onProgress,beforePublish:validate});
      return {...result,finalTarget:decision.path};
    },signal);
  }
  async run(job,signal,onProgress) {
    if (job.protocol==='local') return this.runLocal(job,signal,onProgress);
    this.guard();signal.throwIfAborted();
    const isExcluded=()=>this.getPolicy().excludes(job.source,job.kind) || this.getPolicy().excludes(job.target,job.kind);
    if(isExcluded()) return {skipped:true,reason:'Excluded by FileTandem settings.'};
    const automatic=job.automatic && this.autoJobs.get(job.id);
    const validate=async () => {
      this.guard();signal.throwIfAborted();
      if(isExcluded()) throw new Error('Exclusion rules changed; transfer stopped.');
      if (job.automatic) {if (!automatic || this.autoUploads.get(job.profileId)!==automatic) throw new Error('Überwachung wurde beendet.');await automatic.check(job);}
      else this.assertManual(job.profileId);
      signal.throwIfAborted();
    };
    await validate();if (job.kind === 'error') throw Object.assign(new Error(),{publicMessage:'Transferbaum konnte nicht vollständig entdeckt werden.'});
    if (['symlink','other'].includes(job.kind)) return {skipped:true,reason:'Symlink/Spezialdatei übersprungen.'};
    const profile=this.profiles.get(job.profileId);if ((job.profileKey && job.profileKey!==profileIdentity(profile)) || ((job.protocol ?? 'sftp') !== profile.protocol) || serverIdentity(profile.host,profile.port).id !== job.server) throw Object.assign(new Error(),{publicMessage:'Profilziel wurde geändert; neuen Auftrag anlegen.'});
    if (this.sessions.matches && !this.sessions.matches(profile)) throw new Error('Profil wurde geändert; bitte erneut verbinden.');
    const session=this.sessions.transport(job.profileId);if (session.endpoint?.id && session.endpoint.id !== job.server) throw new Error('Verbindung gehört zu einem anderen Server.');const lease=profile.protocol==='sftp' ? await this.channels.acquire(session,signal):undefined;const files=lease?.files ?? await openRemoteFiles(session,profile.protocol,{signal});let healthy=false;const close=() => files.close();signal.addEventListener('abort',close,{once:true});if (signal.aborted) close();
    try {signal.throwIfAborted();
      const target=job.direction === 'upload' ? targetFor(files):localTarget;
      const parent=job.parentId && this.queue.get(job.parentId);
      const initial=job.resumeFrom ? job.attempt.target:parent?.finalTarget ? (job.direction === 'upload' ? posix.join:join)(parent.finalTarget,job.name):job.target;
      let path=initial,replace=false;
      if (!job.resumeFrom && !(job.kind === 'directory' && (await targetSnapshot(target,path))?.kind === 'directory')) {
        const decision=automatic || job.reviewedReplacement ? {path,replace:true}:await this.conflicts.resolve({...job,target:path},target,signal);if (decision.skipped) {healthy=true;return decision;}path=decision.path;replace=decision.replace;
      }
      const completed=await this.queue.withLock(job.id,this.key(job,path),async () => {
        await validate();
        if (job.kind === 'directory') {const existing=await targetSnapshot(target,path);if (!existing) await (job.direction === 'upload' ? files.mkdir(path):this.local.mkdir(path));else if (existing.kind !== 'directory') throw new Error('Ordnerziel ist keine directory.');return {bytes:0,committed:true,finalTarget:path};}
        const source=job.direction==='upload' ? localTarget:targetFor(files);
        const current=await source.stat(job.source);const metadata={mode:current.mode&0o777,modified:current.modified};
        const result=await transferFile(session,{...job,target:path,metadata,...(automatic ? {expectedTarget:automatic.expected.get(path)?.info ?? null,expectedTargetHash:automatic.expected.get(path)?.hash}: {})},{target,source,identity:profileIdentity(profile),replace,signal,onProgress,stream:profile.protocol==='sftp' ? (session,options)=>streamFile(session,{...options,files}):streamFor(profile.protocol),beforePublish:validate,onCheckpoint:attempt => this.queue.checkpoint(job.id,attempt,this.key(job,attempt.target))});return {...result,finalTarget:path};
      },signal);
      healthy=true;return completed;
    } finally {signal.removeEventListener('abort',close);if(lease) lease.release(healthy);else files.close();}
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
  resume(ids) {this.guard();for (const job of this.queue.validateRetry(ids,{resume:true})) this.assertManual(job.profileId);return this.queue.retry(ids,randomUUID,{resume:true});}
  dispose() {this.queue.dispose();this.channels.dispose();}
}
