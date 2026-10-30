import {filePolicy} from './file-policy.js';
import {backupRemoteEntry} from './remote-backup.js';
import { serverIdentity } from '../adapters/ssh/host-keys.js';
import { realpath,lstat } from 'node:fs/promises';
import { relative,isAbsolute,posix,resolve } from 'node:path';
import { AutoUpload,scanUploadSource } from './auto-upload.js';
import { localTarget } from '../adapters/local/transfer-target.js';
import { LocalFiles } from '../adapters/local/files.js';
import { openRemoteFiles,targetFor } from './remote-files.js';
import { profileIdentity } from './transfer-resume.js';
import { targetSnapshot,snapshotEqual } from './transfer-file.js';

/** Owns ephemeral permissions; no monitoring mode resumes after a restart. */
export class AutoUploadService {
  constructor({engine,sessions,profiles,guard,onChange=() => {},openFiles=openRemoteFiles,remoteTarget=targetFor,getPolicy=()=>filePolicy()}) {Object.assign(this,{engine,sessions,profiles,guard,onChange,openFiles,remoteTarget,getPolicy});this.monitors=new Map();}
  state(profileId) {return this.monitors.get(profileId)?.state ?? {active:false,starting:false,error:''};}
  stop(profileId,owner,error='') {const monitor=this.monitors.get(profileId);if (monitor && (!owner || monitor.owner===owner)) monitor.stop(error);}
  validate() {for (const monitor of this.monitors.values()) if (!monitor.stopped) {try {monitor.validate();} catch(error) {monitor.stop(error.message);}}}
  async start({profileId,localRoot,remoteRoot,owner,allowed=() => {}}) {
    await this.engine.ready;this.guard();
    const prior=this.monitors.get(profileId);if (prior && !prior.stopped) throw new Error('Automatischer Upload ist für dieses Profil bereits aktiv.');
    const profile=this.profiles.get(profileId),identity=profileIdentity(profile),transport=this.sessions.transport(profileId);
    const policy=this.getPolicy();
    if(policy.excludes(localRoot,'directory') || policy.excludes(remoteRoot,'directory')) throw new Error('Selected folder is excluded by FileTandem settings.');
    const requestedLocalRoot=localRoot;localRoot=await realpath(localRoot);remoteRoot=posix.normalize(remoteRoot);
    if(policy.excludes(localRoot,'directory') || policy.excludes(remoteRoot,'directory')) throw new Error('Selected folder is excluded by FileTandem settings.');
    if (!remoteRoot.startsWith('/') || remoteRoot==='/' || remoteRoot.includes('\0')) throw new Error('Für die Spiegelung einen Remote-Unterordner auswählen.');
    const local=new LocalFiles();let remote;
    const permission={expected:new Map(),validate:() => {
      this.guard();allowed();
      if(this.getPolicy().signature!==policy.signature) throw new Error('FileTandem file options changed; monitoring stopped.');
      if (monitor.stopped || this.sessions.snapshot(profileId).state!=='connected' || this.sessions.transport(profileId)!==transport || !this.sessions.matches(profile) || profileIdentity(this.profiles.get(profileId))!==identity) throw new Error('Verbindung oder Profil wurde geändert; Überwachung beendet.');
    }};
    const ensureParents=async (target,create=false) => {
      if (!target.startsWith(remoteRoot==='/' ? '/':remoteRoot+'/')) throw new Error('Uploadziel liegt außerhalb des überwachten Ordners.');
      const parts=posix.dirname(target).split('/').filter(Boolean);let parent='/';
      for (const part of parts) {
        permission.validate();parent=posix.join(parent,part);
        let info=await targetSnapshot(remote,parent);
        if (!info && create && (parent===remoteRoot || parent.startsWith(remoteRoot+'/') || remoteRoot==='/')) {
          await remote.mkdir(parent);info=await remote.stat(parent);
        }
        if (info?.kind!=='directory') throw new Error('Remote-Elternordner fehlt oder ist ein Symlink; Überwachung beendet.');
      }
    };
    permission.check=async job => {
      permission.validate();
      if (await realpath(requestedLocalRoot)!==localRoot) throw new Error('Überwachter Ordner wurde umgeleitet.');
      const rel=relative(localRoot,job.source);
      if (!rel || rel==='..' || rel.startsWith('..'+(process.platform==='win32' ? '\\':'/')) || isAbsolute(rel) || await realpath(job.source)!==resolve(job.source)) throw new Error('Lokale Uploadquelle wurde umgeleitet.');
      if ((await local.stat({scheme:'file',fsPath:job.source})).kind!=='file') throw new Error('Uploadquelle ist keine reguläre Datei.');
      await ensureParents(job.target);
      permission.validate();
    };
    const scan=async () => {if (await realpath(requestedLocalRoot)!==localRoot) throw new Error('Überwachter Ordner wurde umgeleitet.');return scanUploadSource(localRoot,policy.excludes);};
    const waitReady=async () => {permission.validate();while (this.engine.queue.paused) {await new Promise(resolve => setTimeout(resolve,50));permission.validate();}};
    const remove=async (source,target,kind='file',replacement=false) => {
      await waitReady();
      return await this.engine.queue.maintain(this.engine.key({direction:'upload',server:serverIdentity(profile.host,profile.port).id},target),async () => {
        const check=async () => {
          permission.validate();
          if (await realpath(requestedLocalRoot)!==localRoot) throw new Error('Überwachter Ordner wurde umgeleitet.');
          // Recreated files and replacements by links must never trigger a deletion.
          if (!replacement) {
            // Inspect every existing local parent as well: a missing child below a link is not a deletion.
            const rel=relative(localRoot,source);let path=localRoot;
            for (const part of rel.split(process.platform==='win32' ? '\\':'/')) {
              path=resolve(path,part);
              try {const info=await lstat(path);if (info.isSymbolicLink()) throw new Error('Lokaler Pfad wurde umgeleitet.');if (path===source) throw new Error('Lokaler Eintrag ist wieder vorhanden; Überwachung beendet.');}
              catch(error) {if (error.code==='ENOENT' || error.code==='ENOTDIR') break;throw error;}
            }
          }
          await ensureParents(target);permission.validate();
        };
        await check();
        const current=await targetSnapshot(remote,target),expected=permission.expected.get(target);
        if (!current) {permission.expected.delete(target);return;}
        if (!expected || current.kind!==kind || (kind!=='directory' && !snapshotEqual(expected.info,current)) || (expected.hash && await this.remoteTarget(remote).hash(target)!==expected.hash)) throw new Error('Remote-Datei wurde geändert; keine automatische Löschung.');
        await check();
        if (!snapshotEqual(current,await targetSnapshot(remote,target))) throw new Error('Remote-Datei wurde während der Löschprüfung geändert.');
        permission.validate();
        if(kind==='directory' && (await remote.listNoFollow(target)).entries.length) return {retained:true};
        if(kind!=='directory' && policy.backupRemoteDeletes) await backupRemoteEntry(remote,target,()=>{permission.validate();return true;},current);
        else await remote.call(kind==='directory' ? 'rmdir':'unlink',target);
        permission.expected.delete(target);return {retained:false};
      });
    };
    const mkdir=async (source,target) => {
      await waitReady();
      if (await realpath(source)!==resolve(source) || !(await lstat(source)).isDirectory()) throw new Error('Lokaler Ordner wurde geändert.');
      await ensureParents(posix.join(target,'.filetandem-check'),true);permission.validate();
      permission.expected.set(target,{info:await remote.stat(target)});this.onChange();
    };
    const monitor=new AutoUpload({localRoot,remoteRoot,scan,validate:permission.validate,onChange:this.onChange,remove:(source,target,_relative,kind) => remove(source,target,kind),mkdir,onStop:() => {this.engine.endAutoUpload(profileId,permission);remote?.close();},upload:async (source,target) => {
      permission.validate();await ensureParents(target,true);permission.validate();
      const {ids}=await this.engine.submit(profileId,'upload',[source],posix.dirname(target),{automatic:permission});
      let jobs;
      while (true) {
        permission.validate();jobs=this.engine.queue.list(profileId).filter(job => ids.includes(job.id));
        if (jobs.length===ids.length && jobs.every(job => !['queued','running'].includes(job.state))) break;
        await new Promise(resolve => setTimeout(resolve,50));
      }
      if (jobs.some(job => job.state!=='completed')) throw new Error('Automatischer Upload fehlgeschlagen oder abgebrochen. Details stehen in der Transferliste.');
      permission.expected.set(target,{info:await remote.stat(target),hash:jobs[0].sha256});
      for (const id of ids) this.engine.autoJobs.delete(id);
    }});
    monitor.owner=owner;this.engine.beginAutoUpload(profileId,permission);this.monitors.set(profileId,monitor);this.onChange();
    try {
      const baseline=await scan();permission.validate();
      remote=await this.openFiles(transport,profile.protocol);if (monitor.stopped) {remote.close();throw new Error('Überwachung wurde beendet.');}permission.validate();
      // Capture target metadata before the first local change; never follow links.
      let count=0;
      const read=async (path,depth=0) => {
        permission.validate();if (++count>10000 || depth>100) throw new Error('Remote-Ordner überschreitet 10.000 Einträge/Tiefe 100.');
        const info=await remote.stat(path);if(path!==remoteRoot && policy.excludes(path,info.kind)) return;permission.expected.set(path,{info,...(info.kind==='file' ? {hash:await this.remoteTarget(remote).hash(path)}:{})});
        if (info.kind==='directory') {
          const list=await remote.listNoFollow(path);
          for (const entry of list.entries) {
            if (!entry.name || ['.','..'].includes(entry.name) || /[\\/\0]/.test(entry.name)) throw new Error('Ungültiger Remote-Dateiname.');
            await read(posix.join(path,entry.name),depth+1);
          }
        }
      };
      await ensureParents(posix.join(remoteRoot,'.filetandem-check'));
      await read(remoteRoot);
      // Local is authoritative on activation. Remove extras and type conflicts in postorder.
      const remoteEntries=[...permission.expected].filter(([path]) => path!==remoteRoot).sort((a,b) => b[0].split('/').length-a[0].split('/').length);
      const conflicts=[...baseline].filter(([rel,node]) => rel && permission.expected.has(posix.join(remoteRoot,rel)) && permission.expected.get(posix.join(remoteRoot,rel)).info.kind!==node.kind).map(([rel]) => rel);
      for(const rel of conflicts) {
        const target=posix.join(remoteRoot,rel),info=permission.expected.get(target).info;
        if(info.kind==='directory') {
          if(policy.backupRemoteDeletes) throw new Error('A folder/file type conflict requires manual resolution when deletion backups are enabled.');
          let inspected=0;const inspect=async (path,depth=0)=>{if(++inspected>10000 || depth>100) throw new Error('Remote-Ordner überschreitet 10.000 Einträge/Tiefe 100.');for(const entry of (await remote.listNoFollow(path)).entries) {const item=await remote.stat(entry.path);if(policy.excludes(entry.path,item.kind)) throw new Error('A type conflict contains excluded entries; resolve it manually.');if(item.kind==='directory') await inspect(entry.path,depth+1);}};
          await inspect(target);
        }
      }
      for (const [target,expected] of remoteEntries) {
        const rel=posix.relative(remoteRoot,target),node=baseline.get(rel),conflict=conflicts.some(path => rel===path || rel.startsWith(path+'/'));
        if (node && !conflict) continue;
        if (conflict) {
          const root=conflicts.find(path => rel===path || rel.startsWith(path+'/')),node=baseline.get(root),info=await lstat(node.path);
          if (await realpath(node.path)!==resolve(node.path) || (node.kind==='directory' ? !info.isDirectory():!info.isFile())) throw new Error('Lokaler Eintrag wurde während des Startabgleichs geändert.');
        }
        const result=await remove(resolve(localRoot,...rel.split('/')),target,expected.info.kind,conflict);
        if(!result?.retained) monitor.state.deleted++;this.onChange();
      }
      for (const [rel,node] of baseline) {
        if (!rel) continue;
        const target=posix.join(remoteRoot,...rel.split('/'));
        if (node.kind==='directory') {await mkdir(node.path,target);monitor.state.directories++;this.onChange();}
        else {
          permission.validate();const expected=permission.expected.get(target);
          if (expected?.info.kind==='file' && expected.hash===await localTarget.hash(node.path)) continue;
          await monitor.upload(node.path,target,rel);monitor.state.uploaded++;this.onChange();
        }
      }
      await monitor.start({baseline});return monitor;
    } catch(error) {if (monitor.stopped && !monitor.state.error) return monitor;monitor.stop(error.message);throw error;}
  }
  dispose() {for (const monitor of this.monitors.values()) monitor.stop();}
}
