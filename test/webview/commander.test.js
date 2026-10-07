import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const result = await build({ entryPoints:['test/webview/harness.jsx'],bundle:true,outdir:'out/webview-test',write:false,format:'iife',jsx:'automatic',platform:'browser' });
test('Rendered Commander: selection, folders, filter, safe names, queue and all demo states', async () => {
  const dom = new JSDOM('<meta name="xscp-session" content="demo-session"><div id="root"></div>',{runScripts:'outside-only',url:'https://xscp.test'});
  const messages=[];
  // jsdom lacks the browser MessageChannel used by React's act scheduler.
  dom.window.MessageChannel = class { constructor() { this.port1 = {onmessage:null}; this.port2 = {postMessage: () => setTimeout(() => this.port1.onmessage?.(),0)}; } };
  dom.window.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.eval(result.outputFiles.find(f => f.path.endsWith('.js')).text);
  await dom.window.testMount({postMessage: message => messages.push(message)},'demo-session');
  const act = action => dom.window.testAct(action);
  const render = async scenario => { await act(() => dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:dom.window.JSON.parse(JSON.stringify({version:1,type:'model',id:'response',sessionId:'demo-session',location:{local:true,remoteWindow:false},scenario}))}))); };
  await render('ready');
  const doc=dom.window.document;
  assert.equal(messages[0].type,'ready'); assert.equal(doc.querySelectorAll('.pane').length,2);
  assert.ok(doc.body.textContent.includes('<img src=x onerror=alert(1)>.txt')); assert.equal(doc.querySelector('img'),null);
  const row = [...doc.querySelectorAll('.pane:first-child tbody tr')].find(r => r.textContent.includes('README'));
  await act(() => row.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}))); assert.equal(row.getAttribute('aria-selected'),'true');
  await act(() => doc.querySelector('.pane tbody tr').dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true}))); assert.ok(doc.querySelector('.path').textContent.endsWith('/assets'));
  await act(() => doc.querySelector('.queue-toggle').click()); assert.equal(doc.querySelector('.queue table'),null);
  for (const [mode,text] of [['loading','wird geladen'],['empty','ist leer'],['error','Keine Berechtigung'],['disconnected','Nicht verbunden']]) { await render(mode); assert.ok(doc.body.textContent.includes(text)); }
  dom.window.close();
});
