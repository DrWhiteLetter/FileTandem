// Search the displayed order, wrapping after the current row.
export function nextInitialMatch(entries,currentId,event,locale) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.nativeEvent?.isComposing || !/^[\p{L}\p{N}]$/u.test(event.key)) return -1;
  const initial=event.key.normalize('NFC').toLocaleLowerCase(locale);
  const current=entries.findIndex(entry => entry.id===currentId);
  for (let offset=1;offset<=entries.length;offset++) {
    const index=(current+offset)%entries.length;
    if (entries[index].name.normalize('NFC').toLocaleLowerCase(locale).startsWith(initial)) return index;
  }
  return -1;
}
