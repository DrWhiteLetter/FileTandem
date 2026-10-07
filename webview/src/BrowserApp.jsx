import { useEffect,useState } from 'react';
import { browserResponse } from '../../src/shared/browser-messages.js';
function FilePane({side,model,send}) {
  const [path,setPath]=useState('');useEffect(() => setPath(model?.path ?? ''),[model?.path]);
  return <section className="pane" aria-label={side === 'local' ? 'Lokale Dateien':'Entfernte Dateien'}><header className="pane-title"><strong>{side === 'local' ? 'Lokal · Mein Rechner':'Remote'}</strong></header>
    <form className="pathbar" onSubmit={e => {e.preventDefault();send('navigate',{side,path});}}>
      {['back','forward','up'].map(direction => <button type="button" key={direction} aria-label={`${side}: ${direction}`} onClick={() => send('history',{side,direction})}><span className={`codicon codicon-arrow-${direction === 'back' ? 'left':direction === 'forward' ? 'right':'up'}`} aria-hidden="true" /></button>)}
      <input aria-label={`${side === 'local' ? 'Lokaler':'Remote'} Pfad`} value={path} onChange={e => setPath(e.target.value)} /><button>Öffnen</button><button type="button" onClick={() => send('refresh',{side})}>Aktualisieren</button>
    </form><div className="file-scroll"><table><thead><tr><th>Name</th><th>Größe</th><th>Geändert</th></tr></thead><tbody>{model?.entries.map(entry => <tr key={entry.id} tabIndex={0} onDoubleClick={() => {if (entry.kind === 'directory') send('navigate',{side,path:entry.path});}} onKeyDown={e => {if (e.key === 'Enter' && entry.kind === 'directory') send('navigate',{side,path:entry.path});}}><td><span className={`codicon codicon-${entry.kind === 'directory' ? 'folder':entry.kind === 'symlink' ? 'file-symlink-file':'file'}`} aria-hidden="true" /> {entry.name}{entry.kind === 'symlink' && ` → ${entry.linkTarget}`}</td><td>{entry.size}</td><td>{new Date(entry.modified).toLocaleDateString('de-DE')}</td></tr>)}</tbody></table>
      {model?.status === 'loading' && <p role="status">Dateiliste wird geladen …</p>}{model?.status === 'error' && <p role="alert">{model.error}</p>}{model?.status === 'disconnected' && <p>Nicht verbunden.</p>}{model?.status === 'ready' && !model.entries.length && <p>Dieser Ordner ist leer.</p>}
    </div><footer>{model?.entries.length ?? 0} Einträge</footer></section>;
}
export function BrowserApp({bridge,sessionId}) {
  const [model,setModel]=useState(null);const send=(type,extra={}) => bridge.postMessage({version:1,type,id:crypto.randomUUID(),sessionId,...extra});
  useEffect(() => {const receive=event => {if (browserResponse(event.data,sessionId)) setModel(event.data);};window.addEventListener('message',receive);send('ready');return () => window.removeEventListener('message',receive);},[sessionId]);
  useEffect(() => {if (model) bridge.setState?.({version:1,paths:{local:model.local.path,remote:model.remote.path}});},[model]);
  return <main className="commander"><header className="appbar"><h1>xScp</h1><span>Commander</span></header><div className="toolbar">{model?.connection.name ?? 'Lokal'} · {model?.connection.state ?? 'Laden'}<button disabled>Hochladen</button><button disabled>Herunterladen</button></div><div className="panes">{['local','remote'].map(side => <FilePane key={side} side={side} model={model?.[side]} send={send} />)}</div><footer className="status" role="status">Lokal: Desktop-Rechner · Transfers folgen in M3.</footer></main>;
}
