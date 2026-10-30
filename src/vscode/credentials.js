import { vscode,t } from './localized-vscode.js';
import ssh2 from 'ssh2';
import { readFile,stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { credentialsFor,forgetCredentials } from '../application/credentials.js';
/** Native inputs respect server echo flags; answers are never persisted or logged. */
async function keyboardPrompt(profile,request) {
  const answers=[];
  for (const item of request.prompts) {
    request.signal.throwIfAborted();const box=vscode.window.createInputBox();box.title=`FileTandem: Authentication ${profile.name} (${request.endpoint.host}:${request.endpoint.port})`;box.prompt=[request.name,request.instructions,item.prompt].filter(Boolean).join(' · ');box.password=!item.echo;box.ignoreFocusOut=true;
    let value;try {value=await new Promise(resolve => {
      const accept=box.onDidAccept(() => resolve(box.value)),hide=box.onDidHide(() => resolve(undefined));const abort=() => {box.hide();resolve(undefined);};request.signal.addEventListener('abort',abort,{once:true});
      box.onDidHide(() => {accept.dispose();hide.dispose();request.signal.removeEventListener('abort',abort);});if (request.signal.aborted) abort();else box.show();
    });} finally {box.hide();box.dispose();}
    request.signal.throwIfAborted();if (value===undefined) throw new Error("Interactive authentication cancelled.");answers.push(value);
  }return answers;
}
export function credentialProvider(context,profileUI) {
  const provider=(profile,signal) => credentialsFor(profile,{
    secrets:context.secrets,signal,keyboardPrompt,
    readKey:async path => {
      if (!isAbsolute(path)) throw new Error("The key path must be local and absolute.");
      const info=await stat(path); if (!info.isFile() || info.size > 1024*1024) throw new Error("Invalid or oversized key file.");
      return readFile(path);
    },
    encrypted:key => { const parsed=ssh2.utils.parseKey(key); if (parsed instanceof Error) { if (/encrypted|passphrase/i.test(parsed.message)) return true; throw new Error("Unsupported key file format."); } return false; },
    prompt:async (kind,profile,signal) => {
      const box=vscode.window.createInputBox(); box.title=`FileTandem: ${kind === 'password' ? t('Password'):t('Key passphrase')} for ${profile.name}`; box.password=true; box.ignoreFocusOut=true;
      let value;
      try { value=await new Promise(resolve => {
        const accepted=box.onDidAccept(() => resolve(box.value)); const hidden=box.onDidHide(() => resolve(undefined));
        const abort=() => {box.hide(); resolve(undefined);}; signal?.addEventListener('abort',abort,{once:true});
        box.onDidHide(() => {accepted.dispose(); hidden.dispose(); signal?.removeEventListener('abort',abort);});
        if (signal?.aborted) abort(); else box.show();
      }); } finally {box.hide(); box.dispose();}
      if (value === undefined) return undefined;
      if (profile.ephemeral) return {value,remember:false};
      const choice=await vscode.window.showQuickPick(["Only for this connection","Remember in secure VS Code storage"],{title:"Remember credentials?"});
      if (!choice) return undefined;
      return {value,remember:choice === "Remember in secure VS Code storage"};
    },
  });
  profileUI.command('filetandem.forgetCredentials',async () => {const p=await profileUI.choose(); if (p) await forgetCredentials(p.id,context.secrets);});
  const originalDelete=profileUI.profiles.delete.bind(profileUI.profiles);
  profileUI.profiles.delete=async id => {await profileUI.sessions?.disconnect(id);await forgetCredentials(id,context.secrets); return originalDelete(id);};
  return provider;
}
