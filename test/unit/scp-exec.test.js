import test from 'node:test';import assert from 'node:assert/strict';import { Readable } from 'node:stream';import { withExec } from '../../src/adapters/scp/exec.js';
test('fast exec exit status is observed even in the same callback turn as channel creation',async () => {
 const session={closed:new Promise(() => {}),close:async () => {},exec:(_,options,callback) => {assert.equal(options.pty,false);const channel=Readable.from([Buffer.from('ok')],{objectMode:false});channel.stderr=Readable.from([]);channel.end=() => {};channel.close=() => {};callback(null,channel);channel.emit('exit',0);}};
 assert.equal(await withExec(session,'safe-command',async channel => {let text='';for await (const chunk of channel) text+=chunk;return text;},{closeSession:false}),'ok');
});
