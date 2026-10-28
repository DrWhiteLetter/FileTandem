import { vscode } from './localized-vscode.js';
import { chooseTransferConflict } from '../application/transfer-conflict-dialog.js';
export const conflictDialog=request => chooseTransferConflict(request,(...args) => vscode.window.showWarningMessage(...args));
