import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {join} from 'node:path';import {runtime} from './auth.mjs';import {connectSsh} from '../../src/adapters/ssh/connect.js';import {HostKeyStore} from '../../src/adapters/ssh/host-keys.js';
export async function fixture() {
  const expected=(await readFile(join(runtime,'servers/sftp-only/host_ed25519.pub'),'utf8')).split(' ')[1];const records=new Map();
  return connectSsh({host:'127.0.0.1',port:Number(process.env.FILETANDEM_SSH_PORT_BASE ?? 22220)+1,username:'fixture',privateKey:await readFile(join(runtime,'client_ed25519')),readyTimeout:5000},{trust:new HostKeyStore({read:async k => records.get(k),write:async (k,v) => records.set(k,v)}),confirmUnknown:async k => {assert.equal(k.key,expected);return true;}});
}
