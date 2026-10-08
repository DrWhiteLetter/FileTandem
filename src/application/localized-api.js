import { translate } from '../shared/localization.js';
export function localizeVSCode(raw) {
const language=() => {const requested=raw.workspace.getConfiguration('filetandem').get('language','auto');return ['de','en'].includes(requested) ? requested:String(raw.env.language).startsWith('de') ? 'de':'en';};
const t=value => translate(value,language());
const fields=new Set(['title','label','description','detail','prompt','placeHolder','openLabel','saveLabel','message','text','tooltip']);
const options=value => {
  if (!value || typeof value!=='object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,key==='validateInput' && typeof item==='function' ? async input => {const result=await item(input);return typeof result==='string' ? t(result):options(result);}:fields.has(key) && typeof item==='string' ? t(item):item]));
};
const item=value => typeof value==='string' ? t(value):options(value);
const editable=value => new Proxy(value,{set(target,key,value) {target[key]=fields.has(key) && typeof value==='string' ? t(value):value;return true;},get(target,key) {const value=target[key];return typeof value==='function' ? value.bind(target):value;}});
const window=new Proxy(raw.window,{get(target,key) {
  const method=target[key];if (typeof method!=='function') return method;
  if (['showWarningMessage','showErrorMessage','showInformationMessage'].includes(key)) return async (message,...args) => {
    const originals=args.filter(v => typeof v==='string' || v && typeof v.title==='string' && !Object.hasOwn(v,'modal'));const converted=new Map(originals.map(v => [item(v),v]));const result=await method.call(target,t(message),...args.map(v => converted.has(item(v)) ? item(v):options(v)));
    if (typeof result==='string') return originals.find(v => typeof v==='string' && t(v)===result) ?? result;return result && (originals.find(v => typeof v==='object' && t(v.title)===result.title) ?? result);
  };
  if (key==='showQuickPick') return async (items,configuration,token) => {const values=await items;const converted=values.map(item);const result=await method.call(target,converted,options(configuration),token);const original=selected => values[converted.indexOf(selected)] ?? selected;return Array.isArray(result) ? result.map(original):original(result);};
  if (['showInputBox','showOpenDialog','showSaveDialog'].includes(key)) return (configuration,token) => method.call(target,options(configuration),token);
  if (key==='createOutputChannel') return (name,...args) => {const channel=method.call(target,t(name),...args);return new Proxy(channel,{get(target,key) {const value=target[key];if (['append','appendLine','replace'].includes(key)) return message => value.call(target,t(message));return typeof value==='function' ? value.bind(target):value;}});};
  if (['createInputBox','createStatusBarItem'].includes(key)) return (...args) => editable(method.call(target,...args));
  if (key==='withProgress') return (configuration,task) => method.call(target,options(configuration),(progress,token) => task({report:value => progress.report(options(value))},token));
  return method.bind(target);
}});
const FileSystemError=new Proxy(raw.FileSystemError,{get(target,key) {const value=target[key];return typeof value==='function' ? argument => value.call(target,typeof argument==='string' ? t(argument):argument):value;}});
return {vscode:{...raw,window,FileSystemError},language,t};
}
