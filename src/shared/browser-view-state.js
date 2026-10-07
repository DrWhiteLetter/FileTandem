export function browserViewState(raw) {
  const state={version:1,paths:{},split:50,panes:{}};
  if (raw?.version !== 1) raw={};
  if (typeof raw.profileId === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(raw.profileId)) state.profileId=raw.profileId;
  for (const side of ['local','remote']) {
    const value=raw.panes?.[side] ?? {};
    state.panes[side]={sort:{column:['name','size','modified','mode'].includes(value.sort?.column) ? value.sort.column:'name',direction:value.sort?.direction === 'desc' ? 'desc':'asc'},filter:typeof value.filter === 'string' ? value.filter.slice(0,256):'',hidden:typeof value.hidden === 'boolean' ? value.hidden:undefined,columns:{size:value.columns?.size !== false,modified:value.columns?.modified !== false,mode:value.columns?.mode === true},favorites:Array.isArray(value.favorites) ? value.favorites.filter(p => typeof p === 'string' && p.length <= 4096 && !p.includes('\0')).slice(0,50):[]};
    const path=raw.paths?.[side];if (typeof path === 'string' && path.length <= 4096 && !path.includes('\0')) state.paths[side]=path;
  }
  if (Number.isFinite(raw.split) && raw.split >= 30 && raw.split <= 70) state.split=raw.split;
  return state;
}
