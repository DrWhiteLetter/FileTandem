import test from 'node:test';import assert from 'node:assert/strict';import { readFile } from 'node:fs/promises';
import { translate } from '../../src/shared/localization.js';import { english } from '../../src/shared/translations.js';
test('German/English catalog preserves placeholders and localizes dialogs without changing unknown filenames',async () => {
 for (const [source,target] of Object.entries(english)) {assert.ok(target);assert.deepEqual([...source.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(),[...target.matchAll(/\{\d+\}/g)].map(m => m[0]).sort());assert.equal(translate(source,'de'),source);}
 assert.equal(translate('FileTandem: Rechte für a.txt (oktal, z. B. 644)','en'),'FileTandem: Permissions for a.txt (octal, e.g. 644)');assert.equal(translate('FileTandem: Nicht verbunden.','en'),'FileTandem: Not connected.');assert.equal(translate('/home/Größe ä.txt','en'),'/home/Größe ä.txt');
 const manifest=JSON.parse(await readFile('package.json')),en=JSON.parse(await readFile('package.nls.json')),de=JSON.parse(await readFile('package.nls.de.json'));assert.deepEqual(Object.keys(en).sort(),Object.keys(de).sort());
 const walk=value => {if (typeof value==='string') {const match=/^%([^%]+)%$/.exec(value);if (match) assert.ok(en[match[1]] && de[match[1]],value);}else if (value && typeof value==='object') Object.values(value).forEach(walk);};walk(manifest);assert.ok(manifest.contributes.commands.every(c => c.title.startsWith('%')));
});
