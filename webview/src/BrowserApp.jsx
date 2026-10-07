import { DRAG_TYPE,browserDrag } from '../../src/shared/browser-settings.js';
import { useEffect,useState,useRef } from 'react';
import { browserResponse } from '../../src/shared/browser-messages.js';
import { browserViewState } from '../../src/shared/browser-view-state.js';
import { sortEntries } from '../../src/domain/file-entry.js';
const transferLabels={queued:'Wartet',running:'Läuft',completed:'Abgeschlossen',skipped:'Übersprungen',failed:'Fehlgeschlagen',cancelled:'Abgebrochen',interrupted:'Unterbrochen'};
const stateLabels={connecting:'Verbindet …',connected:'Verbunden',error:'Fehler',disconnected:'Getrennt'};
const sides=['local','remote'];
function FilePane({side,model,send,prefs,update,defaultHidden,connected,commanderKeys,sessionId,drag,setDrag,oppositePath}) {
  const [menu,setMenu]=useState(null);const menuRef=useRef(null);const [drop,setDrop]=useState(false);
  useEffect(() => {if (menu) menuRef.current?.querySelector('button')?.focus();},[menu]);
  const [path,setPath]=useState('');const [selection,setSelection]=useState([]);const [focused,setFocused]=useState(null);const [anchor,setAnchor]=useState(null);
  useEffect(() => {setMenu(null);setPath(model?.path ?? '');setSelection([]);setFocused(null);setAnchor(null);},[model?.path]);
  const hidden=prefs.hidden ?? defaultHidden;
  const entries=sortEntries((model?.entries ?? []).filter(e => (hidden || !e.name.startsWith('.')) && e.name.toLocaleLowerCase().includes(prefs.filter.toLocaleLowerCase())),prefs.sort.column,prefs.sort.direction);
  useEffect(() => {setSelection(current => {const next=current.filter(id => entries.some(e => e.id === id));return next.length === current.length ? current:next;});},[model?.entries,prefs.filter,hidden]);
  const choose=(entry,event) => {
    if (event.shiftKey && entries.some(e => e.id === anchor)) {const a=entries.findIndex(e => e.id === anchor),b=entries.findIndex(e => e.id === entry.id);setSelection(entries.slice(Math.min(a,b),Math.max(a,b)+1).map(e => e.id));}
    else {setAnchor(entry.id);setSelection(current => event.ctrlKey || event.metaKey ? current.includes(entry.id) ? current.filter(id => id !== entry.id):[...current,entry.id]:[entry.id]);}
    setFocused(entry.id);
  };
  const navigate=entry => {if (['directory','symlink'].includes(entry.kind)) send('navigate',{side,path:entry.path});else if (entry.kind==='file') send('action',{side,action:'open',ids:[entry.id]});};
  const keyboard=(entry,event) => {
    if (event.key==='F10' && event.shiftKey) {event.preventDefault();setMenu({ids:selection.includes(entry.id) ? selection:[entry.id]});return;}
    if (commanderKeys && ['F3','F4','F5','F6','F7','F8'].includes(event.key)) {event.preventDefault();const ids=selection.includes(entry.id) ? selection:[entry.id];if (event.key==='F5') {if (connected) send('transfer',{side,ids,destination:'opposite',destinationPath:oppositePath});}else send('action',{side,ids:event.key==='F7' ? []:ids,action:{F3:'open',F4:'open',F6:'rename',F7:'mkdir',F8:'delete'}[event.key]});return;}
    const index=entries.findIndex(e => e.id === entry.id);const offsets={ArrowDown:Math.min(index+1,entries.length-1),ArrowUp:Math.max(index-1,0),Home:0,End:entries.length-1};
    if (Object.hasOwn(offsets,event.key)) {event.preventDefault();const target=entries[offsets[event.key]];choose(target,event);event.currentTarget.parentElement.children[offsets[event.key]].focus();}
    else if (event.key === 'Enter') {event.preventDefault();navigate(entry);}
    else if (event.key === ' ') {event.preventDefault();choose(entry,event);}
    else if (event.key === 'Backspace') {event.preventDefault();send('history',{side,direction:'up'});}
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {event.preventDefault();setSelection(entries.map(e => e.id));}
  };
  const columns=[['name','Name'],...(prefs.columns.size ? [['size','Größe']]:[]),...(prefs.columns.modified ? [['modified','Geändert']]:[]),...(prefs.columns.mode ? [['mode','Rechte']]:[])];
  const order=column => update({...prefs,sort:{column,direction:prefs.sort.column === column && prefs.sort.direction === 'asc' ? 'desc':'asc'}});
  const favorite=prefs.favorites.includes(model?.path);
  return <section className={`pane ${drop ? 'drop-target':''}`} onDragOver={event => {if (connected && drag && drag.side!==side && model?.status==='ready') {event.preventDefault();event.dataTransfer.dropEffect='copy';setDrop(true);}}} onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget)) setDrop(false);}} onDrop={event => {event.preventDefault();setDrop(false);try {const value=JSON.parse(event.dataTransfer.getData(DRAG_TYPE));if (drag && browserDrag(value,sessionId) && value.side!==side && value.sessionId===drag.sessionId && JSON.stringify(value.ids)===JSON.stringify(drag.ids) && connected && model?.status==='ready') send('transfer',{side:value.side,ids:value.ids,destination:'opposite',destinationPath:model.path});} catch { /* OS drops and forged payloads are ignored. */ }setDrag(null);}} aria-label={side === 'local' ? 'Lokale Dateien':'Entfernte Dateien'}><header className="pane-title"><strong>{side === 'local' ? 'Lokal · Mein Rechner':'Remote'}</strong></header>
    <form className="pathbar" onSubmit={e => {e.preventDefault();send('navigate',{side,path});}}>
      {['back','forward','up'].map(direction => <button type="button" key={direction} aria-label={`${side}: ${direction}`} onClick={() => send('history',{side,direction})}><span className={`codicon codicon-arrow-${direction === 'back' ? 'left':direction === 'forward' ? 'right':'up'}`} aria-hidden="true" /></button>)}
      <input aria-label={`${side === 'local' ? 'Lokaler':'Remote'} Pfad`} value={path} onChange={e => setPath(e.target.value)} /><button>Öffnen</button><button type="button" onClick={() => send('refresh',{side})}>Aktualisieren</button>
    </form><div className="pane-options"><label>Namensfilter<input aria-label={`${side}: Namensfilter`} maxLength={256} value={prefs.filter} onChange={e => update({...prefs,filter:e.target.value})} /></label><label><input type="checkbox" checked={!!hidden} onChange={e => update({...prefs,hidden:e.target.checked})} /> Versteckte Dateien</label>
    <button disabled={!model?.path} aria-label={`${side}: Pfadfavorit`} aria-pressed={favorite} onClick={() => update({...prefs,favorites:favorite ? prefs.favorites.filter(p => p !== model.path):[...prefs.favorites.slice(-49),model.path]})}><span className={`codicon codicon-${favorite ? 'star-full':'star-empty'}`} aria-hidden="true" /> Favorit</button>
    <select aria-label={`${side}: Pfadfavoriten`} value="" onChange={e => {if (e.target.value) send('navigate',{side,path:e.target.value});}}><option value="">Pfadfavoriten</option>{prefs.favorites.map(p => <option key={p} value={p}>{p}</option>)}</select>
    <details><summary>Spalten</summary>{['size','modified','mode'].map(column => <label key={column}><input type="checkbox" checked={prefs.columns[column]} onChange={e => update({...prefs,columns:{...prefs.columns,[column]:e.target.checked}})} />{column === 'size' ? 'Größe':column === 'modified' ? 'Geändert':'Rechte'}</label>)}</details></div>
    <div className="pane-actions"><button disabled={!connected || !selection.length || model?.status !== 'ready'} onClick={() => send('transfer',{side,ids:selection,destination:'opposite'})}>{side === 'local' ? 'Hochladen →':'← Herunterladen'}</button>{side === 'remote' && <button disabled={!connected || !selection.length} onClick={() => send('transfer',{side,ids:selection,destination:'choose'})}>Download nach …</button>}<button disabled={model?.status !== 'ready'} onClick={() => send('action',{side,action:'mkdir',ids:[]})}>Neuer Ordner</button><button disabled={selection.length !== 1 || model?.status !== 'ready'} onClick={() => send('action',{side,action:'rename',ids:selection})}>Umbenennen</button>{[['delete','Löschen'],['properties','Eigenschaften'],['chmod','Rechte']].map(([action,label]) => <button key={action} disabled={model?.status !== 'ready' || (action === 'delete' ? !selection.length:selection.length !== 1)} onClick={() => send('action',{side,action,ids:selection})}>{label}</button>)}</div>
    {drop && <p role="status" className="drop-hint">Kopieren nach: {model.path}</p>}
    {menu && <div className="file-menu" ref={menuRef} role="menu" aria-label="Dateiaktionen" onKeyDown={event => {const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled)')];const index=buttons.indexOf(document.activeElement);if (event.key==='Escape') {event.preventDefault();setMenu(null);}else if (['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault();buttons[(index+(event.key==='ArrowDown' ? 1:-1)+buttons.length)%buttons.length]?.focus();}}}>
      <button role="menuitem" disabled={!connected || !menu.ids.length} onClick={() => {send('transfer',{side,ids:menu.ids,destination:'opposite',destinationPath:oppositePath});setMenu(null);}}>Kopieren nach: {oppositePath}</button>
      {[['open','Öffnen'],['rename','Umbenennen'],['mkdir','Neuer Ordner'],['delete','Löschen'],['properties','Eigenschaften'],['chmod','Rechte']].map(([action,label]) => <button role="menuitem" key={action} disabled={action!=='mkdir' && (action==='delete' ? !menu.ids.length:menu.ids.length!==1)} onClick={() => {send('action',{side,action,ids:action==='mkdir' ? []:menu.ids});setMenu(null);}}>{label}</button>)}<button role="menuitem" onClick={() => setMenu(null)}>Schließen</button>
    </div>}
    <div className="file-scroll"><table role="grid" aria-multiselectable="true" aria-label={`${side}: Dateiliste`}><thead><tr>{columns.map(([column,label]) => <th key={column} aria-sort={prefs.sort.column === column ? prefs.sort.direction === 'asc' ? 'ascending':'descending':'none'}><button onClick={() => order(column)}>{label}{prefs.sort.column === column && <span className={`codicon codicon-arrow-${prefs.sort.direction === 'asc' ? 'up':'down'}`} aria-hidden="true" />}</button></th>)}</tr></thead><tbody>{entries.map(entry => <tr key={entry.id} tabIndex={entry.id === (entries.some(e => e.id === focused) ? focused:entries[0]?.id) ? 0:-1} draggable={connected} onDragStart={event => {const ids=selection.includes(entry.id) ? selection:[entry.id];const value={version:1,sessionId,side,ids};if (!browserDrag(value,sessionId)) {event.preventDefault();return;}setSelection(ids);setDrag(value);event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData(DRAG_TYPE,JSON.stringify(value));}} onDragEnd={() => {setDrag(null);setDrop(false);}} onContextMenu={event => {event.preventDefault();const ids=selection.includes(entry.id) ? selection:[entry.id];setSelection(ids);setFocused(entry.id);setMenu({ids});}} onFocus={() => setFocused(entry.id)} className={selection.includes(entry.id) ? 'selected':''} aria-selected={selection.includes(entry.id)} onClick={event => choose(entry,event)} onDoubleClick={() => navigate(entry)} onKeyDown={event => keyboard(entry,event)}>{columns.map(([column]) => <td key={column}>{column === 'name' ? <><span className={`codicon codicon-${entry.kind === 'directory' ? 'folder':entry.kind === 'symlink' ? 'file-symlink-file':'file'}`} aria-hidden="true" /> {entry.name}{entry.kind === 'symlink' && <span> (Symlink → {entry.linkTarget})</span>}</>:column === 'modified' ? new Date(entry.modified).toLocaleString('de-DE'):column === 'mode' ? entry.mode.toString(8).padStart(3,'0'):entry.size.toLocaleString('de-DE')}</td>)}</tr>)}</tbody></table>
      {model?.status === 'loading' && <p role="status">Dateiliste wird geladen …</p>}{model?.status === 'error' && <p role="alert">{model.error}</p>}{model?.status === 'disconnected' && <p>Nicht verbunden.</p>}{model?.status === 'ready' && !entries.length && <p>{prefs.filter ? 'Keine passenden Dateien.':'Dieser Ordner ist leer.'}</p>}
    </div><footer>{entries.length} Einträge · {selection.length} ausgewählt</footer></section>;
}
export function BrowserApp({bridge,sessionId}) {
  const [drag,setDrag]=useState(null);const [model,setModel]=useState(null);const [state,setState]=useState(() => browserViewState(bridge.getState?.()));const send=(type,extra={}) => bridge.postMessage({version:1,type,id:crypto.randomUUID(),sessionId,...extra});
  useEffect(() => {const receive=event => {if (browserResponse(event.data,sessionId)) setModel(event.data);};window.addEventListener('message',receive);send('ready');return () => window.removeEventListener('message',receive);},[sessionId]);
  useEffect(() => {bridge.setState?.({...state,profileId:model?.profileId,paths:model ? {local:model.local.path,remote:model.remote.path}:state.paths});},[state,model]);
  return <main className="commander"><header className="appbar"><h1>xScp</h1><span>Commander</span></header><div className="toolbar">{model?.connection.name ?? 'Lokal'} · {stateLabels[model?.connection.state] ?? 'Laden'}<button disabled={model?.connection.state !== 'connected' || !['sftp','scp'].includes(model?.connection.protocol)} onClick={() => send('selectUpload')}>Dateien/Ordner hochladen …</button><button onClick={() => send('connect')}>Profil verbinden</button><button onClick={() => send('newSession')}>Neue Sitzung</button><button disabled={model?.connection.state !== 'connected'} onClick={() => send('disconnect')}>Trennen</button><button disabled={!model?.connection.id} onClick={() => send('reconnect')}>Wiederverbinden</button></div>
    <div className="split-control"><label>Bereichsbreite<input type="range" min={30} max={70} value={state.split} onChange={e => setState({...state,split:Number(e.target.value)})} /></label></div>
    <div className="panes" style={{'--local-width':`${state.split}%`}}>{sides.map(side => <FilePane key={side} side={side} model={model?.[side]} send={send} prefs={state.panes[side]} connected={model?.connection.state === 'connected' && ['sftp','scp'].includes(model?.connection.protocol)} defaultHidden={model?.showHiddenFiles} commanderKeys={model?.commanderKeys} sessionId={sessionId} drag={drag} setDrag={setDrag} oppositePath={model?.[side==='local' ? 'remote':'local'].path} update={value => setState(current => ({...current,panes:{...current.panes,[side]:value}}))} />)}</div><TransferList jobs={model?.queue ?? []} paused={model?.queuePaused} send={send} /><footer className="status" role="status">Lokal: Desktop-Rechner · SFTP / SCP</footer></main>;
}

