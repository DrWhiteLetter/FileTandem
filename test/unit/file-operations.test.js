import test from 'node:test';
import assert from 'node:assert/strict';
import { fileName } from '../../src/domain/file-name.js';
import { createFolder,renameEntry } from '../../src/application/file-operations.js';
import { posix } from 'node:path';
test('safe names, special characters and conflict protection before mutations',async () => {
  for (const name of ['.','..','a/b','a\\b','a\0b','a\nb','']) assert.throws(() => fileName(name));
  for (const name of ['CON','a?b','a.']) assert.throws(() => fileName(name,true));
  assert.equal(fileName("Grüße '2026' & Datei"),"Grüße '2026' & Datei");
  const values=new Set(['/root/existing']);let writes=0;const service={stat:async path => {if (!values.has(path)) throw Object.assign(new Error('missing'),{code:'ENOENT'});},mkdir:async path => {writes++;values.add(path);},rename:async (old,path) => {writes++;values.delete(old);values.add(path);}};
  await assert.rejects(createFolder(service,'/root','existing',{join:posix.join}),/existiert/);assert.equal(writes,0);
  await createFolder(service,'/root',"Grüße '2026'",{join:posix.join});await renameEntry(service,"/root/Grüße '2026'",'/root','anders',{join:posix.join});assert.ok(values.has('/root/anders'));
  await assert.rejects(renameEntry(service,'/root/anders','/root','existing',{join:posix.join}));assert.equal(writes,2);
});
