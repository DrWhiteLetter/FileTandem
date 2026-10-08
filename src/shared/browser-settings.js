export function browserSettings(read) {
  return {showHiddenFiles:read('showHiddenFiles')===true,commanderKeys:read('commanderKeys')===true};
}
export const DRAG_TYPE='application/x-filetandem-selection';
export function browserDrag(value,sessionId) {
  return value && value.version===1 && value.sessionId===sessionId && ['local','remote'].includes(value.side) && Array.isArray(value.ids) && value.ids.length>0 && value.ids.length<=1000 && new Set(value.ids).size===value.ids.length && value.ids.every(id => typeof id==='string' && id.length<=4096 && !id.includes('\0')) && Object.keys(value).length===4;
}