function TransferList({jobs,paused,send}) {
  const [open,setOpen]=useState(true);
  const retryable=jobs.filter(j => ['failed','cancelled','interrupted'].includes(j.state));
  const action=(action,ids) => send('queueAction',{action,ids});
  return <section className="queue">
    <button className="queue-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>Transfers · {jobs.length}</button>
    {open && <>
      <button onClick={() => send('queuePause',{paused:!paused})}>{paused ? 'Queue fortsetzen':'Queue pausieren'}</button>
      <button disabled={!retryable.length} onClick={() => action('retry',retryable.slice(0,1000).map(j => j.id))}>Fehlgeschlagene erneut starten</button>
      <span>{paused ? ' Neue Starts pausiert; aktive Transfers laufen weiter.':' Pause wirkt global auf neue Starts.'}</span>
      <p>Für dieses Profil in allen Sitzungen; globale Ansicht: „xScp: Transfers anzeigen“.</p>
      <table aria-label="Transferqueue"><thead><tr><th>Datei / Ziel</th><th>Richtung</th><th>Status</th><th>Bytes / Rate</th></tr></thead><tbody>
        {jobs.slice(-200).map(job => <tr key={job.id}>
          <td title={job.source}>{job.finalTarget ?? job.target}</td><td>{job.direction === 'upload' ? 'Upload':'Download'}</td>
          <td>{transferLabels[job.state] ?? job.state}
            {['queued','running'].includes(job.state) && <button onClick={() => action('cancel',[job.id])}>Abbrechen</button>}
            {['failed','cancelled','interrupted'].includes(job.state) && <>
              <button onClick={() => action('retry',[job.id])}>Vollständig neu starten</button>
              {job.attempt && (job.protocol ?? 'sftp')==='sftp' && <button onClick={() => action('resume',[job.id])}>Geprüft fortsetzen</button>}
            </>}
            {job.attempt && ['failed','cancelled','interrupted','completed'].includes(job.state) && <button onClick={() => action('cleanup',[job.id])}>Teil-Datei bereinigen</button>}
            {job.error || job.reason ? ` · ${job.error || job.reason}`:''}
          </td><td>{job.bytes.toLocaleString('de-DE')} B · {(job.rate/1024).toFixed(1)} KiB/s</td>
        </tr>)}
      </tbody></table>{jobs.length>200 && <p>Die letzten 200 Aufträge werden angezeigt.</p>}
    </>}
  </section>;
}
