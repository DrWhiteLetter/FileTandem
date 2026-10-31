import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,copyFile,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('localization check accepts Windows line endings and still rejects stale translations',async t => {
  const root=await mkdtemp(join(tmpdir(),'filetandem-l10n-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'scripts'));await mkdir(join(root,'l10n'));
  await copyFile(new URL('../../scripts/sync-localization.mjs',import.meta.url),join(root,'scripts/sync-localization.mjs'));
  await writeFile(join(root,'l10n/source-messages.json'),JSON.stringify({'Hallo':'Hello'}));
  const run=(...args) => spawnSync(process.execPath,['scripts/sync-localization.mjs',...args],{cwd:root,encoding:'utf8'});
  assert.equal(run().status,0);
  for(const name of ['bundle.l10n.json','bundle.l10n.de.json']) {
    const path=join(root,'l10n',name);
    await writeFile(path,(await readFile(path,'utf8')).replace(/\n/g,'\r\n'));
  }
  const windows=run('--check');assert.equal(windows.status,0,windows.stderr);
  await writeFile(join(root,'l10n/bundle.l10n.de.json'),'{}\r\n');
  const stale=run('--check');assert.notEqual(stale.status,0);assert.match(stale.stderr,/Outdated localization bundle: bundle.l10n.de.json/);
});
