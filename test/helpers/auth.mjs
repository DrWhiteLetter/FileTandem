import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, access, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
export const runtime = fileURLToPath(new URL('../fixtures/ssh/.runtime/', import.meta.url));
export const authPort = Number(process.env.XSCP_SSH_PORT_BASE ?? 22220) + 3;
export async function authMaterial() {
  const root = join(runtime, 'auth');
  return { ...JSON.parse(await readFile(join(root, 'credentials.json'), 'utf8')),
    ed25519: await readFile(join(runtime, 'client_ed25519')),
    encryptedEd25519: await readFile(join(root, 'encrypted_ed25519')),
    rsa: await readFile(join(root, 'client_rsa')),
    encryptedRsa: await readFile(join(root, 'encrypted_rsa')),
    expected: (await readFile(join(runtime, 'servers', 'auth', 'host_ed25519.pub'), 'utf8')).split(' ')[1],
  };
}
/** Dedicated foreground agent; never modifies the user's agent or process.env. */
export async function startTestAgent(material) {
  if (process.platform === 'win32') throw new Error('Unix test-agent helper is not a Windows-agent acceptance.');
  const directory = await mkdtemp(join(tmpdir(), 'xa-'));
  const socket = join(directory, 'a');
  const askpass = join(directory, 'askpass');
  await writeFile(askpass, '#!/bin/sh\nprintf \'%s\\n\' "$XSCP_TEST_PASSPHRASE"\n', { mode: 0o700 });
  const child = spawn('ssh-agent', ['-D', '-a', socket], { stdio: ['ignore', 'ignore', 'pipe'] });
  let error;
  let exited = false;
  child.on('error', value => { error = value; });
  const closed = new Promise(resolve => child.once('close', () => { exited = true; resolve(); }));
  child.stderr.resume();
  const stop = async () => { if (!exited) child.kill('SIGTERM'); await closed; await rm(directory, { recursive: true, force: true }); };
  try {
    let ready = false;
    for (let count = 0; count < 40; count++) {
      if (error) throw error;
      if (exited) throw new Error('Dedicated test agent exited before readiness.');
      try { await access(socket); ready = true; break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!ready) throw new Error('Dedicated test agent did not create socket.');
    const env = { ...process.env, SSH_AUTH_SOCK: socket, SSH_ASKPASS: askpass, SSH_ASKPASS_REQUIRE: 'force', DISPLAY: 'xscp-test:0', XSCP_TEST_PASSPHRASE: material.passphrase };
    const loadKey = filename => {
      for (const args of [['-D'], [join(runtime, 'auth', filename)]]) {
        const result = spawnSync('ssh-add', args, { env, encoding: 'utf8', timeout: 10000 });
        if (result.status !== 0 || result.error) throw new Error('Unable to load isolated test agent key.');
      }
    };
    return { socket, loadKey, stop };
  } catch (failure) { await stop(); throw failure; }
}
