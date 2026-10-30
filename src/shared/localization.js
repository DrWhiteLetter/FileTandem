import { english } from './translations.js';
import german from '../../l10n/bundle.l10n.de.json' with { type: 'json' };
export const resolveLanguage=value => String(value).toLowerCase().startsWith('de') ? 'de':'en';
let current=typeof document==='object' ? resolveLanguage(document.documentElement.lang):'de';
export const getLanguage=() => current;
export function setLanguage(value) {current=resolveLanguage(value);}
const escape=value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.entries(english).filter(([source]) => /\{\d+\}/.test(source)).flatMap(([source,target]) => [source,target].map(pattern => {
  const indices=[];let cursor=0,regex='';
  for (const match of pattern.matchAll(/\{(\d+)\}/g)) {regex+=escape(pattern.slice(cursor,match.index))+'([\\s\\S]*?)';indices.push(Number(match[1]));cursor=match.index+match[0].length;}
  regex+=escape(pattern.slice(cursor));return {regex:new RegExp('^'+regex+'$'),target,source,indices,length:pattern.length};
})).sort((a,b) => b.length-a.length);
export const formatMessage=(message,args=[]) => message.replace(/\{(\d+)\}/g,(token,index) => args[index] ?? token);
/** English keys are shared by VS Code l10n and the webview. Unknown paths/user data remain untouched. */
export function translate(value,locale=current,resolve) {
  if (typeof value!=='string') return value;
  const render=(target,args,source) => resolve ? resolve(target,args):formatMessage(resolveLanguage(locale)==='de' ? source ?? german[target] ?? target:target,args);
  if (Object.hasOwn(english,value)) return render(english[value],[],value);
  if (Object.hasOwn(german,value)) return render(value,[],german[value]);
  for (const {regex,target,source,indices} of templates) {
    const match=regex.exec(value);if (match) {const args=[];indices.forEach((index,i) => {args[index]=match[i+1];});return render(target,args,source);}
  }
  const prefix=/^(\$\([a-z-]+\)\s*|FileTandem:\s*)([\s\S]*)$/.exec(value);
  if (prefix) return prefix[1]+translate(prefix[2],locale,resolve);
  if (value.includes('\n')) return value.split('\n').map(line => translate(line,locale,resolve)).join('\n');
  return value;
}
