import { translate as t,setLanguage,getLanguage } from '../../src/shared/localization.js';
import { useEffect, useState } from 'react';
import { sortEntries } from '../../src/domain/file-entry.js';
import { DEMO_ROOTS, DEMO_FOLDERS, demoParent } from '../../src/domain/demo-files.js';
import { SCENARIOS, validateResponse } from '../../src/shared/messages.js';
import { restoreViewState } from '../../src/shared/view-state.js';
const labels = { ready:'Bereit',loading:'Laden',empty:'Leer',error:'Fehler',disconnected:'Getrennt' };
const bytes = size => size < 1024 ? `${size} B` : `${(size/1024).toLocaleString(getLanguage(),{ maximumFractionDigits:1 })} KiB`;
function Pane({side,path,onNavigate,mode,hidden,sort,setSort}) {
  const [selection,setSelection] = useState([]);
  const [filter,setFilter] = useState('');
  useEffect(() => setSelection([]),[path,mode]);
  const source = mode === 'ready' ? DEMO_FOLDERS[side][path] ?? [] : [];
  const entries = sortEntries(source.filter(e => (hidden || !e.name.startsWith('.')) && e.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())),sort.column,sort.direction);
  const order = column => setSort(value => ({column,direction: value.column === column && value.direction === 'asc' ? 'desc':'asc'}));
  const select = (entry,event) => setSelection(value => event.ctrlKey || event.metaKey ? value.includes(entry.id) ? value.filter(id => id !== entry.id) : [...value,entry.id] : [entry.id]);
  const [focused,setFocused] = useState(null);
  const keyboard = (entry,event) => {
    const index = entries.findIndex(value => value.id === entry.id);
    let target;
    if (event.key === 'ArrowDown') target = Math.min(index + 1,entries.length - 1);
    if (event.key === 'ArrowUp') target = Math.max(index - 1,0);
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = entries.length - 1;
    if (target !== undefined) {
      event.preventDefault(); setSelection([entries[target].id]);
      event.currentTarget.parentElement.children[target].focus();
    } else if (event.key === 'Enter') { event.preventDefault(); navigate(entry); }
    else if (event.key === ' ') { event.preventDefault(); select(entry,event); }
    else if (event.key === 'Backspace') { event.preventDefault(); onNavigate(demoParent(side,path)); }
  };
  const navigate = entry => { if (entry.kind === 'directory') onNavigate(`${path}/${entry.name}`); };
  return <section className="pane" aria-label={side === 'local' ? t('Lokale Dateien'):t('Entfernte Dateien')}>
    <header className="pane-title"><strong>{side === 'local' ? t('Lokal · Mein Rechner'):t('Remote · Demo-Server')}</strong><span className="badge">{side === 'local' ? 'Desktop':'SFTP · Demo'}</span></header>
    <div className="pathbar"><button disabled={path === DEMO_ROOTS[side]} onClick={() => onNavigate(demoParent(side,path))} aria-label={t(`${side === 'local' ? t('Lokal'):'Remote'}: Übergeordneter Ordner`)}><span className="codicon codicon-arrow-up" aria-hidden="true" /></button><span className="path" title={path}>{path}</span></div>
    <label className="filter">{t("Dateien filtern")}<input value={filter} onChange={event => setFilter(event.target.value)} placeholder={t("Name enthält …")} /></label>
    <div className="file-scroll"><table role="grid" aria-multiselectable="true" aria-label={side === 'local' ? t('Lokale Dateiliste'):t('Entfernte Dateiliste')}><thead><tr>{[['name',t('Name')],['size',t('Größe')],['modified',t('Geändert')]].map(([column,label]) => <th key={column} aria-sort={sort.column === column ? sort.direction === 'asc' ? 'ascending':'descending':'none'}><button onClick={() => order(column)}>{label}{sort.column === column ? sort.direction === 'asc' ? ' ↑':' ↓':''}</button></th>)}</tr></thead><tbody>
      {entries.map(entry => <tr key={entry.id} tabIndex={entry.id === (entries.some(value => value.id === focused) ? focused : entries[0]?.id) ? 0 : -1} onFocus={() => setFocused(entry.id)} onKeyDown={event => keyboard(entry,event)} className={selection.includes(entry.id) ? 'selected':''} aria-selected={selection.includes(entry.id)} onClick={event => select(entry,event)} onDoubleClick={() => navigate(entry)}><td><span aria-hidden="true" className={`codicon codicon-${entry.kind === 'directory' ? 'folder':'file'}`} /> {entry.name}</td><td>{entry.kind === 'directory' ? '—':bytes(entry.size)}</td><td>{new Date(entry.modified).toLocaleDateString(getLanguage())}</td></tr>)}
    </tbody></table>
    {entries.length === 0 && <div className={`list-message ${mode === 'error' ? 'error':''}`} role={mode === 'error' ? 'alert':'status'}>{mode === 'loading' ? t('Dateiliste wird geladen …'):mode === 'error' ? t('Demo: Keine Berechtigung für diesen Ordner.'):mode === 'disconnected' ? t('Nicht verbunden. Demo-Sitzung starten.'):mode === 'empty' || !filter ? t('Dieser Ordner ist leer.'):t('Keine passenden Dateien.')}</div>}
    </div><footer>{entries.length}{" "}{t("Einträge ·")}{" "}{selection.length}{" "}{t("ausgewählt")}</footer>
  </section>;
}
export function App({bridge,sessionId,initialState}) {
  const [restored] = useState(() => restoreViewState(bridge.getState?.() ?? initialState));
  const [model,setModel] = useState(null);
  const [paths,setPaths] = useState(restored.paths);
  const [split,setSplit] = useState(restored.split);
  const [queueOpen,setQueueOpen] = useState(restored.queueOpen);
  const [hidden,setHidden] = useState(restored.hidden);
  const [sorts,setSorts] = useState(restored.sorts);
  useEffect(() => { bridge.setState?.({version:1,sessionId,paths,sorts,split,queueOpen,hidden}); },[sessionId,paths,sorts,split,queueOpen,hidden]);
  const send = (type,extra = {}) => bridge.postMessage({version:1,type,id:crypto.randomUUID(),sessionId,...extra});
  useEffect(() => {
    const receive = event => { if (validateResponse(event.data,sessionId)) setModel(event.data); };
    window.addEventListener('message',receive); send('ready');
    return () => window.removeEventListener('message',receive);
  },[sessionId]);
  const mode = model?.scenario ?? 'loading';
  setLanguage(model?.locale ?? document.documentElement.lang ?? 'de');document.documentElement.lang=getLanguage();
  return <main className="commander">
    <header className="appbar"><h1>xScp</h1><span>Commander</span><span className="demo-note">{t("Demo · keine Serververbindung")}</span></header>
    <div className="toolbar" aria-label={t("Dateiaktionen")}><button onClick={() => send('setScenario',{scenario: mode === 'disconnected' ? 'ready':'disconnected'})}>{mode === 'disconnected' ? t('Demo verbinden'):t('Demo trennen')}</button><button disabled title={t("Echte Transfers folgen in M3")}>{t("Hochladen →")}</button><button disabled title={t("Echte Transfers folgen in M3")}>{t("← Herunterladen")}</button><button onClick={() => send('refresh')}><span className="codicon codicon-refresh" aria-hidden="true" />{" "}{t("Aktualisieren")}</button><label>{t("Ansicht")}{" "}<select value={mode} onChange={event => send('setScenario',{scenario:event.target.value})}>{SCENARIOS.map(value => <option key={value} value={value}>{t(labels[value])}</option>)}</select></label><label><input type="checkbox" checked={hidden} onChange={event => setHidden(event.target.checked)} />{" "}{t("Versteckte Dateien")}</label></div>
    <div className="split-control"><label>{t("Bereichsbreite")}{" "}<input type="range" min="30" max="70" value={split} onChange={event => setSplit(Number(event.target.value))} /></label></div>
    <div className="panes" style={{'--local-width':`${split}%`}}>{['local','remote'].map(side => <Pane key={side} side={side} path={paths[side]} onNavigate={path => setPaths(value => ({...value,[side]:path}))} mode={mode} hidden={hidden} sort={sorts[side]} setSort={update => setSorts(value => ({...value,[side]:update(value[side])}))} />)}</div>
    <section className="queue"><button className="queue-toggle" aria-expanded={queueOpen} onClick={() => setQueueOpen(value => !value)}>{queueOpen ? '▾':'▸'}{" "}{t("Transfers · 2 Demo-Aufträge")}</button>{queueOpen && <table aria-label={t("Demo-Transferqueue")}><thead><tr><th>{t("Datei")}</th><th>{t("Richtung")}</th><th>{t("Status")}</th><th>{t("Fortschritt")}</th></tr></thead><tbody><tr><td>index.html</td><td>{t("Lokal → Remote")}</td><td>{t("Demo: erfolgreich")}</td><td>100 %</td></tr><tr><td>logo.svg</td><td>{t("Remote → Lokal")}</td><td>{t("Demo: wartend")}</td><td>0 %</td></tr></tbody></table>}</section>
    <footer className="status" role="status">{model?.location.local ? t('Lokal: Desktop-Rechner'):t('Ausführungsort wird geprüft …')} · {t(labels[mode])}{" "}{t("· Keine Dateien werden übertragen.")}{model?.location.remoteWindow && t(' Remote-Workspace gehört nicht zur lokalen Dateiquelle.')}</footer>
  </main>;
}
