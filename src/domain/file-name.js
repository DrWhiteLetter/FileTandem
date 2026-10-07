export function fileName(value,windows=false) {
  if (typeof value !== 'string' || !value || value.length > 255 || value === '.' || value === '..' || /[\/\\\x00-\x1f\x7f]/.test(value)) throw new Error('Name muss 1–255 Zeichen ohne Pfadtrenner oder Steuerzeichen enthalten; . und .. sind nicht erlaubt.');
  if (windows && (/[<>:"|?*]/.test(value) || /[ .]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value))) throw new Error('Dieser Dateiname ist unter Windows nicht erlaubt.');
  return value;
}
