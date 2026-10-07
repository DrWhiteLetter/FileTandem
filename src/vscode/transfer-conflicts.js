import * as vscode from 'vscode';
export async function conflictDialog({direction,path,safeReplace,signal}) {
  const labels={Ersetzen:'replace','Überspringen':'skip','Beide behalten':'keep',Abbrechen:'cancel'};
  const choice=await vscode.window.showWarningMessage(`${direction === 'upload' ? 'Upload':'Download'}: Ziel existiert`,{modal:true,detail:`Tatsächliches Ziel: ${path}\n${safeReplace ? 'Ersetzen veröffentlicht erst die geprüfte Teil-Datei.':'Sichere Ersetzung ist hier nicht verfügbar; Alternativname oder Abbruch verwenden.'}`},...(safeReplace ? ['Ersetzen']:[]),'Überspringen','Beide behalten','Abbrechen');
  if (signal?.aborted || !choice || choice === 'Abbrechen') return {choice:'cancel'};
  const scope=await vscode.window.showQuickPick(['Nur diese Datei','Für weitere Konflikte dieses Sammelauftrags'],{title:'Konfliktregel'});
  if (signal?.aborted || !scope) return {choice:'cancel'};return {choice:labels[choice],apply:scope.startsWith('Für')};
}
