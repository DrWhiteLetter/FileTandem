import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialsFor } from '../../src/application/credentials.js';
const p={id:'p',name:'Test',host:'localhost',port:22,username:'u',auth:'password'};
test('credentials: cancellation has no side effects; save only after success; key disposal',async () => {
  const saved=new Map(); const secrets={get:async k => saved.get(k),store:async (k,v) => saved.set(k,v)};
  await assert.rejects(credentialsFor(p,{secrets,prompt:async () => undefined}),/abgebrochen/); assert.equal(saved.size,0);
  const c=await credentialsFor(p,{secrets,prompt:async () => ({value:'test-password',remember:true})});
  assert.equal(saved.size,0); await c.commit(); assert.equal(saved.size,1); c.dispose(); assert.equal(c.config.password,undefined);
  const key=Buffer.from('encrypted-key');
  const k=await credentialsFor({...p,auth:'key',keyPath:'/test'},{secrets,readKey:async () => key,encrypted:() => true,prompt:async () => ({value:'phrase'})});
  assert.equal(k.config.passphrase,'phrase'); k.dispose(); assert.ok(key.every(b => b === 0));
});
