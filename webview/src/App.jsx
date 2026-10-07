import { useEffect, useState } from 'react';
import { sortEntries } from '../../src/domain/file-entry.js';
import { DEMO_ROOTS, DEMO_FOLDERS, demoParent } from '../../src/domain/demo-files.js';
import { SCENARIOS, validateResponse } from '../../src/shared/messages.js';
const labels = { ready:'Bereit',loading:'Laden',empty:'Leer',error:'Fehler',disconnected:'Getrennt' };
const bytes = size => size < 1024 ? `${size} B` : `${(size/1024).toLocaleString('de-DE',{ maximumFractionDigits:1 })} KiB`;
function Pane({side,path,onNavigate,mode,hidden}) {
  const [selection,setSelection] = useState([]);
  const [filter,setFilter] = useState('');
  const [sort,setSort] = useState({column:'name',direction:'asc'});
  useEffect(() => setSelection([]),[path,mode]);
  const source = mode === 'ready' ? DEMO_FOLDERS[side][path] ?? [] : [];
  const entries = sortEntries(source.filter(e => (hidden || !e.name.startsWith('.')) && e.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())),sort.column,sort.direction);
  const order = column => setSort(value => ({column,direction: value.column === column && value.direction === 'asc' ? 'desc':'asc'}));
  const select = (entry,event) => setSelection(value => event.ctrlKey || event.metaKey ? value.includes(entry.id) ? value.filter(id => id !== entry.id) : [...value,entry.id] : [entry.id]);
  const navigate = entry => { if (entry.kind === 'directory') onNavigate(`${path}/${entry.name}`); };
  return <section className="pane" aria-label={side === 'local' ? 'Lokale Dateien':'Entfernte Dateien'}>
    <header className="pane-title"><strong>{side === 'local' ? 'Lokal · Mein Rechner':'Remote · Demo-Server'}</strong><span className="badge">{side === 'local' ? 'Desktop':'SFTP · Demo'}</span></header>
    <div className="pathbar"><button disabled={path === DEMO_ROOTS[side]} onClick={() => onNavigate(demoParent(side,path))} aria-label={`${side === 'local' ? 'Lokal':'Remote'}: Übergeordneter Ordner`}>↑</button><span className="path" title={path}>{path}</span></div>
    <label className="filter">Dateien filtern<input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Name enthält …" /></label>
    <div className="file-scroll"><table aria-label={side === 'local' ? 'Lokale Dateiliste':'Entfernte Dateiliste'}><thead><tr>{[['name','Name'],['size','Größe'],['modified','Geändert']].map(([column,label]) => <th key={column} aria-sort={sort.column === column ? sort.direction === 'asc' ? 'ascending':'descending':'none'}><button onClick={() => order(column)}>{label}{sort.column === column ? sort.direction === 'asc' ? ' ↑':' ↓':''}</button></th>)}</tr></thead><tbody>
      {entries.map(entry => <tr key={entry.id} className={selection.includes(entry.id) ? 'selected':''} aria-selected={selection.includes(entry.id)} onClick={event => select(entry,event)} onDoubleClick={() => navigate(entry)}><td><span aria-hidden="true">{entry.kind === 'directory' ? '▸':'·'}</span> {entry.name}</td><td>{entry.kind === 'directory' ? '—':bytes(entry.size)}</td><td>{new Date(entry.modified).toLocaleDateString('de-DE')}</td></tr>)}
    </tbody></table>
    {entries.length === 0 && <div className={`list-message ${mode === 'error' ? 'error':''}`} role={mode === 'error' ? 'alert':'status'}>{mode === 'loading' ? 'Dateiliste wird geladen …':mode === 'error' ? 'Demo: Keine Berechtigung für diesen Ordner.':mode === 'disconnected' ? 'Nicht verbunden. Demo-Sitzung starten.':mode === 'empty' || !filter ? 'Dieser Ordner ist leer.':'Keine passenden Dateien.'}</div>}
    </div><footer>{entries.length} Einträge · {selection.length} ausgewählt</footer>
  </section>;
}
export function App({bridge,sessionId}) {
  const [model,setModel] = useState(null);
  const [paths,setPaths] = useState(DEMO_ROOTS);
  const [split,setSplit] = useState(50);
  const [queueOpen,setQueueOpen] = useState(true);
  const [hidden,setHidden] = useState(false);
  const send = (type,extra = {}) => bridge.postMessage({version:1,type,id:crypto.randomUUID(),sessionId,...extra});
  useEffect(() => {
    const receive = event => { if (validateResponse(event.data,sessionId)) setModel(event.data); };
    window.addEventListener('message',receive); send('ready');
    return () => window.removeEventListener('message',receive);
  },[sessionId]);
  const mode = model?.scenario ?? 'loading';
  return <main className="commander">
    <header className="appbar"><h1>xScp</h1><span>Commander</span><span className="demo-note">Demo · keine Serververbindung</span></header>
    <div className="toolbar" aria-label="Dateiaktionen"><button onClick={() => send('setScenario',{scenario: mode === 'disconnected' ? 'ready':'disconnected'})}>{mode === 'disconnected' ? 'Demo verbinden':'Demo trennen'}</button><button disabled title="Echte Transfers folgen in M3">Hochladen →</button><button disabled title="Echte Transfers folgen in M3">← Herunterladen</button><button onClick={() => send('refresh')}>Aktualisieren</button><label>Ansicht <select value={mode} onChange={event => send('setScenario',{scenario:event.target.value})}>{SCENARIOS.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label><label><input type="checkbox" checked={hidden} onChange={event => setHidden(event.target.checked)} /> Versteckte Dateien</label></div>
    <div className="split-control"><label>Bereichsbreite <input type="range" min="30" max="70" value={split} onChange={event => setSplit(Number(event.target.value))} /></label></div>
    <div className="panes" style={{'--local-width':`${split}%`}}>{['local','remote'].map(side => <Pane key={side} side={side} path={paths[side]} onNavigate={path => setPaths(value => ({...value,[side]:path}))} mode={mode} hidden={hidden} />)}</div>
    <section className="queue"><button className="queue-toggle" aria-expanded={queueOpen} onClick={() => setQueueOpen(value => !value)}>{queueOpen ? '▾':'▸'} Transfers · 2 Demo-Aufträge</button>{queueOpen && <table aria-label="Demo-Transferqueue"><thead><tr><th>Datei</th><th>Richtung</th><th>Status</th><th>Fortschritt</th></tr></thead><tbody><tr><td>index.html</td><td>Lokal → Remote</td><td>Demo: erfolgreich</td><td>100 %</td></tr><tr><td>logo.svg</td><td>Remote → Lokal</td><td>Demo: wartend</td><td>0 %</td></tr></tbody></table>}</section>
    <footer className="status" role="status">{model?.location.local ? 'Lokal: Desktop-Rechner':'Ausführungsort wird geprüft …'} · {labels[mode]} · Keine Dateien werden übertragen.{model?.location.remoteWindow && ' Remote-Workspace gehört nicht zur lokalen Dateiquelle.'}</footer>
  </main>;
}
