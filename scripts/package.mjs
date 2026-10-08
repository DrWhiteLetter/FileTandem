import { spawnSync } from 'node:child_process';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const manifest = JSON.parse(await readFile('package.json','utf8'));
await mkdir('out',{recursive:true});
const target = join('out',`FileTandem-${manifest.version}.vsix`);
const run = (command,args) => {
  const result = spawnSync(command,args,{stdio:'inherit',shell:process.platform === 'win32' && command === 'npm'});
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed: ${result.status}`);
};
run(process.execPath,['scripts/build.mjs']);
run('npm',['exec','--yes','--package=@vscode/vsce@4.0.0','--','vsce','package','--no-dependencies','--allow-missing-repository','--no-rewrite-relative-links','--out',target]);
run('python3',['scripts/inspect-vsix.py',target]);
const sha256=createHash('sha256').update(await readFile(target)).digest('hex');
await writeFile(target+'.sha256',`${sha256}  FileTandem-${manifest.version}.vsix\n`);
console.log(`Installierbare private Demo: ${target}`);
