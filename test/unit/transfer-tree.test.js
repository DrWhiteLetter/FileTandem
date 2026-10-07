import test from 'node:test';import assert from 'node:assert/strict';import { discoverTree } from '../../src/application/transfer-tree.js';
test('incremental tree includes empty directories, skips link traversal and strips special mode bits',async () => {
  const values={'/root':{kind:'directory',mode:0o2755,modified:0},'/root/empty':{kind:'directory',mode:0o755,modified:0},'/root/link':{kind:'symlink',mode:0o777,modified:0},'/root/file':{kind:'file',mode:0o4755,modified:0}};
  const source={stat:async p => values[p],listNoFollow:async p => {assert.notEqual(p,'/root/link');return {entries:p === '/root' ? ['empty','link','file'].map(name => ({name,path:p+'/'+name})):[]};}};
  const entries=[];for await (const entry of discoverTree(source,'/root')) entries.push(entry);
  assert.equal(entries.length,4);assert.equal(entries[3].metadata.mode,0o755);assert.equal(entries[1].kind,'directory');assert.equal(entries[2].kind,'symlink');
});
