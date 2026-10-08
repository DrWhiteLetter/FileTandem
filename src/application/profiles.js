import { validateProfile } from '../domain/profile.js';
const key='filetandem.profiles.v1';
export class Profiles {
  #queue=Promise.resolve();
  constructor(storage) { this.storage=storage; }
  list() {
    const state=this.storage.get(key,{version:1,profiles:[]});
    if (state?.version !== 1 || !Array.isArray(state.profiles)) throw new Error('Gespeicherte Profile haben eine unbekannte Version.');
    const profiles=state.profiles.map(validateProfile);
    if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error('Doppelte Profil-ID im Speicher.');
    return profiles;
  }
  get(id) { const profile=this.list().find(p => p.id === id); if (!profile) throw new Error('Profil wurde nicht gefunden.'); return profile; }
  #change(update) {
    const pending=this.#queue.then(async () => { const profiles=update(this.list()); await this.storage.update(key,{version:1,profiles}); return profiles; });
    this.#queue=pending.catch(() => {}); return pending;
  }
  save(raw) { const profile=validateProfile(raw); return this.#change(values => [...values.filter(p => p.id !== profile.id),profile]); }
  delete(id) { return this.#change(values => values.filter(p => p.id !== id)); }
  export() { return JSON.stringify({version:1,profiles:this.list()},null,2); }
}
