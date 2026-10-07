import * as vscode from 'vscode';
import ssh2 from 'ssh2';
import { readFile,stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { credentialsFor,forgetCredentials } from '../application/credentials.js';
/** Native inputs respect server echo flags; answers are never persisted or logged. */
async function keyboardPrompt(profile,request) {
  const answers=[];
  for (const item of request.prompts) {
    request.signal.throwIfAborted();const box=vscode.window.createInputBox();box.title=`xScp: Anmeldung ${profile.name} (${request.endpoint.host}:${request.endpoint.port})`;box.prompt=[request.name,request.instructions,item.prompt].filter(Boolean).join(' · ');box.password=!item.echo;box.ignoreFocusOut=true;
    let value;try {value=await new Promise(resolve => {
      const accept=box.onDidAccept(() => resolve(box.value)),hide=box.onDidHide(() => resolve(undefined));const abort=() => {box.hide();resolve(undefined);};request.signal.addEventListener('abort',abort,{once:true});
      box.onDidHide(() => {accept.dispose();hide.dispose();request.signal.removeEventListener('abort',abort);});if (request.signal.aborted) abort();else box.show();
    });} finally {box.hide();box.dispose();}
    request.signal.throwIfAborted();if (value===undefined) throw new Error('Interaktive Anmeldung abgebrochen.');answers.push(value);
  }return answers;
}
export function credentialProvider(context,profileUI) {
  const provider=(profile,signal) => credentialsFor(profile,{
    secrets:context.secrets,signal,keyboardPrompt,
    readKey:async path => {
      if (!isAbsolute(path)) throw new Error('Der Schlüsselpfad muss lokal und absolut sein.');
      const info=await stat(path); if (!info.isFile() || info.size > 1024*1024) throw new Error('Ungültige oder zu große Schlüsseldatei.');
      return readFile(path);
    },
    encrypted:key => { const parsed=ssh2.utils.parseKey(key); if (parsed instanceof Error) { if (/encrypted|passphrase/i.test(parsed.message)) return true; throw new Error('Schlüsseldatei hat ein nicht unterstütztes Format.'); } return false; },
    prompt:async (kind,profile,signal) => {
      const box=vscode.window.createInputBox(); box.title=`xScp: ${kind === 'password' ? 'Passwort':'Schlüssel-Passphrase'} für ${profile.name}`; box.password=true; box.ignoreFocusOut=true;
      let value;
      try { value=await new Promise(resolve => {
        const accepted=box.onDidAccept(() => resolve(box.value)); const hidden=box.onDidHide(() => resolve(undefined));
        const abort=() => {box.hide(); resolve(undefined);}; signal?.addEventListener('abort',abort,{once:true});
        box.onDidHide(() => {accepted.dispose(); hidden.dispose(); signal?.removeEventListener('abort',abort);});
        if (signal?.aborted) abort(); else box.show();
      }); } finally {box.hide(); box.dispose();}
      if (value === undefined) return undefined;
      if (profile.ephemeral) return {value,remember:false};
      const choice=await vscode.window.showQuickPick(['Nur für diese Verbindung','Im sicheren VS-Code-Speicher merken'],{title:'Zugang speichern?'});
      if (!choice) return undefined;
      return {value,remember:choice === 'Im sicheren VS-Code-Speicher merken'};
    },
  });
  profileUI.command('xscp.forgetCredentials',async () => {const p=await profileUI.choose(); if (p) await forgetCredentials(p.id,context.secrets);});
  const originalDelete=profileUI.profiles.delete.bind(profileUI.profiles);
  profileUI.profiles.delete=async id => {await profileUI.sessions?.disconnect(id);await forgetCredentials(id,context.secrets); return originalDelete(id);};
  return provider;
}
