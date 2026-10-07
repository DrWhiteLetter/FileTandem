import test from 'node:test';
import assert from 'node:assert/strict';
import { sortEntries } from '../../src/domain/file-entry.js';
test('Sortierung hält Ordner vorn, sortiert Zahlen numerisch und verändert die Quelle nicht', () => {
  const entries = [{ name: 'small', kind: 'file', size: 2 }, { name: 'folder', kind: 'directory', size: 0 }, { name: 'large', kind: 'file', size: 100 }];
  assert.deepEqual(sortEntries(entries, 'size', 'desc').map(e => e.name), ['folder', 'large', 'small']);
  assert.equal(entries[0].name, 'small');
});
