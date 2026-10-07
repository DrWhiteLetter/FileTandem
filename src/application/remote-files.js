import { RemoteFiles } from '../adapters/sftp/files.js';import { remoteTarget } from '../adapters/sftp/transfer-target.js';import { ScpFiles,scpTarget } from '../adapters/scp/files.js';import { streamScpFile } from '../adapters/scp/transfer.js';import { remotePath as scpPath } from '../adapters/scp/protocol.js';import { remotePath } from '../adapters/sftp/files.js';
export const openRemoteFiles=(session,protocol,options) => protocol==='scp' ? ScpFiles.open(session,options):protocol==='sftp' ? RemoteFiles.open(session,options):Promise.reject(new Error('Unbekanntes Protokoll.'));
export const targetFor=files => files instanceof ScpFiles ? scpTarget(files):remoteTarget(files);
export const streamFor=protocol => protocol==='scp' ? streamScpFile:undefined;
export const pathFor=(path,protocol) => protocol==='scp' ? scpPath(path,true):remotePath(path);
