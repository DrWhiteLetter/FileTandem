import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateNamespace } from '../../src/application/namespace-migration.js';
function fixture() {
  const values=new Map([['xscp.commanderKeys',true],['xscp.language','en']]);
  const state=new Map([['xscp.profiles.v1',{version:1,profiles:[{id:'p'}]}],['xscp.host-key.v1.hash',{key:'trusted'}],['xscp.editorCopies.v1',['copy']]]);
  const secrets=new Map([['xscp.profile.p.password','sentinel'],['xscp.journal.integrity.v1','integrity']]);
  const context={globalState:{get:k=>state.get(k),keys:()=>[...state.keys()],update:async(k,v)=>v===undefined?state.delete(k):state.set(k,v)},secrets:{get:async k=>secrets.get(k),store:async(k,v)=>secrets.set(k,v),delete:async k=>secrets.delete(k)}};
  const workspace={getConfiguration:()=>({inspect:k=>({globalValue:values.get(k)}),update:async(k,v)=>v===undefined?values.delete(k):values.set(k,v)})};
  return {values,state,secrets,context,workspace};
}
test('namespace migration preserves settings, profiles, trust, copies and journal key; idempotent',async()=>{
 const f=fixture();await migrateNamespace(f.context,f.workspace,1);assert.equal(f.values.get('filetandem.commanderKeys'),true);assert.equal(f.values.get('filetandem.language'),'en');assert.equal(f.secrets.get('filetandem.profile.p.password'),'sentinel');assert.equal(f.secrets.get('filetandem.journal.integrity.v1'),'integrity');assert.deepEqual(f.state.get('filetandem.host-key.v1.hash'),{key:'trusted'});assert.deepEqual(f.state.get('filetandem.editorCopies.v1'),['copy']);assert.equal(f.state.get('filetandem.profiles.v1').profiles[0].id,'p');assert.ok([...f.values.keys(),...f.state.keys(),...f.secrets.keys()].every(k=>!k.startsWith('xscp.')));await migrateNamespace(f.context,f.workspace,1);assert.equal(f.secrets.get('filetandem.profile.p.password'),'sentinel');
});
test('explicit new settings, profiles and credentials win over legacy values',async()=>{
 const f=fixture();f.values.set('filetandem.commanderKeys',false);f.state.set('filetandem.profiles.v1',{version:1,profiles:[{id:'new'}]});f.secrets.set('filetandem.profile.p.password','new secret');await migrateNamespace(f.context,f.workspace,1);assert.equal(f.values.get('filetandem.commanderKeys'),false);assert.equal(f.secrets.get('filetandem.profile.p.password'),'new secret');assert.equal(f.state.get('filetandem.profiles.v1').profiles[0].id,'new');
});
test('failed secret write retains legacy credential and profile for a later retry',async()=>{
 const f=fixture();f.context.secrets.store=async()=>{throw new Error('storage unavailable');};await assert.rejects(migrateNamespace(f.context,f.workspace,1),/storage unavailable/);assert.equal(f.secrets.get('xscp.journal.integrity.v1'),'integrity');assert.ok(f.state.has('xscp.profiles.v1'));
});
test('manifest exposes only new settings, commands and editor menu schemes',async()=>{
 const {readFile}=await import('node:fs/promises');const manifest=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
 assert.ok(Object.keys(manifest.contributes.configuration.properties).every(k=>k.startsWith('filetandem.')));
 assert.ok(manifest.contributes.commands.every(c=>c.command.startsWith('filetandem.')));
 assert.ok(manifest.contributes.views.filetandem);
 for(const entries of Object.values(manifest.contributes.menus))for(const item of entries)assert.ok(!/\bxscp\b/.test(item.when??''),'menu guards match new URI schemes and view IDs');
});
