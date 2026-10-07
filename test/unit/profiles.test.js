import test from 'node:test';
import assert from 'node:assert/strict';
import { Profiles } from '../../src/application/profiles.js';
import { validateProfile } from '../../src/domain/profile.js';
const profile={version:1,id:'p1',name:'Test',host:'localhost',username:'fixture'};
test('profile persistence, edits, deletion, safe export and invalid input',async () => {
  let state; const storage={get:(_,fallback) => state ?? fallback,update:async (_,value) => {state=value;}};
  const first=new Profiles(storage); await first.save(profile);
  const restarted=new Profiles(storage); assert.equal(restarted.get('p1').protocol,'sftp');
  await restarted.save({...restarted.get('p1'),name:'Bearbeitet'}); assert.equal(first.get('p1').name,'Bearbeitet');
  assert.throws(() => validateProfile({...profile,password:'secret'}),/Geheimnisse/);
  assert.throws(() => validateProfile({...profile,port:70000}),/Port/);
  assert.throws(() => validateProfile({...profile,version:2}),/Version/);
  assert.ok(!restarted.export().includes('secret')); await restarted.delete('p1'); assert.deepEqual(first.list(),[]);
});
