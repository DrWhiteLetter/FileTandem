import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, rm, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const fixtureRoot = fileURLToPath(new URL('../test/fixtures/ssh/', import.meta.url));
const runtime = join(fixtureRoot, '.runtime');
const owner = createHash('sha256').update(fixtureRoot).digest('hex').slice(0, 12);
const prefix = `xscp-ssh-${owner}`;
const modes = ['sftp', 'sftp-only', 'scp', 'auth'];
const base = Number(process.env.XSCP_SSH_PORT_BASE ?? 22220);
if (!Number.isInteger(base) || base < 1024 || base > 65532) throw new Error('XSCP_SSH_PORT_BASE must be 1024..65532.');
const context = process.env.XSCP_DOCKER_CONTEXT;
const dockerPrefix = context ? ['--context', context] : [];
const image = `${prefix}:m0`;
const network = `${prefix}-network`;
const name = mode => `${prefix}-${mode}`;
const label = 'de.xscp.fixture-owner';

function run(command, args, { input, allowFailure = false, timeout = 30000, inherit = false } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', input, timeout,
    maxBuffer: 16 * 1024 * 1024, ...(inherit ? { stdio: 'inherit' } : {}) });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args[0] ?? ''} failed (${result.status}): ${result.stderr ?? ''}`);
  }
  return result;
}
const docker = (args, options) => run('docker', [...dockerPrefix, ...args], options);
const ssh = (mode, args, options) => run('ssh', ['-F', join(runtime, 'ssh_config'), `xscp-fixture-${mode}`, ...args], options);
const sftp = (mode, input, allowFailure = false) => run('sftp', ['-F', join(runtime, 'ssh_config'), '-b', '-', `xscp-fixture-${mode}`], { input, allowFailure });
const scp = (mode, args, allowFailure = false) => run('scp', ['-F', join(runtime, 'ssh_config'), ...args], { allowFailure });
const quoted = value => `"${value.replaceAll('\\', '/').replaceAll('"', '\\"')}"`;

async function exists(path) {
  try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function key(path) {
  if (!await exists(path)) run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'xScp disposable fixture ONLY', '-f', path]);
  await chmod(path, 0o600);
}
async function init() {
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  await chmod(runtime, 0o700);
  await key(join(runtime, 'client_ed25519'));
  const publicKey = await readFile(join(runtime, 'client_ed25519.pub'), 'utf8');
  const authRoot = join(runtime, 'auth');
  await mkdir(authRoot, { recursive: true, mode: 0o700 });
  const credentialsPath = join(authRoot, 'credentials.json');
  if (!await exists(credentialsPath)) await writeFile(credentialsPath, JSON.stringify({
    password: randomBytes(24).toString('base64url'), passphrase: randomBytes(24).toString('base64url'),
  }) + '\n', { mode: 0o600 });
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  for (const [filename, type, encrypted] of [['encrypted_ed25519', 'ed25519', true], ['client_rsa', 'rsa', false], ['encrypted_rsa', 'rsa', true]]) {
    const path = join(authRoot, filename);
    if (!await exists(path)) run('ssh-keygen', ['-q', '-t', type, ...(type === 'rsa' ? ['-b', '3072'] : []),
      '-N', encrypted ? credentials.passphrase : '', '-C', 'xScp auth fixture ONLY', '-f', path]);
    await chmod(path, 0o600);
  }
  let knownHosts = '';
  let config = '';
  for (const [index, mode] of modes.entries()) {
    const directory = join(runtime, 'servers', mode);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await key(join(directory, 'host_ed25519'));
    let authorized = publicKey;
    if (mode === 'auth') {
      for (const filename of ['encrypted_ed25519', 'client_rsa', 'encrypted_rsa']) authorized += await readFile(join(authRoot, `${filename}.pub`), 'utf8');
      const hash = run('openssl', ['passwd', '-6', '-stdin'], { input: credentials.password + '\n' }).stdout.trim();
      await writeFile(join(directory, 'password_hash'), `fixture:${hash}\n`, { mode: 0o600 });
    }
    await writeFile(join(directory, 'authorized_keys'), authorized, { mode: 0o644 });
    knownHosts += `[127.0.0.1]:${base + index} ${await readFile(join(directory, 'host_ed25519.pub'), 'utf8')}`;
    config += `Host xscp-fixture-${mode}\n  HostName 127.0.0.1\n  Port ${base + index}\n  User fixture\n  IdentityFile ${quoted(join(runtime, 'client_ed25519'))}\n  UserKnownHostsFile ${quoted(join(runtime, 'known_hosts'))}\n  StrictHostKeyChecking yes\n  IdentitiesOnly yes\n  BatchMode yes\n  PasswordAuthentication no\n  KbdInteractiveAuthentication no\n  RequestTTY no\n  LogLevel ERROR\n  ConnectTimeout 5\n\n`;
  }
  await writeFile(join(runtime, 'known_hosts'), knownHosts, { mode: 0o600 });
  await writeFile(join(runtime, 'ssh_config'), config, { mode: 0o600 });
}
function requireDocker() {
  const selected = context || process.env.DOCKER_CONTEXT || docker(['context', 'show']).stdout.trim();
  const endpoint = !context && !process.env.DOCKER_CONTEXT && process.env.DOCKER_HOST
    ? process.env.DOCKER_HOST
    : JSON.parse(docker(['context', 'inspect', selected]).stdout)[0].Endpoints.docker.Host;
  if (!endpoint.startsWith('unix://') && !endpoint.startsWith('npipe://')) {
    throw new Error('Fixtures require a local Docker endpoint (Unix socket/named pipe), not a remote daemon.');
  }
  if (docker(['info', '--format', '{{.OSType}}']).stdout.trim() !== 'linux') throw new Error('Linux Docker containers are required.');
}
function inspect(kind, identifier) {
  const result = docker([kind, 'inspect', identifier], { allowFailure: true });
  if (result.status !== 0) return null;
  const object = JSON.parse(result.stdout)[0];
  const labels = kind === 'container' ? object.Config.Labels : object.Labels;
  if (labels?.[label] !== owner) throw new Error(`Refusing to change unowned ${kind}: ${identifier}`);
  return object;
}
function stop() {
  requireDocker();
  for (const mode of modes) if (inspect('container', name(mode))) docker(['rm', '-f', name(mode)]);
  if (inspect('network', network)) docker(['network', 'rm', network]);
  console.log('Fixture containers/network removed; generated keys retained.');
}
async function start() {
  requireDocker();
  await init();
  await rm(join(runtime, 'verification.json'), { force: true });
  docker(['build', '--label', `${label}=${owner}`, '-t', image, fixtureRoot], { timeout: 600000, inherit: true });
  // Recreate only objects owned by this checkout, starting with empty /data.
  stop();
  docker(['network', 'create', '--label', `${label}=${owner}`, network]);
  try {
    for (const [index, mode] of modes.entries()) {
      docker(['run', '-d', '--name', name(mode), '--label', `${label}=${owner}`,
        '--network', network, '--publish', `127.0.0.1:${base + index}:22`,
        '--mount', `type=bind,src=${join(runtime, 'servers', mode)},dst=/fixtures,readonly`,
        '--env', `FIXTURE_MODE=${mode}`, '--memory', '128m', '--cpus', '0.5', '--pids-limit', '64', image]);
    }
    for (const mode of modes) {
      let ready = false;
      let lastError = '';
      for (let attempt = 0; attempt < 20; attempt++) {
        const result = mode === 'scp' ? ssh(mode, ['true'], { allowFailure: true }) : sftp(mode, 'pwd\nquit\n', true);
        if (result.status === 0) { ready = true; break; }
        lastError = result.stderr;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!ready) {
        const logs = docker(['logs', name(mode)], { allowFailure: true });
        throw new Error(`${mode} did not become ready: ${lastError}\nServer: ${logs.stderr}`);
      }
      console.log(`${mode}: fixture@127.0.0.1:${base + modes.indexOf(mode)} ready`);
    }
  } catch (error) {
    stop();
    throw error;
  }
  console.log(`SSH config: ${join(runtime, 'ssh_config')}`);
}
async function verify() {
  requireDocker();
  if (!await exists(join(runtime, 'ssh_config'))) throw new Error('Run npm run fixtures:start first.');
  await rm(join(runtime, 'verification.json'), { force: true });
  const source = join(runtime, 'probe.txt');
  const payload = Buffer.from('xScp M0-03 disposable protocol probe\n');
  await writeFile(source, payload, { mode: 0o600 });
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    for (const mode of modes) {
      const container = inspect('container', name(mode));
      assert(container?.State.Running, `${mode} fixture is not running.`);
      const destination = join(runtime, `download-${mode}.txt`);
      await rm(destination, { force: true });
      const shell = ssh(mode, ['printf XSCP_SHELL_OK'], { allowFailure: true });
      if (mode === 'sftp-only') {
        assert(!shell.stdout.includes('XSCP_SHELL_OK'), 'SFTP-only unexpectedly executed a shell command.');
      } else assert(shell.status === 0 && shell.stdout === 'XSCP_SHELL_OK', `${mode}: shell failed.`);
      if (mode !== 'scp') {
        sftp(mode, `put ${quoted(source)} /data/probe.txt\nget /data/probe.txt ${quoted(destination)}\nrm /data/probe.txt\nquit\n`);
      } else {
        const failure = sftp(mode, 'pwd\nquit\n', true);
        assert(failure.status !== 0 && /subsystem request failed/i.test(failure.stderr), 'SCP fixture did not explicitly reject the SFTP subsystem.');
        // -O is essential: OpenSSH scp defaults to SFTP on current clients.
        scp(mode, ['-O', source, `xscp-fixture-${mode}:/data/probe.txt`]);
        scp(mode, ['-O', `xscp-fixture-${mode}:/data/probe.txt`, destination]);
        ssh(mode, ['rm /data/probe.txt']);
        assert(ssh(mode, ['find --version; stat --version']).stdout.includes('GNU'), 'GNU tools missing.');
      }
      assert((await readFile(destination)).equals(payload), `${mode}: round-trip content differs.`);
      if (mode === 'sftp-only') {
        const legacy = scp(mode, ['-O', source, 'xscp-fixture-sftp-only:/data/unexpected-scp.txt'], true);
        assert(legacy.status !== 0, 'SFTP-only unexpectedly accepted legacy SCP.');
      }
      // Wrong-key failures must be authentication failures, not connection errors.
      const wrongKey = join(runtime, 'wrong_ed25519');
      await key(wrongKey);
      const denied = run('ssh', ['-F', '/dev/null', '-p', String(base + modes.indexOf(mode)),
        '-i', wrongKey, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', `UserKnownHostsFile=${join(runtime, 'known_hosts')}`, '-o', 'ConnectTimeout=5',
        'fixture@127.0.0.1', 'true'], { allowFailure: true });
      assert(denied.status !== 0 && /Permission denied \(publickey(?:,password,keyboard-interactive)?\)/.test(denied.stderr), `${mode}: wrong-key rejection not proven.`);
      const fingerprint = run('ssh-keygen', ['-lf', join(runtime, 'servers', mode, 'host_ed25519.pub')]).stdout.trim();
      const version = docker(['exec', name(mode), 'sh', '-c', 'sshd -V 2>&1; uname -srm; getconf GNU_LIBC_VERSION']).stdout.trim();
      results.push({ mode, port: base + modes.indexOf(mode), fingerprint, version,
        shell: mode === 'sftp-only' ? 'blocked' : 'available', sftp: mode === 'scp' ? 'blocked' : 'available', roundTrip: 'byte-identical', wrongKey: 'rejected' });
      console.log(`${mode}: protocol boundaries, byte-identical round trip and wrong-key rejection passed`);
    }
    const report = { item: 'M0-03', timestamp: new Date().toISOString(),
      docker: docker(['version', '--format', '{{.Server.Version}}']).stdout.trim(),
      imageId: docker(['image', 'inspect', image, '--format', '{{.Id}}']).stdout.trim(), results };
    await writeFile(join(runtime, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Report: ${join(runtime, 'verification.json')}`);
  } finally {
    await rm(source, { force: true });
    for (const mode of modes) await rm(join(runtime, `download-${mode}.txt`), { force: true });
  }
}

try {
  switch (process.argv[2]) {
    case 'init': await init(); console.log(`Generated disposable keys/config in ${runtime}`); break;
    case 'start': await start(); break;
    case 'stop': stop(); break;
    case 'reset': stop(); await rm(runtime, { recursive: true, force: true }); console.log('Generated fixture keys/config removed.'); break;
    case 'verify': await verify(); break;
    case 'status': requireDocker(); for (const mode of modes) console.log(`${mode}: ${inspect('container', name(mode))?.State.Status ?? 'absent'}`); break;
    default: throw new Error('Usage: node scripts/ssh-fixtures.mjs init|start|stop|reset|verify|status');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
