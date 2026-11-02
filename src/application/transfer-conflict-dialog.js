/** One explicit modal decision; closing it never authorizes a write. */
export async function chooseTransferConflict({direction,path,safeReplace,signal},showWarningMessage) {
  if (signal?.aborted) return {choice:'cancel'};
  const choices={Ersetzen:{choice:'replace',apply:false},'Alle weiteren ersetzen':{choice:'replace',apply:true},Überspringen:{choice:'skip',apply:false},'Beide behalten':{choice:'keep',apply:false}};
  const answer=await showWarningMessage(`${direction === 'local' ? 'Lokale Kopie':direction === 'upload' ? 'Upload':'Download'}: Ziel existiert`,{
    modal:true,
    detail:`Tatsächliches Ziel: ${path}\n${safeReplace ? 'Ersetzen gilt sofort für diese Datei. Alle weiteren ersetzen gilt zusätzlich für weitere Dateikonflikte dieses Sammelauftrags. Die Veröffentlichung erfolgt erst nach Prüfung der Teil-Datei.':'Sichere Ersetzung ist hier nicht verfügbar; Alternativname oder Abbruch verwenden.'}\nÜberspringen und Beide behalten gelten nur für diese Datei.`,
  },...(safeReplace ? ['Ersetzen','Alle weiteren ersetzen']:[]),'Überspringen','Beide behalten','Abbrechen');
  if (signal?.aborted || !Object.hasOwn(choices,answer) || (!safeReplace && choices[answer].choice==='replace')) return {choice:'cancel'};
  return choices[answer];
}
