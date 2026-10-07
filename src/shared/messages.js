export const SCENARIOS = ['ready', 'loading', 'empty', 'error', 'disconnected'];
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const token = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value);
/** @typedef {{version:1,type:'ready'|'refresh'|'setScenario',id:string,sessionId:string,scenario?:string}} ManagerRequest */
export function validateRequest(value, sessionId) {
  if (!plain(value) || value.version !== 1 || !token(value.id) || value.sessionId !== sessionId || !token(sessionId)) return false;
  const keys = ['version','type','id','sessionId'];
  if (value.type === 'setScenario') { keys.push('scenario'); if (!SCENARIOS.includes(value.scenario)) return false; }
  else if (!['ready','refresh'].includes(value.type)) return false;
  return Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
}
export function validateResponse(value, sessionId) {
  return plain(value) && value.version === 1 && value.type === 'model' && token(value.id) && value.sessionId === sessionId
    && plain(value.location) && typeof value.location.local === 'boolean' && typeof value.location.remoteWindow === 'boolean'
    && SCENARIOS.includes(value.scenario);
}
