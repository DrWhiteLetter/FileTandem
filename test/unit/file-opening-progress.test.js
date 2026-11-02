import test from 'node:test';
import assert from 'node:assert/strict';
import { registerFileOpeningProgress } from '../../src/vscode/file-opening-progress.js';

test('text files share opening feedback; concurrent files and failures clear independently',async()=>{
  const status={visible:false,show(){this.visible=true;},hide(){this.visible=false;},dispose(){this.visible=false;}};
  const context={subscriptions:[]};let changes=0;
  const progress=registerFileOpeningProgress(context,{vscode:{StatusBarAlignment:{Left:1},window:{createStatusBarItem:()=>status}},onChange:()=>changes++});
  const profile={id:'server',name:'Server'};let finish,fail;
  const php=progress.run(profile,'/index.php',report=>{report('Loading file …');return new Promise(resolve=>{finish=resolve;});});
  assert.equal(progress.state(profile,'/index.php'),'Opening file …');assert.equal(status.visible,true);
  assert.equal(progress.run(profile,'/index.php',()=>assert.fail('duplicate open')),php);
  const text=progress.run(profile,'/other.txt',()=>new Promise((_,reject)=>{fail=reject;}));
  await Promise.resolve();assert.match(status.text,/index.php.*Loading file/);assert.match(status.text,/\(\+1\)/);
  finish('opened');assert.equal(await php,'opened');assert.equal(progress.state(profile,'/index.php'),undefined);assert.equal(status.visible,true);assert.match(status.text,/other.txt/);
  const failed=assert.rejects(text,/read failed/);fail(new Error('read failed'));await failed;
  assert.equal(status.visible,false);assert.equal(progress.state(profile,'/other.txt'),undefined);assert.ok(changes>=5);
  context.subscriptions[0].dispose();await assert.rejects(progress.run(profile,'/closed.php',()=>{}),/closed/);
});
