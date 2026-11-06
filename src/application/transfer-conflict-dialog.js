/** One explicit modal decision; closing it never authorizes a write. */
export async function chooseTransferConflict({direction,path,safeReplace,signal},showWarningMessage) {
  if (signal?.aborted) return {choice:'cancel'};
  const choices={Ersetzen:{choice:'replace',apply:false},'Alle ersetzen':{choice:'replace',apply:true},Überspringen:{choice:'skip',apply:false},'Beide behalten':{choice:'keep',apply:false}};
  const buttons=[...(safeReplace ? ['Ersetzen','Alle ersetzen']:[]),'Überspringen','Beide behalten'].map(title => ({title}));
  buttons.push({title:'Abbrechen',isCloseAffordance:true});
  const answer=await showWarningMessage(`${direction === 'local' ? 'Lokale Kopie':direction === 'upload' ? 'Upload':'Download'}: Ziel existiert`,{
    modal:true,
    detail:`Tatsächliches Ziel: ${path}\n${safeReplace ? 'Ersetzen gilt sofort für diese Datei. Alle ersetzen gilt zusätzlich für weitere Dateikonflikte dieses Sammelauftrags. Die Veröffentlichung erfolgt erst nach Prüfung der Teil-Datei.':'Sichere Ersetzung ist hier nicht verfügbar; Alternativname oder Abbruch verwenden.'}\nÜberspringen und Beide behalten gelten nur für diese Datei.`,
  },...buttons);
  const selected=answer?.title ?? answer;
  if (signal?.aborted || !Object.hasOwn(choices,selected) || (!safeReplace && choices[selected].choice==='replace')) return {choice:'cancel'};
  return choices[selected];
}
