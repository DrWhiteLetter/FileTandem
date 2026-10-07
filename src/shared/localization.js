import { english } from './translations.js';
let current=typeof document==='object' && document.documentElement.lang==='en' ? 'en':'de';
export const getLanguage=() => current;
export function setLanguage(value) {current=String(value).toLowerCase().startsWith('en') ? 'en':'de';}
const escape=value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.entries(english).filter(([source]) => /\{\d+\}/.test(source)).sort((a,b) => b[0].length-a[0].length).map(([source,target]) => {
  const indices=[];let cursor=0,pattern='';for (const match of source.matchAll(/\{(\d+)\}/g)) {pattern+=escape(source.slice(cursor,match.index))+'([\\s\\S]*?)';indices.push(Number(match[1]));cursor=match.index+match[0].length;}pattern+=escape(source.slice(cursor));return {regex:new RegExp('^'+pattern+'$'),target,indices};
});
export function translate(value,locale=current) {
  if (typeof value!=='string' || !String(locale).toLowerCase().startsWith('en')) return value;
  if (Object.hasOwn(english,value)) return english[value];
  for (const {regex,target,indices} of templates) {const match=regex.exec(value);if (match) {const parts=new Map(indices.map((index,i) => [index,match[i+1]]));return target.replace(/\{(\d+)\}/g,(_,index) => parts.get(Number(index)) ?? '');}}
  const prefix=/^(\$\([a-z-]+\)\s*|xScp:\s*)([\s\S]*)$/.exec(value);if (prefix) return prefix[1]+translate(prefix[2],locale);
  if (value.includes('\n')) return value.split('\n').map(line => translate(line,locale)).join('\n');
  return value;
}
