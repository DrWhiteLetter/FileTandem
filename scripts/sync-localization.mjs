import { readFile,writeFile } from 'node:fs/promises';
const root=new URL('../l10n/',import.meta.url);
const aliases=JSON.parse(await readFile(new URL('source-messages.json',root),'utf8'));
const en={},de={};
for (const [source,target] of Object.entries(aliases)) {
  en[target]=target;
  de[target] ??= source;
}
// English source keys and German translations are consumed by VS Code and the webview.
for (const [name,values] of [['bundle.l10n.json',en],['bundle.l10n.de.json',de]]) {
  const url=new URL(name,root),content=JSON.stringify(values,null,2)+'\n';
  if (process.argv.includes('--check')) {
    if (await readFile(url,'utf8')!==content) throw new Error(`Outdated localization bundle: ${name}. Run npm run l10n:sync.`);
  } else await writeFile(url,content);
}
