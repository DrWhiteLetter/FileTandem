import { DEMO_FOLDERS, DEMO_ROOTS } from '../domain/demo-files.js';
const sides = ['local','remote'];
const columns = ['name','size','modified'];
export function defaultViewState() {
  return {version:1,paths:{...DEMO_ROOTS},sorts:{local:{column:'name',direction:'asc'},remote:{column:'name',direction:'asc'}},split:50,queueOpen:true,hidden:false};
}
// Project only bounded UI values. Credentials and connection settings never survive.
export function restoreViewState(raw) {
  const result = defaultViewState();
  if (!raw || raw.version !== 1 || typeof raw !== 'object') return result;
  for (const side of sides) {
    if (typeof raw.paths?.[side] === 'string' && Object.hasOwn(DEMO_FOLDERS[side],raw.paths[side])) result.paths[side] = raw.paths[side];
    const sort = raw.sorts?.[side];
    if (columns.includes(sort?.column) && ['asc','desc'].includes(sort?.direction)) result.sorts[side] = {column:sort.column,direction:sort.direction};
  }
  if (Number.isFinite(raw.split) && raw.split >= 30 && raw.split <= 70) result.split = raw.split;
  if (typeof raw.queueOpen === 'boolean') result.queueOpen = raw.queueOpen;
  if (typeof raw.hidden === 'boolean') result.hidden = raw.hidden;
  return result;
}
export const restoredSessionId = raw => typeof raw?.sessionId === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(raw.sessionId) ? raw.sessionId : undefined;
