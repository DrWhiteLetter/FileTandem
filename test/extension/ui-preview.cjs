// Isolated visual QA only: renders the production bundle with synthetic data.
const vscode=require('vscode');
const fs=require('node:fs/promises');
const path=require('node:path');
exports.activate=async context => {
  const root=context.extensionPath,sessionId='ui-preview',panel=vscode.window.createWebviewPanel('filetandem.ui-preview','FileTandem · Commander',vscode.ViewColumn.One,{enableScripts:true,localResourceRoots:[vscode.Uri.file(path.join(root,'dist'))]});
  const uri=file => panel.webview.asWebviewUri(vscode.Uri.file(path.join(root,'dist',file)));
  const source='/Users/demo/Projekte/Website',target='/var/www/vhosts/beispiel.de/httpdocs/Website';
  const entry=(root,name,kind='file',size=1280) => ({id:root+'/'+name,path:root+'/'+name,name,kind,size,modified:1793170000000,mode:0o644});
  const entries=root => [entry(root,'assets','directory'),entry(root,'components','directory'),entry(root,'.gitignore'),entry(root,'index.html'),entry(root,'README.md'),entry(root,'stylesheet-mit-einem-sehr-langen-dateinamen.css'),entry(root,'test1.txt','file',0),entry(root,'test2.txt','file',0)];
  const job=(id,state,name,extra={}) => ({id,source:source+'/'+name,target:target+'/'+name,direction:'upload',state,bytes:12288,rate:state==='running' ? 163840:0,committed:state==='completed',...extra});
  const base={version:1,type:'browserModel',sessionId,locale:'de',commanderKeys:true,connection:{id:'preview',name:'beispiel.de',state:'connected',protocol:'sftp'},local:{path:source,status:'ready',entries:entries(source)},remote:{path:target,status:'ready',entries:entries(target)},queue:[job('older','completed','index.html',{attempt:{part:target+'/.part'}}),job('failed','failed','stylesheet-mit-einem-sehr-langen-dateinamen.css',{error:'Transfer fehlgeschlagen; Quelle/Ziel und Verbindung prüfen.',attempt:{part:target+'/.part'},protocol:'sftp'}),job('latest','completed','README.md')],pathFavorites:{local:[source],remote:[target]}};
  let current,ready=false,config={theme:'Default Dark Modern',scenario:'watch'};
  const publish=() => {current=structuredClone(base);current.locale=config.locale ?? 'de';
    if (config.scenario==='release') {
      for (const side of ['local','remote']) {const root=side==='local'?source:target;current[side].entries=[entry(root,'assets','directory'),entry(root,'src','directory'),entry(root,'docs','directory'),entry(root,'index.html','file',15229),entry(root,'style.css','file',20755),entry(root,'README.md','file',6432),entry(root,'LICENSE','file',1086)];}
      current.queue=[job('index','completed','index.html',{batchId:'demo-upload',protocol:'sftp',verification:'size',bytes:15229}),job('styles','completed','style.css',{batchId:'demo-upload',protocol:'sftp',verification:'size',bytes:20755}),job('logo','queued','assets/logo.svg',{batchId:'demo-upload',protocol:'sftp',bytes:0}),job('image','running','assets/hero.webp',{batchId:'demo-upload',protocol:'sftp',bytes:524288,rate:262144})];
    }
    if (config.scenario==='watch') current.autoUpload={active:true,starting:false,localRoot:source,remoteRoot:target,uploaded:2,deleted:5};
    if (config.scenario==='starting') current.autoUpload={active:false,starting:true,localRoot:source,remoteRoot:target,uploaded:0,deleted:0};
    if (config.scenario==='loading') current.remote.status='loading';
    if (config.scenario==='empty') {current.local.entries=[];current.remote.entries=[];current.queue=[];}
    if (config.scenario==='error') {current.remote.status='error';current.remote.error='Keine Berechtigung für diesen Ordner.';current.autoUpload={active:false,error:'Remote-Datei wurde geändert; keine automatische Löschung.'};}
    if (config.scenario==='disconnected') {current.connection.state='disconnected';current.remote.status='disconnected';current.remote.entries=[];}
    if (config.scenario==='running') current.queue.push(job('active','running','large-video.mp4'),job('waiting','queued','assets/logo.svg'));
    if (ready) void panel.webview.postMessage(current);
  };
  panel.webview.onDidReceiveMessage(async message => {
    if (message.type==='ready') {ready=true;publish();}
    else if (message.type==='previewProbe') await fs.writeFile(path.join(root,'probe.json'),JSON.stringify({config,...message.result},null,2));
    else if (message.type==='autoUploadStop') {config.scenario='ready';publish();}
    else if (message.type==='autoUploadStart') {config.scenario='watch';publish();}
    else if (message.type==='queuePause') {base.queuePaused=message.paused;publish();}
  },null,context.subscriptions);
  const nonce='filetandem-isolated-visual-preview';
  panel.webview.html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="filetandem-session" content="${sessionId}"><meta name="filetandem-mode" content="browser"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; font-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${uri('webview.css')}"></head><body><div id="root"></div><script nonce="${nonce}">const original=acquireVsCodeApi;let previewBridge;window.acquireVsCodeApi=()=>previewBridge=original();setInterval(()=>{if(!previewBridge||!document.querySelector('.panes'))return;const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};const samples=['body','.pane-title','.pane footer','.watch-counts','.queue-footer','button.primary','button:not(:disabled)','.sort-button','.transfer-state.state-failed','.error-message','.count-badge'].map(selector=>{const e=document.querySelector(selector);if(!e)return null;const c=getComputedStyle(e);let parent=e,bg=c.backgroundColor;while(bg==='rgba(0, 0, 0, 0)'&&parent.parentElement){parent=parent.parentElement;bg=getComputedStyle(parent).backgroundColor;}return {selector,color:c.color,background:bg,disabled:e.matches(':disabled'),fontSize:c.fontSize,...rect(e)};});previewBridge.postMessage({type:'previewProbe',result:{theme:document.body.className,width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,samples,rows:[...document.querySelectorAll('tr[data-entry-id]')].slice(0,2).map(rect),panes:[...document.querySelectorAll('.file-scroll')].map(rect)}});},750);</script><script nonce="${nonce}" src="${uri('webview.js')}"></script></body></html>`;
  let previous='';
  const tick=async () => {try {const raw=await fs.readFile(path.join(root,'control.json'),'utf8');if(raw===previous)return;previous=raw;config=JSON.parse(raw);await vscode.workspace.getConfiguration('workbench').update('colorTheme',config.theme,vscode.ConfigurationTarget.Global);publish();} catch(error) {console.error(error);}};
  await tick();const timer=setInterval(tick,500);context.subscriptions.push(panel,{dispose:()=>clearInterval(timer)});panel.onDidDispose(()=>clearInterval(timer));
};
