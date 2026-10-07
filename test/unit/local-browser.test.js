import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFiles,localFileUri } from '../../src/adapters/local/files.js';
import { DirectoryBrowser } from '../../src/application/directory-browser.js';
const uri=fsPath => ({scheme:'file',fsPath});
test('local browser without workspace: stat, symlinks, history, invalid URIs and missing paths',async () => {
  const root=await mkdtemp(join(tmpdir(),'xscp-browser-'));try {
    await mkdir(join(root,'child'));await writeFile(join(root,'a.txt'),'a');let hasLink=true;try {await symlink('a.txt',join(root,'link'));} catch(error) {if (process.platform !== 'win32' || !['EPERM','EACCES'].includes(error.code)) throw error;hasLink=false;}
    const files=new LocalFiles();const browser=new DirectoryBrowser({start:root,parent:value => join(value,'..'),list:path => files.list(uri(path))});
    await browser.refresh();if (hasLink) assert.equal(browser.state.entries.find(e => e.name === 'link').kind,'symlink');assert.equal((await files.stat(uri(join(root,'a.txt')))).size,1);
    if (process.platform !== 'win32') {await files.chmod(join(root,'a.txt'),0o640);assert.equal((await files.stat(uri(join(root,'a.txt')))).mode,0o640);if (hasLink) await assert.rejects(files.chmod(join(root,'link'),0o600));}
    await browser.navigate(join(root,'child'));await browser.back();assert.equal(browser.state.path,root);await browser.forward();assert.equal(browser.state.path,join(root,'child'));
    await browser.navigate(join(root,'missing'));assert.equal(browser.state.status,'error');assert.match(browser.state.error,/nicht gefunden/);
    assert.throws(() => localFileUri({scheme:'vscode-remote',fsPath:root}),/file:/);
    assert.throws(() => localFileUri({scheme:'file',authority:'remote',fsPath:root}),/file:/);
  } finally {await rm(root,{recursive:true,force:true});}
});
