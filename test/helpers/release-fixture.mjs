import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer,connect } from 'node:net';
import { runtime } from './auth.mjs';
import { connectSsh } from '../../src/adapters/ssh/connect.js';
import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
export const fixturePort=protocol => Number(process.env.XSCP_SSH_PORT_BASE ?? 22220)+(protocol==='scp' ? 2:1);
export async function releaseFixture(protocol,port=fixturePort(protocol)) {
  const mode=protocol==='scp' ? 'scp':'sftp-only';
  const expected=(await readFile(join(runtime,'servers',mode,'host_ed25519.pub'),'utf8')).split(' ')[1];
  const records=new Map();
  const session=await connectSsh({host:'127.0.0.1',port,username:'fixture',privateKey:await readFile(join(runtime,'client_ed25519')),readyTimeout:5000},{trust:new HostKeyStore({read:async k => records.get(k),write:async (k,v) => records.set(k,v)}),confirmUnknown:async key => {assert.equal(key.key,expected);return true;}});
  if (protocol==='scp') return {...session,sftp:() => {throw new Error('SCP-only test must never fall back to SFTP');}};
  return session;
}
// Loopback TCP proxy cuts or pauses actual SSH packets, not mocked file calls.
export async function networkProxy(port) {
  const pairs=new Set();
  const server=createServer(client => {
    const upstream=connect({host:'127.0.0.1',port});const pair={client,upstream};pairs.add(pair);
    client.on('error',() => {});upstream.on('error',() => {});
    const close=() => {client.destroy();upstream.destroy();pairs.delete(pair);};
    client.once('close',close);upstream.once('close',close);
    client.pipe(upstream);upstream.pipe(client);
  });
  await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {port:server.address().port,cut() {for (const {client,upstream} of pairs) {client.destroy();upstream.destroy();}},
    async pause(milliseconds) {for (const {client,upstream} of pairs) {client.pause();upstream.pause();}await new Promise(resolve => setTimeout(resolve,milliseconds));for (const {client,upstream} of pairs) {client.resume();upstream.resume();}},
    close() {this.cut();return new Promise(resolve => server.close(resolve));}};
}
