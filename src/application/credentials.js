import { agentAddress } from '../adapters/ssh/authentication.js';
import { secretReference } from '../domain/profile.js';
/** Secret values live only here/in the connector, never in profiles or messages. */
export async function credentialsFor(profile,{secrets,prompt,readKey,encrypted,signal,keyboardPrompt}) {
  const config={host:profile.host,port:profile.port,username:profile.username,readyTimeout:30000};
  let key,remember;
  const check=() => signal?.throwIfAborted();
  const obtain=async kind => {
    check(); const reference=secretReference(profile.id,kind);
    let value=await secrets.get(reference); check();
    if (value === undefined) {
      const answer=await prompt(kind,profile,signal); check();
      if (!answer) throw Object.assign(new Error('Anmeldung abgebrochen.'),{code:'CONNECTION_ABORTED'});
      value=answer.value;
      if (typeof value !== 'string') throw new Error('Ungültige Anmeldung.');
      if (answer.remember) remember={reference,value};
    }
    return value;
  };
  try {
    if (profile.auth === 'password') config.password=await obtain('password');
    if (profile.auth === 'key') {
      key=await readKey(profile.keyPath); check(); config.privateKey=key;
      if (encrypted(key)) config.passphrase=await obtain('passphrase');
    }
    if (profile.auth === 'agent') config.agent=agentAddress(profile.agentPath);
    if (profile.auth==='interactive') {if (typeof keyboardPrompt!=='function') throw new Error('Interaktive Anmeldung ist nicht verfügbar.');config.keyboardInteractive=request => keyboardPrompt(profile,request);}
    check();
    return {config,commit:async () => {check(); if (remember) await secrets.store(remember.reference,remember.value);},
      dispose:() => {key?.fill(0); delete config.password; delete config.passphrase; delete config.privateKey; delete config.keyboardInteractive; remember=undefined;}};
  } catch(error) { key?.fill(0); throw error; }
}
export async function forgetCredentials(id,secrets) {
  await secrets.delete(secretReference(id,'password')); await secrets.delete(secretReference(id,'passphrase'));
}
