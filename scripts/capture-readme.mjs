// Capture the current production webview with disposable, synthetic fixture data.
// No server, user profile or real file transfer is used by this visual fixture.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,cp,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const executable=process.env.VSCODE_TEST_EXECUTABLE??'/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const output=resolve(process.argv[2]??'out/readme-preview.png');
const root=await mkdtemp(join(tmpdir(),'filetandem-readme-')),harness=join(root,'extension'),user=join(root,'user'),extensions=join(root,'extensions');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('VSCODE_')&&key!=='ELECTRON_RUN_AS_NODE'));
let child,closed,ws;
async function wait(check){const deadline=Date.now()+30000;while(Date.now()<deadline){const result=await check();if(result)return result;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Screenshot fixture timed out.');}
try {
 const built=spawnSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});assert.equal(built.status,0);
 for(const directory of [harness,join(user,'User'),extensions])await mkdir(directory,{recursive:true});
 await cp('dist',join(harness,'dist'),{recursive:true});await copyFile('test/extension/ui-preview.cjs',join(harness,'main.cjs'));
 await writeFile(join(harness,'package.json'),JSON.stringify({name:'readme-preview',publisher:'filetandem-test',version:'0.0.1',engines:{vscode:'^1.140.0'},main:'main.cjs',activationEvents:['onStartupFinished']}));
 await writeFile(join(harness,'control.json'),JSON.stringify({theme:'Default Dark Modern',scenario:'release',locale:'de'}));
 await writeFile(join(user,'User/settings.json'),JSON.stringify({'workbench.startupEditor':'none','window.restoreWindows':'none','security.workspace.trust.enabled':false,'workbench.colorTheme':'Default Dark Modern','window.zoomLevel':0,'workbench.activityBar.location':'hidden','workbench.statusBar.visible':false,'update.mode':'none'}));
 child=spawn(executable,['--user-data-dir',user,'--extensions-dir',extensions,'--extensionDevelopmentPath='+harness,'--new-window','--skip-welcome','--skip-release-notes','--disable-updates','--remote-debugging-port=0'],{env,stdio:'ignore'});closed=new Promise(resolve=>child.once('exit',resolve));
 const port=await wait(async()=>{try{return Number((await readFile(join(user,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return;}});
 const page=await wait(async()=>{const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();return pages.find(value=>value.type==='page'&&value.url.includes('workbench'));});
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
 let next=0;const pending=new Map();
 ws.addEventListener('message',event=>{const message=JSON.parse(event.data);const call=pending.get(message.id);if(!call)return;pending.delete(message.id);message.error?call.reject(new Error(JSON.stringify(message.error))):call.resolve(message.result);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1200,deviceScaleFactor:1,mobile:false});
 await wait(async()=>{try{const probe=JSON.parse(await readFile(join(harness,'probe.json'),'utf8'));return probe.width>=1400&&probe.rows.length>0&&probe;}catch{return;}});
 // Read the fixture frame bounds and capture pixels; no UI input is injected.
 const bounds=await call('Runtime.evaluate',{expression:"(()=>{const frame=[...document.querySelectorAll('iframe')].find(frame=>frame.src.startsWith('vscode-webview:'));if(!frame)return null;const r=frame.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()",returnByValue:true});
 assert.ok(bounds.result.value,'Production webview frame is visible');
 const shot=await call('Page.captureScreenshot',{format:'png',clip:bounds.result.value,captureBeyondViewport:false});
 await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,Buffer.from(shot.data,'base64'));
 console.log('Production webview screenshot with synthetic data: '+output);
} finally {ws?.close();if(child&&child.exitCode===null)child.kill('SIGTERM');if(closed)await closed;await rm(root,{recursive:true,force:true});}
