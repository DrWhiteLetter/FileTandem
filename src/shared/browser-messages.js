const plain=v => v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype,null].includes(Object.getPrototypeOf(v));
const token=v => typeof v === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(v);
export function browserRequest(value,sessionId) {
  if (!plain(value) || value.version !== 1 || !token(value.id) || value.sessionId !== sessionId || !token(sessionId)) return false;
  const keys=['version','type','id','sessionId'];
  if (['navigate','history','refresh'].includes(value.type)) {
    keys.push('side');if (!['local','remote'].includes(value.side)) return false;
    if (value.type === 'navigate') {keys.push('path');if (typeof value.path !== 'string' || !value.path || value.path.length > 4096 || value.path.includes('\0')) return false;}
    if (value.type === 'history') {keys.push('direction');if (!['back','forward','up'].includes(value.direction)) return false;}
  } else if (value.type === 'pathFavorite') {
    keys.push('side','path','favorite');if (!['local','remote'].includes(value.side) || typeof value.favorite!=='boolean' || typeof value.path!=='string' || !value.path || value.path.length>4096 || value.path.includes('\0')) return false;
  } else if (['action','transfer'].includes(value.type)) {
    keys.push('side','ids',value.type === 'action' ? 'action':'destination');if (value.type==='transfer' && Object.hasOwn(value,'destinationPath')) {keys.push('destinationPath');if (typeof value.destinationPath!=='string' || !value.destinationPath || value.destinationPath.length>4096 || value.destinationPath.includes('\0')) return false;}
    if (!['local','remote'].includes(value.side) || (value.type === 'action' ? !['mkdir','rename','delete','properties','chmod','open','edit','restoreBackup'].includes(value.action):(!['opposite','choose'].includes(value.destination) || (value.side === 'local' && value.destination === 'choose'))) || !Array.isArray(value.ids) || value.ids.length > 1000 || new Set(value.ids).size !== value.ids.length || value.ids.some(id => typeof id !== 'string' || id.length > 4096 || id.includes('\0'))) return false;
  } else if (value.type==='renderProof') {keys.push('rows','height','rowHeight','scrollHeight','theme','focusColor');if (!Number.isInteger(value.rows) || value.rows<0 || value.rows>10000 || ![value.height,value.rowHeight,value.scrollHeight].every(n => Number.isFinite(n) && n>=0 && n<=1000000) || !['vscode-light','vscode-dark','vscode-high-contrast','vscode-high-contrast-light'].includes(value.theme) || typeof value.focusColor!=='string' || value.focusColor.length>64) return false;
  } else if (value.type === 'queuePause') {keys.push('paused');if (typeof value.paused !== 'boolean') return false;}
  else if (value.type === 'queueAction') {keys.push('action','ids');if (!['cancel','retry','resume','cleanup'].includes(value.action) || (value.action==='cleanup' && value.ids?.length!==1) || !Array.isArray(value.ids) || !value.ids.length || value.ids.length > 1000 || value.ids.some(id => !token(id)) || new Set(value.ids).size !== value.ids.length) return false;}
  else if (!['autoUploadStart','autoUploadStop','synchronize','settings','ready','connect','newSession','disconnect','reconnect','selectUpload'].includes(value.type)) return false;
  return Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k));
}
export function browserResponse(value,sessionId) {
  return plain(value) && value.version === 1 && value.type === 'browserModel' && value.sessionId === sessionId
    && ['local','remote'].every(side => plain(value[side]) && typeof value[side].path === 'string' && Array.isArray(value[side].entries) && value[side].entries.length <= 10000 && value[side].entries.every(e => plain(e) && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.path === 'string' && ['file','directory','symlink','other'].includes(e.kind)));
}
