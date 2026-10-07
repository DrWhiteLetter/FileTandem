/** @typedef {{version:1,id:string,name:string,host:string,port:number,username:string,protocol:'sftp'|'scp',auth:'password'|'key'|'agent'|'interactive',keyPath:string,agentPath:string,localPath:string,remotePath:string,favorite:boolean}} ConnectionProfile */
/** @typedef {{browse:boolean,mkdir:boolean,rename:boolean,delete:boolean,chmod:boolean,symlinks:boolean}} Capabilities */
const text = (value,label,max=1024) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`${label} fehlt oder enthält ungültige Zeichen.`);
  return value.trim();
};
export function validateProfile(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1) throw new Error('Unbekannte Profilversion; unterstützt wird Version 1.');
  const allowed=['version','id','name','host','port','username','protocol','auth','keyPath','agentPath','localPath','remotePath','favorite'];
  if (Object.keys(raw).some(key => !allowed.includes(key))) throw new Error('Profil enthält unbekannte Felder; Geheimnisse gehören in den sicheren Speicher.');
  const id=text(raw.id,'Profil-ID',64); if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Ungültige Profil-ID.');
  const host=text(raw.host,'Host',255); if (/[\s/@\\?#%]/.test(host) || (host.includes(':') && !/^\[?[0-9a-f:.]+\]?$/i.test(host))) throw new Error('Host ohne URL, Benutzer oder Pfad eingeben.');
  const port=raw.port ?? 22; if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SSH-Port muss zwischen 1 und 65535 liegen.');
  const protocol=raw.protocol ?? 'sftp'; if (!['sftp','scp'].includes(protocol)) throw new Error('Protokoll muss SFTP oder SCP sein.');
  const auth=raw.auth ?? 'password'; if (!['password','key','agent','interactive'].includes(auth)) throw new Error('Unbekannte Anmeldung.');
  const pathText=(value,label) => {text(value,label,4096);return value;};
  const absolute=value => /^(\/|[a-zA-Z]:[\\/])/.test(value) && !value.includes('://');
  const keyPath=raw.keyPath ? pathText(raw.keyPath,'Schlüsselpfad') : '';
  if (keyPath && !absolute(keyPath)) throw new Error('Schlüsselpfad muss lokal und absolut sein.');
  const agentPath=raw.agentPath ? text(raw.agentPath,'Agent-Pfad') : '';
  if (auth === 'key' && !keyPath) throw new Error('Für Schlüsselanmeldung fehlt der lokale Schlüsselpfad.');
  if (auth === 'agent' && !agentPath) throw new Error('Für Agent-Anmeldung fehlt der explizite Agent-Pfad.');
  const remotePath=raw.remotePath ? pathText(raw.remotePath,'Remote-Startordner') : '/';
  if (!remotePath.startsWith('/')) throw new Error('Remote-Startordner muss ein absoluter POSIX-Pfad sein.');
  const localPath=raw.localPath ? pathText(raw.localPath,'Lokaler Startordner') : '';
  if (localPath && !absolute(localPath)) throw new Error('Lokaler Startordner muss ein absoluter lokaler Pfad sein.');
  return {version:1,id,name:text(raw.name,'Profilname',100),host,port,username:text(raw.username,'Benutzer',100),protocol,auth,keyPath,agentPath,localPath,remotePath,favorite:raw.favorite === true};
}
export const secretReference = (id,kind) => `xscp.profile.${id}.${kind}`;
