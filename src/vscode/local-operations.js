import { vscode } from './localized-vscode.js';
import { localPath } from '../adapters/local/files.js';
import { trashPaths } from '../application/local-delete.js';
export const trashLocal=(paths,allowed,filesystem=vscode.workspace.fs) => trashPaths(paths,allowed,(path,options) => filesystem.delete(vscode.Uri.file(localPath(path)),options));
