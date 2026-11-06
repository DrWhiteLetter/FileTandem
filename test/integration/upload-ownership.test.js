import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash,randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {releaseFixture,fixturePort} from '../helpers/release-fixture.mjs';
import {openRemoteFiles,targetFor} from '../../src/application/remote-files.js';
import {TransferEngine} from '../../src/application/transfer-engine.js';
for(const protocol of ['sftp','scp']) test(`${protocol}: optional ownership guard blocks replacement of a root-owned file, default mode preserves existing behavior`,{timeout:30000},async()=>{
 const fixtureRoot=fileURLToPath(new URL('../fixtures/ssh/',import.meta.url)),owner=createHash('sha256').update(fixtureRoot).digest('hex').slice(0,12),container=`xscp-ssh-${owner}-${protocol==='scp'?'scp':'sftp-only'}`;
 const docker=args=>{const result=spawnSync('docker',[...(process.env.XSCP_DOCKER_CONTEXT?['--context',process.env.XSCP_DOCKER_CONTEXT]:[]),...args],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 assert.equal(docker(['inspect','--format','{{index .Config.Labels "de.xscp.fixture-owner"}}',container]),owner);
 const session=await releaseFixture(protocol),files=await openRemoteFiles(session,protocol),target=targetFor(files),directory=await mkdtemp(join(tmpdir(),'filetandem-owner-')),name='owner-'+randomUUID(),local=join(directory,name),remote='/data/'+name;
 const profile={id:'ownership-test',host:'127.0.0.1',port:fixturePort(protocol),username:'fixture',protocol};let enabled=true;
 const engine=new TransferEngine({getCheckUploadOwnership:()=>enabled,sessions:{transport:()=>session},profiles:{get:()=>profile},choose:async()=>({choice:'replace'})});
 try {
  await writeFile(local,'new');
  docker(['exec','--user','0',container,'sh','-c','printf old > "$1"; chown 0:0 "$1"; chmod 644 "$1"','fixture-test',remote]);
  assert.equal((await files.stat(remote)).uid,0);assert.equal((await files.stat(remote)).gid,0);
  const submit=async()=>{const batch=await engine.submit(profile.id,'upload',[local],'/data');await engine.queue.idle();return engine.queue.list().find(job=>job.id===batch.ids[0]);};
  const blocked=await submit();assert.equal(blocked.state,'failed');assert.equal(blocked.errorCode,'UPLOAD_OWNERSHIP_CHANGED');assert.equal((await files.stat(remote)).uid,0);assert.equal((await files.stat(remote)).size,3);assert.equal(await target.hash(remote),createHash('sha256').update('old').digest('hex'));
  await engine.cleanup(blocked.id);
  enabled=false;const allowed=await submit();assert.equal(allowed.state,'completed');assert.notEqual((await files.stat(remote)).uid,0);assert.equal(await target.hash(remote),createHash('sha256').update('new').digest('hex'));
  enabled=true;assert.equal((await submit()).state,'completed','same owner/group allowed when enabled');
 } finally {engine.dispose();await target.remove(remote).catch(()=>{});files.close();await session.close();await rm(directory,{recursive:true,force:true});}
});
