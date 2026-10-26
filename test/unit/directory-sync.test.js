import test from 'node:test';
import assert from 'node:assert/strict';
import { posix,win32 } from 'node:path';
import { planDirectorySync } from '../../src/application/directory-sync.js';
const service=nodes => ({
  async stat(path) {if (!nodes[path]) throw new Error('missing');return {size:1,modified:1000,...nodes[path]};},
  async listNoFollow(path) {return {entries:Object.keys(nodes).filter(p => p!==path && posix.dirname(p)===path).map(p => ({name:posix.basename(p),path:p}))};}
});
const directory={kind:'directory'},file={kind:'file'};
const plan=(a,b,extra={}) => planDirectorySync({source:service({'/a':directory,...a}),target:service({'/b':directory,...b}),sourceRoot:'/a',targetRoot:'/b',...extra});
test('sync plans changed and missing files, groups missing subtrees and preserves extra targets',async () => {
  const result=await plan({'/a/same':file,'/a/change':{...file,size:2},'/a/new':directory,'/a/new/child':file},{'/b/same':{...file,modified:1500},'/b/change':file,'/b/extra':file});
  assert.deepEqual(result.operations.map(o => [o.relative,o.destination]),[['change','/b'],['new','/b']]);
});
test('sync skips links and type conflicts without following them',async () => {
  const result=await plan({'/a/link':{kind:'symlink'},'/a/conflict':directory,'/a/conflict/child':file},{'/b/conflict':file});
  assert.equal(result.operations.length,0);assert.deepEqual(result.skipped,['link','conflict']);
});
test('snapshot detects changes and is independent of listing order',async () => {
  const a=await plan({'/a/x':file,'/a/y':file},{}),b=await plan({'/a/y':file,'/a/x':file},{}),c=await plan({'/a/x':{...file,size:2},'/a/y':file},{});
  assert.equal(a.fingerprint,b.fingerprint);assert.notEqual(a.fingerprint,c.fingerprint);
});
test('Windows target rejects ambiguous and unrepresentable source names',async () => {
  await assert.rejects(plan({'/a/A':file,'/a/a':file},{},{windowsTarget:true,targetPath:win32}),/Mehrdeutige/);
  await assert.rejects(plan({'/a/NUL.txt':file},{},{windowsTarget:true,targetPath:win32}),/Windows/);
  const result=await plan({'/a/A':file},{'/b/a':file},{windowsTarget:true});assert.equal(result.operations.length,0);
});
test('unsafe names and inaccessible subtrees abort the whole preview',async () => {
  await assert.rejects(planDirectorySync({source:{stat:async () => directory,listNoFollow:async () => ({entries:[{name:'../escape'}]})},target:service({'/b':directory}),sourceRoot:'/a',targetRoot:'/b'}),/Ungültiger/);
});
