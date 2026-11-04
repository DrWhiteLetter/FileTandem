import test from 'node:test';import assert from 'node:assert/strict';import { discoverTree } from '../../src/application/transfer-tree.js';
test('incremental tree includes empty directories, skips link traversal and strips special mode bits',async () => {
  const values={'/root':{kind:'directory',mode:0o2755,modified:0},'/root/empty':{kind:'directory',mode:0o755,modified:0},'/root/link':{kind:'symlink',mode:0o777,modified:0},'/root/file':{kind:'file',mode:0o4755,modified:0}};
  const source={stat:async p => values[p],listNoFollow:async p => {assert.notEqual(p,'/root/link');return {entries:p === '/root' ? ['empty','link','file'].map(name => ({name,path:p+'/'+name})):[]};}};
  const entries=[];for await (const entry of discoverTree(source,'/root')) entries.push(entry);
  assert.equal(entries.length,4);assert.equal(entries[3].metadata.mode,0o755);assert.equal(entries[1].kind,'directory');assert.equal(entries[2].kind,'symlink');
});

test('excluded directories are not traversed and excluded files are never yielded',async()=>{
 const {filePolicy}=await import('../../src/application/file-policy.js');const visited=[];
 const source={stat:async path=>({kind:path.endsWith('.log')?'file':'directory',mode:0o755,modified:0}),listNoFollow:async path=>{visited.push(path);return {entries:path==='/root' ? ['.git','keep','debug.log','old.bak'].map(name=>({name,path:path+'/'+name})):[]};}};
 const result=[];for await(const item of discoverTree(source,'/root','',0,{count:0},filePolicy({excludedExtensions:['log']}).excludes)) result.push(item.source);
 assert.deepEqual(result,['/root','/root/keep']);assert.deepEqual(visited,['/root','/root/keep']);
});

test('discovery reuses listed file metadata but rechecks directories before following them',async()=>{
 const stats=[];const source={stat:async p=>{stats.push(p);return {kind:p==='/root' ? 'directory':'symlink',mode:0o755,modified:1};},listNoFollow:async p=>{assert.equal(p,'/root');return {entries:[{name:'file',path:'/root/file',kind:'file',mode:0o644,modified:1},{name:'swapped',path:'/root/swapped',kind:'directory',mode:0o755,modified:1}]};}};
 const nodes=[];for await(const node of discoverTree(source,'/root'))nodes.push(node);
 assert.deepEqual(stats,['/root','/root/swapped']);assert.equal(nodes[1].kind,'file');assert.equal(nodes[2].kind,'symlink');
});
