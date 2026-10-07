import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDesktopAccess, requireDesktopAccess } from '../../src/application/access-policy.js';
test('Trust und lokaler Host sind vor Netzwerk-/Schreibeffekten beide notwendig', () => {
  let effects = 0;
  const execute = (local, trusted) => { requireDesktopAccess({ local }, trusted); effects++; };
  for (const args of [[false, false], [false, true], [true, false], [true, undefined], [undefined, true]]) assert.throws(() => execute(...args));
  assert.equal(effects, 0);
  assert.equal(hasDesktopAccess({ local: true }, 'true'), false);
  execute(true, true); assert.equal(effects, 1);
});
