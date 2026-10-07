import * as vscode from 'vscode';
import ssh2 from 'ssh2';
import { readFile,stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { credentialsFor,forgetCredentials } from '../application/credentials.js';
export function credentialProvider(context,profileUI) {
  const provider=(profile,signal) => credentialsFor(profile,{
    secrets:context.secrets,signal,
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
      const choice=await vscode.window.showQuickPick(['Nur für diese Verbindung','Im sicheren VS-Code-Speicher merken'],{title:'Zugang speichern?'});
      if (!choice) return undefined;
      return {value,remember:choice === 'Im sicheren VS-Code-Speicher merken'};
    },
  });
  profileUI.command('xscp.forgetCredentials',async () => {const p=await profileUI.choose(); if (p) await forgetCredentials(p.id,context.secrets);});
  const originalDelete=profileUI.profiles.delete.bind(profileUI.profiles);
  profileUI.profiles.delete=async id => {await forgetCredentials(id,context.secrets); return originalDelete(id);};
  return provider;
}
