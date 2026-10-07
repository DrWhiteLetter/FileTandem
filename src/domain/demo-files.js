const modified = Date.UTC(2026,9,7,10,0);
const file = (id,name,size) => ({id,name,size,kind:'file',modified});
const directory = (id,name) => ({id,name,size:0,kind:'directory',modified});
export const DEMO_ROOTS = { local: '/Desktop/Demo', remote: '/srv/demo' };
export const DEMO_FOLDERS = {
  local: {
    '/Desktop/Demo': [directory('l-assets','assets'),directory('l-docs','docs'),file('l-config','.env.example',340),file('l-readme','README.md',2450),file('l-index','index.html',8192)],
    '/Desktop/Demo/assets': [file('l-logo','logo.svg',3021),file('l-style','style.css',4096)],
    '/Desktop/Demo/docs': [file('l-guide','Anleitung.md',12048)],
  },
  remote: {
    '/srv/demo': [directory('r-assets','assets'),directory('r-logs','logs'),file('r-index','index.html',8192),file('r-special','<img src=x onerror=alert(1)>.txt',64)],
    '/srv/demo/assets': [file('r-logo','logo.svg',3021)],
    '/srv/demo/logs': [],
  },
};
export function demoParent(side,path) {
  if (path === DEMO_ROOTS[side]) return path;
  const parent = path.slice(0,path.lastIndexOf('/'));
  return Object.hasOwn(DEMO_FOLDERS[side],parent) ? parent : DEMO_ROOTS[side];
}
