/** Live transports are backend-only; snapshots contain no reconnect credentials. */
export class SessionManager {
  #sessions=new Map();
  #disposed=false;
  constructor({connect,credentials,policy,onChange=() => {}}) {this.connector=connect;this.credentials=credentials;this.policy=policy;this.onChange=onChange;}
  snapshot(id) {const s=this.#sessions.get(id); return {id,state:s?.state ?? 'disconnected',protocol:s?.profile.protocol ?? 'sftp'};}
  #publish(id) {this.onChange(this.snapshot(id));}
  async connect(profile,{signal}={}) {
    if (this.#disposed) throw new Error('SessionManager ist beendet.');
    const previous=this.#sessions.get(profile.id); previous?.controller.abort();
    const record={profile:{id:profile.id,protocol:profile.protocol},controller:new AbortController(),state:'connecting',transport:undefined};
    this.#sessions.set(profile.id,record); this.#publish(profile.id);
    const abort=() => record.controller.abort(); signal?.addEventListener('abort',abort,{once:true}); if (signal?.aborted) abort();
    let credentials,transport;
    try {
      await previous?.transport?.close(); record.controller.signal.throwIfAborted();
      credentials=await this.credentials(profile,record.controller.signal); record.controller.signal.throwIfAborted();
      transport=await this.connector(credentials.config,{...this.policy,signal:record.controller.signal});
      record.controller.signal.throwIfAborted();
      if (this.#sessions.get(profile.id) !== record) throw new Error('Verbindungsversuch wurde ersetzt.');
      await credentials.commit(); record.controller.signal.throwIfAborted();
      record.transport=transport; record.state='connected'; this.#publish(profile.id);
      transport.closed.then(() => {if (this.#sessions.get(profile.id) === record) {record.state='disconnected'; record.transport=undefined; this.#publish(profile.id);}});
      return this.snapshot(profile.id);
    } catch(error) {
      await transport?.close();
      if (this.#sessions.get(profile.id) === record) {record.state=record.controller.signal.aborted ? 'disconnected':'error'; this.#publish(profile.id);}
      throw error;
    } finally {credentials?.dispose(); signal?.removeEventListener('abort',abort);}
  }
  transport(id) {const s=this.#sessions.get(id); if (s?.state !== 'connected' || !s.transport) throw Object.assign(new Error('Nicht verbunden.'),{code:'NOT_CONNECTED'}); return s.transport;}
  async disconnect(id) {const s=this.#sessions.get(id); if (!s) return; s.controller.abort(); s.state='disconnected'; const transport=s.transport; s.transport=undefined; this.#publish(id); await transport?.close();}
  dispose() {this.#disposed=true; for (const id of this.#sessions.keys()) void this.disconnect(id);}
}
