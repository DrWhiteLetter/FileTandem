import test from 'node:test';
import assert from 'node:assert/strict';
import { DirectoryBrowser } from '../../src/application/directory-browser.js';
test('late responses never replace current directory, including failures and disconnect',async () => {
  const pending=new Map();const browser=new DirectoryBrowser({start:'/',parent:() => '/',list:path => new Promise((resolve,reject) => pending.set(path,{resolve,reject}))});
  const old=browser.navigate('/old');const current=browser.navigate('/current');pending.get('/current').resolve({path:'/current',entries:[]});await current;
  pending.get('/old').reject(new Error('Late error'));await old;assert.equal(browser.state.path,'/current');assert.equal(browser.state.status,'ready');
  const stale=browser.navigate('/stale');browser.invalidate();pending.get('/stale').resolve({path:'/stale',entries:[]});await stale;assert.equal(browser.state.status,'disconnected');
});
