import test from 'node:test';import assert from 'node:assert/strict';import { readFile } from 'node:fs/promises';
import { translate } from '../../src/shared/localization.js';import { english } from '../../src/shared/translations.js';
test('German/English catalog preserves placeholders and localizes dialogs without changing unknown filenames',async () => {
 for (const [source,target] of Object.entries(english)) {assert.ok(target);assert.deepEqual([...source.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(),[...target.matchAll(/\{\d+\}/g)].map(m => m[0]).sort());assert.equal(translate(source,'de'),source);}
 assert.equal(translate('FileTandem: Rechte für a.txt (oktal, z. B. 644)','en'),'FileTandem: Permissions for a.txt (octal, e.g. 644)');assert.equal(translate('FileTandem: Nicht verbunden.','en'),'FileTandem: Not connected.');assert.equal(translate('/home/Größe ä.txt','en'),'/home/Größe ä.txt');
 const manifest=JSON.parse(await readFile('package.json')),en=JSON.parse(await readFile('package.nls.json')),de=JSON.parse(await readFile('package.nls.de.json'));assert.deepEqual(Object.keys(en).sort(),Object.keys(de).sort());
 const walk=value => {if (typeof value==='string') {const match=/^%([^%]+)%$/.exec(value);if (match) assert.ok(en[match[1]] && de[match[1]],value);}else if (value && typeof value==='object') Object.values(value).forEach(walk);};walk(manifest);assert.ok(manifest.contributes.commands.every(c => c.title.startsWith('%')));
});

test('VS Code language bundles contain every English message and matching placeholders',async () => {
 const en=JSON.parse(await readFile('l10n/bundle.l10n.json','utf8'));
 const de=JSON.parse(await readFile('l10n/bundle.l10n.de.json','utf8'));
 const manifest=JSON.parse(await readFile('package.json','utf8'));
 assert.equal(manifest.l10n,'./l10n');
 assert.equal(manifest.contributes.configuration.properties['filetandem.language'].default,'auto');
 assert.deepEqual(Object.keys(en).sort(),Object.keys(de).sort());
 for (const [key,value] of Object.entries(en)) {
  assert.equal(key,value,'English is the default source language');assert.ok(de[key]);
  assert.deepEqual([...key.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...de[key].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),key);
 }
 for (const value of Object.values(english)) assert.ok(Object.hasOwn(en,value),value);
 const {translate,resolveLanguage}=await import('../../src/shared/localization.js');
 assert.equal(resolveLanguage('de-CH'),'de');assert.equal(resolveLanguage('fr'),'en');
 assert.equal(translate(`${translate('Local','de')}: Name filter`,'de'),'Lokal: Namensfilter');
 assert.equal(translate('Remote file was changed; automatic deletion was prevented.','de'),'Remote-Datei wurde geändert; keine automatische Löschung.');
 assert.equal(translate('Remote-Datei wurde geändert; keine automatische Löschung.','en'),'Remote file was changed; automatic deletion was prevented.');
});
