import { trashPaths } from '../../src/application/local-delete.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { planRemoteDelete,executeRemoteDelete } from '../../src/application/remote-delete.js';
test('recursive deletion unlinks symlink without following target; refuses changed kinds',async () => {
  const nodes=new Map([['/root',{kind:'directory'}],['/root/link',{kind:'symlink'}],['/root/file',{kind:'file'}]]);const deleted=[];
  const service={stat:async p => nodes.get(p),listNoFollow:async p => ({entries:[{path:p+'/link'},{path:p+'/file'}]}),call:async (method,p) => {deleted.push([method,p]);nodes.delete(p);}};
  const plan=await planRemoteDelete(service,['/root']);assert.equal(plan.length,3);await executeRemoteDelete(service,plan,() => true);
  assert.deepEqual(deleted,[['unlink','/root/link'],['unlink','/root/file'],['rmdir','/root']]);
  nodes.set('/root',{kind:'symlink'});await assert.rejects(executeRemoteDelete(service,[{path:'/root',kind:'directory'}],() => true),/ersetzt/);
});

test('trash failures propagate without any permanent-delete fallback',async () => {
  const calls=[];await assert.rejects(trashPaths(['/own/file','/own/other'],() => true,async (path,options) => {calls.push({path,options});throw new Error('OS trash failed');}),/trash failed/);
  assert.equal(calls.length,1);assert.deepEqual(calls[0].options,{recursive:true,useTrash:true});
});
