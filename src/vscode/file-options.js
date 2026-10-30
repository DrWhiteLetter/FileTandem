import {vscode} from './localized-vscode.js';
import {filePolicy} from '../application/file-policy.js';
export const currentFilePolicy=() => {
  const config=vscode.workspace.getConfiguration('filetandem');
  return filePolicy({excludedExtensions:config.get('excludedExtensions',[]),excludedNames:config.get('excludedNames'),excludeHidden:config.get('excludeHidden',false),backupRemoteDeletes:config.get('backupRemoteDeletes',true)});
};
