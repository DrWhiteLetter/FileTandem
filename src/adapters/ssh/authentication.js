import { isAbsolute } from 'node:path';
export class AuthenticationError extends Error {
  constructor(code, message) { super(message); this.name = 'AuthenticationError'; this.code = code; }
}
export function agentAddress(value, platform = process.platform) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f\x7f]/.test(value)) throw new AuthenticationError('INVALID_AGENT', 'Ungültiger SSH-Agent-Pfad.');
  if (platform === 'win32') {
    if (!/^[/\\][/\\]\.[/\\]pipe[/\\][^/\\]+$/.test(value)) {
      throw new AuthenticationError('UNSUPPORTED_AGENT', 'Unter Windows ist nur ein expliziter OpenSSH-Agent-Named-Pipe-Pfad vorgesehen; Pageant/Cygwin sind nicht paketiert.');
    }
  } else if (!isAbsolute(value)) throw new AuthenticationError('INVALID_AGENT', 'SSH-Agent benötigt einen expliziten absoluten Unix-Socket-Pfad.');
  return value;
}
export function authenticationOptions(config) {
  for (const field of ['password', 'passphrase']) if (config[field] !== undefined && typeof config[field] !== 'string') throw new AuthenticationError('INVALID_AUTH_CONFIG', 'Passwort und Passphrase müssen Strings sein.');
  if (config.privateKey !== undefined && !(typeof config.privateKey === 'string' || Buffer.isBuffer(config.privateKey))) throw new AuthenticationError('INVALID_AUTH_CONFIG', 'Privater Schlüssel muss String oder Buffer sein.');
  if (config.keyboardInteractive !== undefined && typeof config.keyboardInteractive !== 'function') throw new AuthenticationError('INVALID_AUTH_CONFIG', 'Keyboard-Interactive benötigt einen Antwort-Callback.');
  return { privateKey: config.privateKey, password: config.password, passphrase: config.passphrase,
    agent: config.agent === undefined ? undefined : agentAddress(config.agent),
    tryKeyboard: config.keyboardInteractive !== undefined, agentForward: false };
}
/** Replies remain in memory; no logging, storage or automatic password response. */
export async function answerKeyboardChallenge(callback, request, signal) {
  signal.throwIfAborted();
  const { name, instructions, language, prompts } = request;
  if (![name, instructions, language].every(value => typeof value === 'string' && value.length <= 16384)
    || !Array.isArray(prompts) || prompts.length > 32
    || prompts.some(item => !item || typeof item.prompt !== 'string' || item.prompt.length > 4096 || typeof item.echo !== 'boolean')) {
    throw new AuthenticationError('INVALID_AUTH_CHALLENGE', 'Ungültige oder zu große Keyboard-Interactive-Abfrage.');
  }
  // PAM can send an empty final challenge. It needs an empty acknowledgement,
  // not a UI question. Multiple nonempty rounds still go through the callback.
  if (prompts.length === 0) return [];
  let abort;
  try {
    const answers = await Promise.race([
      Promise.resolve().then(() => callback({ ...request, prompts: prompts.map(item => ({ ...item })), signal })),
      new Promise((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }); }),
    ]);
    signal.throwIfAborted();
    if (!Array.isArray(answers) || answers.length !== prompts.length || answers.some(value => typeof value !== 'string' || value.length > 4096)) {
      throw new AuthenticationError('INVALID_AUTH_RESPONSE', 'Keyboard-Interactive-Antworten fehlen oder sind ungültig.');
    }
    return answers;
  } catch (error) {
    if (signal.aborted || error instanceof AuthenticationError) throw error;
    throw new AuthenticationError('AUTH_PROMPT_FAILED', 'Keyboard-Interactive-Antwortdialog fehlgeschlagen.');
  } finally { if (abort) signal.removeEventListener('abort', abort); }
}
