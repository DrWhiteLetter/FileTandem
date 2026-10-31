import test from 'node:test';
import assert from 'node:assert/strict';
import { agentAddress, authenticationOptions, answerKeyboardChallenge } from '../../src/adapters/ssh/authentication.js';

test('Agent paths are explicit; Windows pipe syntax accepted, Pageant/Cygwin rejected', () => {
  assert.equal(agentAddress('/tmp/agent.sock', 'darwin'), '/tmp/agent.sock');
  assert.equal(agentAddress('\\\\.\\pipe\\openssh-ssh-agent', 'win32'), '\\\\.\\pipe\\openssh-ssh-agent');
  for (const value of ['pageant', '/tmp/cygwin-socket', 'relative']) assert.throws(() => agentAddress(value, 'win32'), { code: 'UNSUPPORTED_AGENT' });
  for (const value of ['', 'relative', '/tmp/a\n']) assert.throws(() => agentAddress(value, 'linux'), { code: 'INVALID_AGENT' });
});

test('Auth credentials are typed, agent forwarding stays disabled and keyboard is opt-in', () => {
  const options = authenticationOptions({ password: 'test', agent: process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : '/tmp/agent', keyboardInteractive: () => [] });
  assert.equal(options.agentForward, false); assert.equal(options.tryKeyboard, true);
  assert.equal(authenticationOptions({}).tryKeyboard, false);
  for (const config of [{ password: 1 }, { passphrase: {} }, { privateKey: [] }, { keyboardInteractive: true }]) assert.throws(() => authenticationOptions(config), { code: 'INVALID_AUTH_CONFIG' });
});

const request = { name: 'PAM', instructions: '', language: '', prompts: [{ prompt: 'Password: ', echo: false }] };
test('Keyboard challenges validate echo/count and answers; empty final round needs no dialog', async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(await answerKeyboardChallenge(async prompt => { assert.equal(prompt.prompts[0].echo, false); return ['test']; }, request, signal), ['test']);
  assert.deepEqual(await answerKeyboardChallenge(() => { throw new Error('must not prompt'); }, { ...request, prompts: [] }, signal), []);
  for (const answer of [undefined, [], ['a', 'b'], [1]]) await assert.rejects(answerKeyboardChallenge(() => answer, request, signal), { code: 'INVALID_AUTH_RESPONSE' });
  await assert.rejects(answerKeyboardChallenge(() => { throw new Error('private dialog details'); }, request, signal), error => error.code === 'AUTH_PROMPT_FAILED' && !error.message.includes('private dialog details'));
  await assert.rejects(answerKeyboardChallenge(() => [], { ...request, prompts: [{ prompt: 'bad', echo: 'yes' }] }, signal), { code: 'INVALID_AUTH_CHALLENGE' });
});

test('Abort releases pending keyboard prompt and ignores late answers', async () => {
  const controller = new AbortController(); let answer;
  const pending = answerKeyboardChallenge(() => new Promise(resolve => { answer = resolve; }), request, controller.signal);
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' }); answer(['late']);
  await assert.rejects(answerKeyboardChallenge(() => ['late'], request, controller.signal), { name: 'AbortError' });
});
