/** @typedef {{id: string, name: string, kind: 'file'|'directory', size: number, modified: number}} FileEntry */
export function sortEntries(entries, column = 'name', direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    const compared = column === 'name' ? a.name.localeCompare(b.name, 'de') : a[column] - b[column];
    return factor * (compared || a.name.localeCompare(b.name, 'de'));
  });
}
