import { lstat,readdir,realpath } from 'node:fs/promises';
import { join,posix,resolve } from 'node:path';

/** Poll the actual local disk, including writes made outside VS Code. Never follow links. */
export async function scanUploadSource(root) {
  if (await realpath(root)!==resolve(root)) throw new Error('Überwachter Ordner wurde umgeleitet.');
  const result=new Map();let count=0;
  const visit=async (path,relative,depth) => {
    if (++count>10000 || depth>100) throw new Error('Überwachung überschreitet 10.000 Einträge/Tiefe 100.');
    let info;try {info=await lstat(path);} catch(error) {if (relative && error.code==='ENOENT') return;throw error;}
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) return;
    const kind=info.isDirectory() ? 'directory':'file';
    result.set(relative,{path,kind,stamp:JSON.stringify([kind,info.size,info.mtimeMs,info.ctimeMs,info.ino,info.dev])});
    let names=[];if (kind==='directory') {try {names=await readdir(path);} catch(error) {if (relative && error.code==='ENOENT') {result.delete(relative);return;}throw error;}}
    for (const name of names) {
      if (/[\\/\0]/.test(name) || ['.','..'].includes(name)) throw new Error('Ungültiger Name in der Überwachung.');
      await visit(join(path,name),relative ? relative+'/'+name:name,depth+1);
    }
  };
  await visit(root,'',0);
  if (result.get('')?.kind!=='directory') throw new Error('Überwachungsquelle ist kein regulärer Ordner.');
  return result;
}

/** Two matching observations debounce saves; uploads are serialized and coalesced. */
export class AutoUpload {
  constructor({localRoot,remoteRoot,scan=scanUploadSource,upload,remove,mkdir,validate=() => {},onChange=() => {},onStop=() => {},interval=1000}) {
    Object.assign(this,{localRoot,remoteRoot,scan,upload,remove,mkdir,validate,onChange,onStop,interval});
    this.state={active:false,starting:true,localRoot,remoteRoot,uploaded:0,deleted:0,directories:0,error:''};this.stopped=false;
  }
  async start({schedule=true,baseline}={}) {
    try {this.validate();this.baseline=baseline ?? await this.scan(this.localRoot);this.validate();if (this.stopped) return;
      this.previous=new Map(this.baseline);this.state={...this.state,starting:false,active:true};this.onChange();if (schedule) this.schedule();
    } catch(error) {this.stop(error.message);throw error;}
  }
  schedule() {if (!this.stopped) this.timer=setTimeout(async () => {await this.tick();this.schedule();},this.interval);}
  async tick() {
    if (this.stopped || this.running) return;this.running=true;
    try {
      this.validate();const current=await this.scan(this.localRoot);this.validate();
      if (this.stopped) return;
      // A missing file must stay absent for two observations, just like stable saves.
      for (const [relative,node] of [...this.baseline].sort((a,b) => b[0].split('/').length-a[0].split('/').length)) {
        if (!relative || current.has(relative) || this.previous.has(relative)) continue;
        if (node.kind==='file' || (node.kind==='directory' && this.mkdir)) {
          this.validate();if (this.stopped) return;
          await this.remove(node.path,posix.join(this.remoteRoot,...relative.split('/')),relative,node.kind);
          if (this.stopped) return;
          this.state.deleted++;this.onChange();
        }
        this.baseline.delete(relative);
      }
      for (const [relative,node] of current) {
        if (!relative || this.baseline.get(relative)?.stamp===node.stamp || this.previous.get(relative)?.stamp!==node.stamp) continue;
        if (node.kind==='directory') {
          if (this.mkdir) {this.validate();if (this.stopped) return;await this.mkdir(node.path,posix.join(this.remoteRoot,...relative.split('/')));}
          this.baseline.set(relative,node);this.state.directories++;this.onChange();continue;
        }
        if (node.kind!=='file') continue;
        this.validate();if (this.stopped) return;
        await this.upload(node.path,posix.join(this.remoteRoot,...relative.split('/')),relative);
        if (this.stopped) return;
        this.baseline.set(relative,node);this.state.uploaded++;this.onChange();
      }
      this.previous=current;
    } catch(error) {this.stop(error.message);}
    finally {this.running=false;}
  }
  stop(error='') {
    if (this.stopped) return;this.stopped=true;clearTimeout(this.timer);
    this.state={...this.state,active:false,starting:false,error};this.onStop();this.onChange();
  }
}
