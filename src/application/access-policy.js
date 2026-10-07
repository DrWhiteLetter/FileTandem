export function hasDesktopAccess(location, trusted) {
  return location?.local === true && trusted === true;
}
export function requireDesktopAccess(location, trusted) {
  if (!hasDesktopAccess(location, trusted)) throw new Error('xScp benötigt den lokalen UI Extension Host und einen vertrauenswürdigen Kontext.');
}
