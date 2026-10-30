export const DEFAULT_EXCLUDED_NAMES=['.git','.vscode','.env','.env.*','node_modules'];
export const isBackupPath=path => /\.bak(?:\.\d+)?$/i.test(String(path).replaceAll('\\','/').split('/').at(-1));
const escape=value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/** Name-based rules apply to descendants too; display filters never grant transfer permission. */
export function filePolicy({excludedExtensions=[],excludedNames=DEFAULT_EXCLUDED_NAMES,excludeHidden=false,backupRemoteDeletes=true}={}) {
  if (typeof excludeHidden!=='boolean' || typeof backupRemoteDeletes!=='boolean' || !Array.isArray(excludedExtensions) || !Array.isArray(excludedNames) || excludedExtensions.length>100 || excludedNames.length>100
    || [...excludedExtensions,...excludedNames].some(value => typeof value!=='string' || !value.trim() || value.length>256 || /[\\/\0\r\n]/.test(value))
    || excludedExtensions.some(value => !/^\*?\.?[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value.trim()))) throw new Error('Invalid FileTandem exclusion settings.');
  const extensions=excludedExtensions.map(value => '.'+value.trim().replace(/^\*?\.?/,'').toLowerCase());
  const names=excludedNames.map(value => new RegExp('^'+value.trim().split(/([*?])/).map(part => part==='*' ? '.*':part==='?' ? '.':escape(part)).join('')+'$','i'));
  const excludes=(path,kind='file') => {
    const parts=String(path).replaceAll('\\','/').split('/').filter(Boolean);
    if (parts.some(name => isBackupPath(name) || /^\.xscp-[a-zA-Z0-9-]+\.part$/.test(name) || (excludeHidden && name.startsWith('.')) || names.some(pattern => pattern.test(name)))) return true;
    return kind!=='directory' && extensions.some(extension => (parts.at(-1) ?? '').toLowerCase().endsWith(extension));
  };
  return Object.freeze({excludes,backupRemoteDeletes:backupRemoteDeletes===true,signature:JSON.stringify([extensions,excludedNames,excludeHidden===true,backupRemoteDeletes===true])});
}
