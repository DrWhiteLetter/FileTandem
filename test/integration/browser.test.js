import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectSsh } from '../../src/adapters/ssh/connect.js';
import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
import { RemoteFiles } from '../../src/adapters/sftp/files.js';
import { SessionManager } from '../../src/application/session-manager.js';
import { credentialsFor } from '../../src/application/credentials.js';
import { authMaterial,runtime,authPort } from '../helpers/auth.mjs';
const trust=() => {const records=new Map();return new HostKeyStore({read:async id => records.get(id),write:async (id,v) => records.set(id,v)});};
test('SFTP-only browsing without shell and real credential/session lifecycle', {timeout:30000},async () => {
  const session=await connectSsh({host:'127.0.0.1',port:Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+1,username:'fixture',privateKey:await readFile(join(runtime,'client_ed25519')),readyTimeout:5000},{trust:trust(),confirmUnknown:async () => true});
  try {const files=await RemoteFiles.open(session);const result=await files.list('/data');assert.ok(result.entries.some(e => e.name === 'server-marker.txt'));assert.equal((await files.stat('/data/server-marker.txt')).kind,'file');await assert.rejects(files.list('/missing'));files.close();} finally {await session.close();}
  const material=await authMaterial();
  for (const auth of ['password','key']) {
    const saved=new Map();const profile={id:`auth-${auth}`,name:'Fixture',host:'127.0.0.1',port:authPort,username:'fixture',protocol:'sftp',auth,keyPath:'fixture'};
    const manager=new SessionManager({connect:connectSsh,policy:{trust:trust(),confirmUnknown:async () => true},credentials:(p,signal) => credentialsFor(p,{signal,secrets:{get:async key => saved.get(key),store:async (key,v) => saved.set(key,v)},readKey:async () => Buffer.from(material.encryptedEd25519),encrypted:() => true,prompt:async kind => ({value:kind === 'password' ? material.password:material.passphrase,remember:true})})});
    try {await manager.connect(profile);const files=await RemoteFiles.open(manager.transport(profile.id));assert.ok((await files.list('/data')).entries.length);files.close();assert.equal(saved.size,1);await manager.disconnect(profile.id);assert.equal(manager.snapshot(profile.id).state,'disconnected');await manager.connect(profile);assert.equal(manager.snapshot(profile.id).state,'connected');} finally {await manager.disconnect(profile.id);manager.dispose();}
  }
});
