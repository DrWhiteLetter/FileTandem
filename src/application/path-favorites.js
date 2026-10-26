const key='filetandem.pathFavorites.v1';
const paths=value => Array.isArray(value) ? [...new Set(value.filter(p => typeof p==='string' && p.length>0 && p.length<=4096 && !p.includes('\0')))].slice(-50):[];
export function pathFavorites(storage) {
  let pending=Promise.resolve();
  const scope=(side,profileId) => side==='local' ? 'local':`remote:${profileId ?? 'unconnected'}`;
  return {
    get(profileId) {const saved=storage.get(key) ?? {};return {local:paths(saved.local),remote:paths(saved[scope('remote',profileId)])};},
    set(side,profileId,path,favorite) {
      const save=pending.then(async () => {
        const saved={...storage.get(key)};const id=scope(side,profileId);const current=paths(saved[id]).filter(p => p!==path);
        saved[id]=favorite ? paths([...current,path]):current;
        await storage.update(key,saved);
      });
      pending=save.catch(() => {});return save;
    }
  };
}
