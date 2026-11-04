import test from 'node:test';import assert from 'node:assert/strict';
import {filePolicy,isBackupPath,DEFAULT_EXCLUDED_NAMES} from '../../src/application/file-policy.js';
import {readFile} from 'node:fs/promises';
test('exclusions cover extensions, dotfiles, name globs and descendants without overmatching',()=>{
 const rules=filePolicy({excludedExtensions:['LOG','*.tar.gz'],excludedNames:['a.b','cache?','node_modules'],excludeHidden:true});
 for(const path of ['/project/app.LOG','/project/archive.tar.gz','/project/.secret','/project/.folder/a','/project/a.b','/project/cache1/a','C:\\project\\node_modules\\pkg.js']) assert.equal(rules.excludes(path,'file'),true,path);
 assert.equal(rules.excludes('/project/aXb','file'),false);assert.equal(rules.excludes('/project/catalog','file'),false);
 assert.equal(rules.excludes('/project/folder.log','directory'),false);assert.equal(rules.excludes('/project/cache12/file','file'),false);
 assert.throws(()=>filePolicy({excludedNames:['dir/file']}),/Invalid/);assert.throws(()=>filePolicy({excludedExtensions:['*']}),/Invalid/);
});
test('backup and partial names stay excluded even if all configurable rules are cleared',()=>{
 const rules=filePolicy({excludedNames:[],excludedExtensions:[],excludeHidden:false});
 for(const path of ['/site/config.php.bak','/site/config.php.bak.1','/site/old.BAK.23/a.js','/site/.xscp-owned-123.part']) assert.equal(rules.excludes(path),true,path);
 assert.equal(isBackupPath('/site/file.bak.2'),true);assert.equal(isBackupPath('/site/file.bak.js'),false);
 assert.equal(rules.excludes('/site/.env'),false,'user-controlled exclusions can be removed explicitly');
});
test('VS Code defaults agree with the backend exclusion and backup policy',async()=>{
 const props=Object.assign({},...JSON.parse(await readFile('package.json','utf8')).contributes.configuration.map(category=>category.properties));
 assert.deepEqual(props['filetandem.excludedNames'].default,DEFAULT_EXCLUDED_NAMES);
 assert.equal(props['filetandem.backupRemoteDeletes'].default,filePolicy().backupRemoteDeletes);
 assert.equal(filePolicy().excludes('/site/.env.production'),true);
});
