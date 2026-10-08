import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp,mkdir,open,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { releaseFixture } from '../test/helpers/release-fixture.mjs';
import { openRemoteFiles,targetFor,streamFor } from '../src/application/remote-files.js';
import { streamFile } from '../src/adapters/sftp/pipeline.js';
import { transferFile } from '../src/application/transfer-file.js';
import { localTarget } from '../src/adapters/local/transfer-target.js';
if (process.platform!=='darwin') throw new Error('Local ENOSPC test uses a private macOS disk image; other desktop platforms need their own filesystem fixture.');
const directory=await mkdtemp(join(tmpdir(),'filetandem-enospc-')),mount=join(directory,'volume'),image=join(directory,'full.dmg');
const run=args => {const result=spawnSync('hdiutil',args,{encoding:'utf8',timeout:60000});if (result.error || result.status!==0) throw result.error ?? new Error(result.stderr);return result.stdout;};
let attached=false;
try {
  await mkdir(mount);run(['create','-size','16m','-fs','HFS+','-volname','FileTandem-M6','-quiet',image]);
  run(['attach','-nobrowse','-mountpoint',mount,'-quiet',image]);attached=true;
  const source=join(directory,'source'),handle=await open(source,'wx');try {await handle.truncate(32*1024**2);await handle.write(Buffer.from('M6 ENOSPC marker'));} finally {await handle.close();}
  for (const protocol of ['sftp','scp']) {
    const session=await releaseFixture(protocol),files=await openRemoteFiles(session,protocol),target=targetFor(files),remote='/data/m6-full-'+randomUUID();
    const stream=streamFor(protocol) ?? streamFile,id=randomUUID(),destination=join(mount,'destination');
    try {
      await stream(session,{direction:'upload',local:source,remote});await writeFile(destination,'old destination');
      let failure;try {await transferFile(session,{id,direction:'download',source:remote,target:destination},{target:localTarget,replace:true,stream});} catch(error) {failure=error;}
      assert.ok(failure,'Download really fails on the small mounted volume');assert.equal(failure.code,'ENOSPC');assert.equal(await readFile(destination,'utf8'),'old destination');
      await rm(localTarget.partial(destination,id),{force:true});await rm(destination);
      console.log('M6 local mounted-volume ENOSPC: '+protocol+' preserves existing destination.');
    } finally {await target.remove(remote).catch(() => {});files.close();await session.close();}
  }
} finally {if (attached) run(['detach','-quiet',mount]);await rm(directory,{recursive:true,force:true});}
