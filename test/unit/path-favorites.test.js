import test from 'node:test';
import assert from 'node:assert/strict';
import { pathFavorites } from '../../src/application/path-favorites.js';
import { browserRequest } from '../../src/shared/browser-messages.js';
test('path favorites survive new sessions and keep remote profiles separate',async () => {
  const data=new Map();const storage={get:key => data.get(key),update:async (key,value) => {data.set(key,structuredClone(value));}};
  const first=pathFavorites(storage);
  await Promise.all([first.set('local','server-a','/tmp',true),first.set('remote','server-a','/var/www',true),first.set('remote','server-b','/home',true)]);
  const restarted=pathFavorites(storage);
  assert.deepEqual(restarted.get('server-a'),{local:['/tmp'],remote:['/var/www']});
  assert.deepEqual(restarted.get('server-b'),{local:['/tmp'],remote:['/home']});
  await restarted.set('remote','server-a','/var/www',false);
  assert.deepEqual(pathFavorites(storage).get('server-a').remote,[]);
  assert.deepEqual(restarted.get('server-b').remote,['/home']);
});
test('favorite messages validate paths, sessions and intent',() => {
  const message={version:1,type:'pathFavorite',id:'request',sessionId:'session',side:'local',path:'/tmp',favorite:true};
  assert.equal(browserRequest(message,'session'),true);
  for (const change of [{side:'other'},{path:''},{path:'/tmp\0'},{favorite:'yes'},{profileId:'other'}]) assert.equal(browserRequest({...message,...change},'session'),false);
  assert.equal(browserRequest(message,'other'),false);
});
