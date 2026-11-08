import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { connectSsh } from '../../src/adapters/ssh/connect.js';
import { HostKeyStore } from '../../src/adapters/ssh/host-keys.js';
import { openEditorFile, EDITOR_LIMIT } from '../../src/adapters/sftp/editor-file.js';
const runtime = fileURLToPath(new URL('../fixtures/ssh/.runtime/', import.meta.url));
async function connect() {
  const records = new Map();
  return connectSsh({ host: '127.0.0.1', port: Number(process.env.FILETANDEM_SSH_PORT_BASE ?? 22220) + 1, username: 'fixture', privateKey: await readFile(runtime + 'client_ed25519') }, { trust: new HostKeyStore({ read: async k => records.get(k), write: async (k,v) => records.set(k,v) }), confirmUnknown: async k => {
    assert.equal(k.key, (await readFile(runtime + 'servers/sftp-only/host_ed25519.pub','utf8')).split(' ')[1]); return true;
  } });
}
test('SFTP-only editor: bounded files, exclusive temporary writes, serial saves, conflict and revoked grant', async () => {
  const session = await connect();
  const sftp = await new Promise((r,j) => session.sftp((e,s) => e ? j(e) : r(s)));
  const call = (m,...a) => new Promise((r,j) => sftp[m](...a,(e,v) => e ? j(e) : r(v)));
  const path = `/data/editor ä #? '${randomUUID()}.txt`;
  const put = async (p, bytes) => { const h = await call('open',p,'w'); try { await call('write',h,bytes,0,bytes.length,0); } finally { await call('close',h); } };
  let file;
  try {
    await put(path,Buffer.from('original'));
    await call('symlink',path,path+'.link');
    await assert.rejects(openEditorFile(session,path+'.link'), /reguläre/);
    await assert.rejects(openEditorFile(session,'/data/../data/file'), /Ungültiger/);
    file = await openEditorFile(session,path);
    let allowed = false;
    await assert.rejects(file.write(Buffer.from('blocked'),() => allowed), /schreibgeschützt/);
    assert.equal((await file.read()).toString(),'original');
    allowed = true;
    await assert.rejects(file.write(Buffer.alloc(EDITOR_LIMIT+1),() => allowed), /10 MiB/);
    await Promise.all([file.write(Buffer.from('first'),() => allowed),file.write(Buffer.from('second'),() => allowed)]);
    assert.equal((await file.read()).toString(),'second');
    await file.write(Buffer.alloc(0),() => allowed); assert.equal((await file.read()).length,0);
    await put(path,Buffer.from('external'));
    await assert.rejects(file.write(Buffer.from('conflict'),() => allowed), /Remote-Datei wurde geändert/);
    assert.equal((await file.read()).toString(),'external');
    allowed = false; await assert.rejects(file.write(Buffer.from('revoked'),() => allowed), /schreibgeschützt/);
    assert.equal((await call('readdir','/data')).some(f => f.filename.startsWith('.filetandem-editor-')),false);
    const large = await call('open',path+'.large','w'); await call('fsetstat',large,{size:EDITOR_LIMIT+1}); await call('close',large);
    await assert.rejects(openEditorFile(session,path+'.large'), /10 MiB/);
  } finally {
    for (const p of [path,path+'.link',path+'.large']) await call('unlink',p).catch(() => {});
    sftp.end(); if (file) await file.close(); else await session.close();
  }
});
