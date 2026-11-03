import {RemoteFiles} from './files.js';

/** Exclusive channels, reused only within the same verified SSH transport. */
export class TransferChannels {
  constructor({open=(session,options)=>RemoteFiles.open(session,options),idleMs=30000}={}) {
    this.open=open;this.idleMs=idleMs;this.sessions=new WeakMap();this.entries=new Set();this.disposed=false;
  }
  discard(entry) {
    clearTimeout(entry.timer);entry.idle=false;this.entries.delete(entry);
    entry.files.close();
  }
  async acquire(session,signal) {
    signal?.throwIfAborted();if(this.disposed) throw new Error('Transfer channels disposed.');
    let group=this.sessions.get(session);
    if(!group) {group=new Set();this.sessions.set(session,group);session.closed.then(()=>{for(const entry of group) this.discard(entry);group.clear();});}
    let entry;
    for(const candidate of group) {
      if(!this.entries.has(candidate) || candidate.files.closed) {group.delete(candidate);if(this.entries.has(candidate)) this.discard(candidate);continue;}
      if(candidate.idle) {entry=candidate;break;}
    }
    if(entry) {clearTimeout(entry.timer);entry.idle=false;}
    else {
      const files=await this.open(session,{signal});
      if(this.disposed || signal?.aborted || files.closed) {files.close();signal?.throwIfAborted();throw new Error('Transfer channel closed.');}
      entry={files,idle:false};group.add(entry);this.entries.add(entry);
    }
    let released=false;
    return {files:entry.files,release:(healthy=true)=>{
      if(released) return;released=true;
      if(!healthy || this.disposed || entry.files.closed || signal?.aborted || !this.entries.has(entry)) {group.delete(entry);this.discard(entry);return;}
      entry.idle=true;entry.timer=setTimeout(()=>{group.delete(entry);this.discard(entry);},this.idleMs);entry.timer.unref?.();
    }};
  }
  dispose() {this.disposed=true;for(const entry of this.entries) this.discard(entry);}
}
