import { translate as t,setLanguage,getLanguage } from '../../src/shared/localization.js';
import { DRAG_TYPE,browserDrag } from '../../src/shared/browser-settings.js';
import { useEffect,useState,useRef,useMemo,useLayoutEffect } from 'react';
import { browserResponse } from '../../src/shared/browser-messages.js';
import { browserViewState } from '../../src/shared/browser-view-state.js';
import { sortEntries } from '../../src/domain/file-entry.js';
const transferLabels={queued:"Queued",running:"Running",completed:"Completed",skipped:"Skipped",failed:"Failed",cancelled:"Cancelled",interrupted:"Interrupted"};
const stateLabels={connecting:"Connecting …",connected:"Connected",error:"Error",disconnected:"Disconnected"};
const sides=['local','remote'];
const Icon=({name}) => <span className={`codicon codicon-${name}`} aria-hidden="true" />;
function FilePane({side,model,send,prefs,update,defaultHidden,connected,commanderKeys,sessionId,drag,setDrag,oppositePath,activate,watching,connectionId}) {
  const filterRef=useRef(null),scrollRef=useRef(null),rows=useRef(new Map()),pendingFocus=useRef(false);const [scrollTop,setScrollTop]=useState(0),[height,setHeight]=useState(400);
  useEffect(() => {const element=scrollRef.current;const resize=() => setHeight(element?.clientHeight || 400);const observer=typeof ResizeObserver==='function' ? new ResizeObserver(resize):null;observer?.observe(element);window.addEventListener('resize',resize);resize();return () => {observer?.disconnect();window.removeEventListener('resize',resize);};},[]);
  const [loadingVisible,setLoadingVisible]=useState(false);const loadedPath=useRef(null);
  const loading=model?.status==='loading';
  useEffect(() => {
    setLoadingVisible(false);
    if (!loading) return;
    const timer=setTimeout(() => setLoadingVisible(true),300);
    return () => clearTimeout(timer);
  },[loading,model?.path]);
  useEffect(() => {if (model?.status==='ready') loadedPath.current=model.path;},[model?.status,model?.path]);
  const initialLoading=loading && !model?.entries.length && loadedPath.current!==model?.path;
  const [menu,setMenu]=useState(null);const menuRef=useRef(null);const [drop,setDrop]=useState(false);
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const element=menuRef.current,rect=element.getBoundingClientRect();
    element.style.left=`${Math.max(8,Math.min(menu.x,window.innerWidth-rect.width-8))}px`;
    element.style.top=`${Math.max(8,Math.min(menu.y,window.innerHeight-rect.height-8))}px`;
    element.querySelector('button:not(:disabled)')?.focus();
    const dismiss=event => {if (!element.contains(event.target)) setMenu(null);};
    document.addEventListener('pointerdown',dismiss);
    return () => document.removeEventListener('pointerdown',dismiss);
  },[menu]);
  const sideName=side==='local' ? t("Local"):'Remote';
  const [path,setPath]=useState('');const [selection,setSelection]=useState([]);const [focused,setFocused]=useState(null);const [anchor,setAnchor]=useState(null);
  useEffect(() => {setMenu(null);setScrollTop(0);if (scrollRef.current) scrollRef.current.scrollTop=0;setPath(model?.path ?? '');setSelection([]);setFocused(null);setAnchor(null);},[model?.path]);
  const hidden=prefs.hidden ?? defaultHidden;
  const locale=getLanguage();
  const entries=useMemo(() => sortEntries((model?.entries ?? []).filter(e => (hidden || !e.name.startsWith('.')) && e.name.toLocaleLowerCase().includes(prefs.filter.toLocaleLowerCase())),prefs.sort.column,prefs.sort.direction,locale),[model?.entries,hidden,prefs.filter,prefs.sort.column,prefs.sort.direction,locale]);
  const selected=useMemo(() => new Set(selection),[selection]);const ids=useMemo(() => new Set(entries.map(e => e.id)),[entries]);
  const start=Math.max(0,Math.min(Math.max(0,entries.length-1),Math.floor(scrollTop/36)-6));const end=Math.min(entries.length,start+Math.ceil(height/36)+12);const visible=entries.slice(start,end);
  useLayoutEffect(() => {if (pendingFocus.current && rows.current.has(focused)) {pendingFocus.current=false;rows.current.get(focused).focus();}},[focused,start,end,menu]);
  const focusIndex=index => {const offset=index*36;const element=scrollRef.current;if (element && (offset<element.scrollTop || offset+72>element.scrollTop+height)) {element.scrollTop=Math.max(0,offset-36);setScrollTop(element.scrollTop);}pendingFocus.current=true;setFocused(entries[index]?.id);};
  useEffect(() => {const copy=event => {if (event.detail?.side!==side || !commanderKeys || !connected) return;const chosen=selection.length ? selection:ids.has(focused) ? [focused]:[];if (chosen.length && chosen.length<=1000) send('transfer',{side,ids:chosen,destination:'opposite',destinationPath:oppositePath});};window.addEventListener('filetandem-copy',copy);return () => window.removeEventListener('filetandem-copy',copy);},[selection,focused,commanderKeys,connected,side,oppositePath,ids]);
  const closeMenu=() => {pendingFocus.current=true;setMenu(null);};
  useEffect(() => {setSelection(current => {const next=current.filter(id => ids.has(id));return next.length === current.length ? current:next;});},[model?.entries,prefs.filter,hidden]);
  const choose=(entry,event) => {
    activate?.(side);
    if (event.shiftKey && entries.some(e => e.id === anchor)) {const a=entries.findIndex(e => e.id === anchor),b=entries.findIndex(e => e.id === entry.id);setSelection(entries.slice(Math.min(a,b),Math.max(a,b)+1).map(e => e.id));}
    else {setAnchor(entry.id);setSelection(current => event.ctrlKey || event.metaKey ? current.includes(entry.id) ? current.filter(id => id !== entry.id):[...current,entry.id]:[entry.id]);}
    setFocused(entry.id);
  };
  const navigate=entry => {if (model?.status!=='ready') return;if (watching && !(side==='local' && entry.kind==='file')) return;if (['directory','symlink'].includes(entry.kind)) send('navigate',{side,path:entry.path});else if (entry.kind==='file') send('action',{side,action:'open',ids:[entry.id]});};
  const keyboard=(entry,event) => {
    if (event.key==='F10' && event.shiftKey) {event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();setMenu({ids:selected.has(entry.id) ? selection:[entry.id],x:rect.left+12,y:rect.bottom});return;}
    if (!watching && commanderKeys && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && ['F3','F4','F5','F6','F7','F8'].includes(event.key)) {event.preventDefault();if (event.key==='F5') return;event.stopPropagation();const ids=selected.has(entry.id) ? selection:[entry.id];send('action',{side,ids:event.key==='F7' ? []:ids,action:{F3:'open',F4:'edit',F6:'rename',F7:'mkdir',F8:'delete'}[event.key]});return;}
    const index=entries.findIndex(e => e.id === entry.id);const offsets={ArrowDown:Math.min(index+1,entries.length-1),ArrowUp:Math.max(index-1,0),Home:0,End:entries.length-1};
    if (Object.hasOwn(offsets,event.key)) {event.preventDefault();const target=entries[offsets[event.key]];choose(target,event);focusIndex(offsets[event.key]);}
    else if (event.key === 'Enter') {event.preventDefault();navigate(entry);}
    else if (event.key === ' ') {event.preventDefault();choose(entry,event);}
    else if (!watching && event.key === 'Backspace') {event.preventDefault();send('history',{side,direction:'up'});}
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {event.preventDefault();setSelection(entries.map(e => e.id));}
  };
  const columns=[['name',t('Name')],...(prefs.columns.size ? [['size',t("Size")]]:[]),...(prefs.columns.modified ? [['modified',t("Modified")]]:[]),...(prefs.columns.mode ? [['mode',t("Permissions")]]:[])];
  const order=column => update({...prefs,sort:{column,direction:prefs.sort.column === column && prefs.sort.direction === 'asc' ? 'desc':'asc'}});
  const favorite=prefs.favorites.includes(model?.path);
  const clearFilter=() => {update({...prefs,filter:''});filterRef.current?.focus();};
  const empty= model?.status==='ready' && !entries.length;
  const filtered=!!prefs.filter || (!hidden && (model?.entries.length ?? 0)>0);
  const tabStop=visible.some(entry => entry.id===focused) ? focused:visible[0]?.id;
  return <section className={`pane ${drop ? 'drop-target':''}`} onDragOver={event => {if (connected && drag && drag.side!==side && model?.status==='ready') {event.preventDefault();event.dataTransfer.dropEffect='copy';setDrop(true);}}} onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget)) setDrop(false);}} onDrop={event => {event.preventDefault();setDrop(false);try {const value=JSON.parse(event.dataTransfer.getData(DRAG_TYPE));if (drag && browserDrag(value,sessionId) && value.side!==side && value.sessionId===drag.sessionId && JSON.stringify(value.ids)===JSON.stringify(drag.ids) && connected && model?.status==='ready') send('transfer',{side:value.side,ids:value.ids,destination:'opposite',destinationPath:model.path});} catch { /* OS drops and forged payloads are ignored. */ }setDrag(null);}} aria-label={side === 'local' ? t("Local files"):t("Remote files")}><header className="pane-title"><strong><Icon name={side==='local' ? 'device-desktop':'remote'} /> {side === 'local' ? t("Local · My computer"):'Remote'}</strong><span className="pane-loading" role="status" aria-label={loading && loadingVisible ? t("Loading file list …"):undefined}>{loading && loadingVisible && <Icon name="loading" />}</span></header>
    <form className="pathbar" onSubmit={e => {e.preventDefault();if (!watching) send('navigate',{side,path});}}>
      {['back','forward','up'].map(direction => <button type="button" className="icon-button" disabled={watching || model?.status==='disconnected' || (direction==='back' && model?.canBack===false) || (direction==='forward' && model?.canForward===false)} title={t({back:"Back",forward:"Forward",up:"Up"}[direction])} key={direction} aria-label={`${sideName}: ${t({back:t("Back"),forward:t("Forward"),up:t("Up")}[direction])}`} onClick={() => send('history',{side,direction})}><span className={`codicon codicon-arrow-${direction === 'back' ? 'left':direction === 'forward' ? 'right':'up'}`} aria-hidden="true" /></button>)}
      <input disabled={watching} title={path} spellCheck={false} aria-label={t(`${side === 'local' ? t('Lokaler'):'Remote'} path`)} value={path} onChange={e => setPath(e.target.value)} /><button disabled={watching}>{t("Open")}</button><button className="icon-button" type="button" disabled={model?.status==='loading' || model?.status==='disconnected'} title={t("Refresh")} aria-label={`${sideName}: ${t("Refresh")}`} onClick={() => send('refresh',{side})}><Icon name="refresh" /></button>
    </form><div className="pane-options"><label className="name-filter"><span>{t("Name filter")}</span><span className="filter-field"><input ref={filterRef} aria-label={t(`${sideName}: Name filter`)} maxLength={256} value={prefs.filter} onChange={e => update({...prefs,filter:e.target.value})} />{prefs.filter && <button type="button" className="icon-button filter-clear" title={t("Clear filter")} aria-label={`${sideName}: ${t("Clear filter")}`} onClick={clearFilter}><Icon name="close" /></button>}</span></label><label className="checkbox-label"><input type="checkbox" checked={!!hidden} onChange={e => update({...prefs,hidden:e.target.checked})} />{" "}{t("Hidden files")}</label>
    <button className="icon-button favorite-button" disabled={!model?.path} title={favorite ? t("Remove path favorite"):t("Save path as favorite")} aria-label={t(`${sideName}: Path favorite`)} aria-pressed={favorite} onClick={() => {update({...prefs,favorites:favorite ? prefs.favorites.filter(p => p !== model.path):[...prefs.favorites.slice(-49),model.path]});send('pathFavorite',{side,path:model.path,favorite:!favorite});}}><span className={`codicon codicon-${favorite ? 'star-full':'star-empty'}`} aria-hidden="true" /></button>
    <select disabled={watching} aria-label={t(`${sideName}: Path favorites`)} value="" onChange={e => {if (e.target.value) send('navigate',{side,path:e.target.value});}}><option value="">{t("Path favorites")}</option>{prefs.favorites.map(p => <option key={p} value={p}>{p}</option>)}</select>
    <details className="column-options" onKeyDown={event => {if (event.key==='Escape') {event.currentTarget.open=false;event.currentTarget.querySelector('summary').focus();}}}><summary>{t("Columns")}</summary><div className="column-popover">{columns.map(([column,label]) => <label key={column}>{t("Width")}{" "}{label}<input aria-label={t(`${sideName}: Width ${label}`)} type="range" min="80" max="800" step="10" value={prefs.widths[column]} onChange={e => update({...prefs,widths:{...prefs.widths,[column]:Number(e.target.value)}})} /></label>)}{['size','modified','mode'].map(column => <label key={column}><input type="checkbox" checked={prefs.columns[column]} onChange={e => update({...prefs,columns:{...prefs.columns,[column]:e.target.checked}})} />{column === 'size' ? t("Size"):column === 'modified' ? t("Modified"):t("Permissions")}</label>)}</div></details></div>
    <div className="pane-actions" role="group" aria-label={`${sideName}: ${t("File actions")}`} title={watching ? t("Manual transfers and folder navigation are disabled."):undefined}><button disabled={!connected || !selection.length || selection.length>1000 || model?.status !== 'ready'} onClick={() => send('transfer',{side,ids:selection,destination:'opposite'})}>{side === 'local' ? t("Upload →"):t("← Download")}</button>{side === 'remote' && <button disabled={!connected || !selection.length || selection.length>1000} onClick={() => send('transfer',{side,ids:selection,destination:'choose'})}>{t("Download to …")}</button>}<button disabled={watching || model?.status !== 'ready'} onClick={() => send('action',{side,action:'mkdir',ids:[]})}>{t("New folder")}</button><button disabled={watching || selection.length !== 1 || model?.status !== 'ready'} onClick={() => send('action',{side,action:'rename',ids:selection})}>{t("Rename")}</button>{[['delete',t("Delete")],['properties',t("Properties")],['chmod',t("Permissions")]].map(([action,label]) => <button key={action} disabled={(watching && action!=='properties') || model?.status !== 'ready' || (action === 'delete' ? !selection.length:selection.length !== 1)} onClick={() => send('action',{side,action,ids:selection})}>{label}</button>)}</div>
    {drop && <p role="status" className="drop-hint">{t("Copy to:")}{" "}{model.path}</p>}
    {menu && <div className="file-menu" style={{left:menu.x,top:menu.y}} ref={menuRef} role="menu" aria-label={t("File actions")} onKeyDown={event => {const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled)')];const index=buttons.indexOf(document.activeElement);if (event.key==='Escape') {event.preventDefault();closeMenu();}else if (event.key==='Tab') {setMenu(null);}else if (event.key==='Home' || event.key==='End') {event.preventDefault();buttons[event.key==='Home' ? 0:buttons.length-1]?.focus();}else if (['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault();buttons[(index+(event.key==='ArrowDown' ? 1:-1)+buttons.length)%buttons.length]?.focus();}}}>
      <button role="menuitem" disabled={!connected || !menu.ids.length || menu.ids.length>1000} onClick={() => {send('transfer',{side,ids:menu.ids,destination:'opposite',destinationPath:oppositePath});closeMenu();}}>{t("Copy to:")}{" "}{oppositePath}</button>
      {[['open',t("Open")],['edit',t("Edit")],['rename',t("Rename")],['mkdir',t("New folder")],['delete',t("Delete")],['properties',t("Properties")],['chmod',t("Permissions")]].map(([action,label]) => <button role="menuitem" key={action} disabled={(watching && action!=='properties' && !(action==='open' && side==='local')) || action!=='mkdir' && (action==='delete' ? !menu.ids.length:menu.ids.length!==1)} onClick={() => {send('action',{side,action,ids:action==='mkdir' ? []:menu.ids});closeMenu();}}>{label}</button>)}<button role="menuitem" onClick={closeMenu}>{t("Close")}</button>
    </div>}
    <div className="file-scroll" aria-busy={model?.status==='loading'} ref={scrollRef} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>{initialLoading && loadingVisible && <div className="list-message loading-message" role="status"><Icon name="loading" />{t("Loading file list …")}</div>}
      {model?.status==='error' && <div className="list-message error-message" role="alert"><Icon name="error" /><div><strong>{t("Folder unavailable")}</strong><p>{t(model.error)}</p><button onClick={() => send('refresh',{side})}>{t("Try again")}</button></div></div>}
      {model?.status==='disconnected' && <div className="list-message"><Icon name="debug-disconnect" /><div><strong>{t("Not connected.")}</strong><p>{t("Connect a profile to view remote files.")}</p><button className="primary" onClick={() => send(connectionId ? 'reconnect':'connect')}>{t("Connect profile")}</button></div></div>}

      <table hidden={model?.status==='error' || model?.status==='disconnected'} className="virtual-grid" style={{minWidth:columns.reduce((n,[key]) => n+prefs.widths[key],0)}} role="grid" aria-rowcount={entries.length+1} aria-colcount={columns.length} aria-multiselectable="true" aria-label={t(`${sideName}: File list`)}><colgroup>{columns.map(([column]) => <col key={column} style={{width:prefs.widths[column]}} />)}</colgroup><thead><tr aria-rowindex="1">{columns.map(([column,label]) => <th key={column} scope="col" className={column==='size' ? 'numeric':undefined} aria-sort={prefs.sort.column === column ? prefs.sort.direction === 'asc' ? 'ascending':'descending':'none'}><button className="sort-button" onClick={() => order(column)}>{label}{prefs.sort.column === column && <span className={`codicon codicon-arrow-${prefs.sort.direction === 'asc' ? 'up':'down'}`} aria-hidden="true" />}</button></th>)}</tr></thead><tbody>{start>0 && <tr role="presentation" aria-hidden="true"><td colSpan={columns.length} style={{height:start*36,padding:0}} /></tr>}{visible.map((entry,index) => <tr key={entry.id} ref={node => {if (node) rows.current.set(entry.id,node);else rows.current.delete(entry.id);}} data-entry-id={entry.id} aria-rowindex={start+index+2} aria-label={`${entry.name}, ${t({file:"File",directory:"Folder",symlink:'Symlink',other:"Other"}[entry.kind])}`} tabIndex={entry.id===tabStop ? 0:-1} draggable={connected} onDragStart={event => {const ids=selected.has(entry.id) ? selection:[entry.id];const value={version:1,sessionId,side,ids};if (!browserDrag(value,sessionId)) {event.preventDefault();return;}setSelection(ids);setDrag(value);event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData(DRAG_TYPE,JSON.stringify(value));}} onDragEnd={() => {setDrag(null);setDrop(false);}} onContextMenu={event => {event.preventDefault();const ids=selected.has(entry.id) ? selection:[entry.id];setSelection(ids);setFocused(entry.id);setMenu({ids,x:event.clientX,y:event.clientY});}} onFocus={() => {setFocused(entry.id);activate?.(side);}} className={selected.has(entry.id) ? 'selected':''} aria-selected={selected.has(entry.id)} onClick={event => choose(entry,event)} onDoubleClick={() => navigate(entry)} onKeyDown={event => keyboard(entry,event)}>{columns.map(([column]) => <td key={column} className={column==='size' || column==='mode' ? 'numeric':undefined} title={column==='name' ? entry.name:undefined}>{column === 'name' ? <><span className={`codicon codicon-${entry.kind === 'directory' ? 'folder':entry.kind === 'symlink' ? 'file-symlink-file':'file'}`} aria-hidden="true" /> {entry.name}{entry.kind === 'symlink' && <span> (Symlink → {entry.linkTarget})</span>}</>:column === 'modified' ? new Date(entry.modified).toLocaleString(getLanguage()):column === 'mode' ? entry.mode.toString(8).padStart(3,'0'):entry.kind==='directory' ? '—':entry.size.toLocaleString(getLanguage())}</td>)}</tr>)}{end<entries.length && <tr role="presentation" aria-hidden="true"><td colSpan={columns.length} style={{height:(entries.length-end)*36,padding:0}} /></tr>}</tbody></table>

      {empty && <div className="list-message"><Icon name={filtered ? 'search':'folder'} /><div><strong>{filtered ? t("No matching files."):t("This folder is empty.")}</strong>{prefs.filter ? <button onClick={clearFilter}>{t("Clear filter")}</button>:filtered ? <button onClick={() => update({...prefs,hidden:true})}>{t("Show hidden files")}</button>:<p>{t("Copy files from the opposite pane.")}</p>}</div></div>}
    </div><footer role="status" aria-live="polite" aria-atomic="true">{model?.status==='error' ? t("File list unavailable"):model?.status==='disconnected' ? t("Not connected."):<>{entries.length}{" "}{t("entries ·")}{" "}{selection.length}{" "}{t("selected")}</>}{selection.length>1000 && <span>{" "}{t("· Select at most 1,000 entries per transfer.")}</span>}</footer></section>;
}
export function BrowserApp({bridge,sessionId}) {
  const copyIds=useRef(new Set());const activeSide=useRef('local');const activate=side => {activeSide.current=side;};
  const [drag,setDrag]=useState(null);const [model,setModel]=useState(null);const [state,setState]=useState(() => browserViewState(bridge.getState?.()));const send=(type,extra={}) => bridge.postMessage({version:1,type,id:crypto.randomUUID(),sessionId,...extra});
  useEffect(() => {const receive=event => {if (event.data?.version===1 && event.data.type==='commanderCopy' && event.data.sessionId===sessionId && typeof event.data.id==='string' && /^[a-zA-Z0-9-]{1,64}$/.test(event.data.id)) {if (copyIds.current.has(event.data.id)) return;copyIds.current.add(event.data.id);if (copyIds.current.size>256) copyIds.current.delete(copyIds.current.values().next().value);if (!document.activeElement?.matches('input,textarea,select,[contenteditable=true]')) window.dispatchEvent(new CustomEvent('filetandem-copy',{detail:{side:activeSide.current}}));return;}if (browserResponse(event.data,sessionId)) {setModel(event.data);if (event.data.pathFavorites) {const restored=browserViewState({version:1,panes:{local:{favorites:event.data.pathFavorites.local},remote:{favorites:event.data.pathFavorites.remote}}});setState(current => ({...current,panes:{local:{...current.panes.local,favorites:restored.panes.local.favorites},remote:{...current.panes.remote,favorites:restored.panes.remote.favorites}}}));}}};window.addEventListener('message',receive);send('ready');return () => window.removeEventListener('message',receive);},[sessionId]);
  useEffect(() => {bridge.setState?.({...state,profileId:model?.profileId,paths:model ? {local:model.local.path,remote:model.remote.path}:state.paths});},[state,model]);
  useEffect(() => {
    if (!model?.diagnostics) return;let timer;const report=() => {clearTimeout(timer);timer=setTimeout(() => {const pane=document.querySelector('.pane'),scroll=pane?.querySelector('.file-scroll'),row=pane?.querySelector('tr[data-entry-id]');const theme=['vscode-high-contrast-light','vscode-high-contrast','vscode-light','vscode-dark'].find(v => document.body.classList.contains(v)) ?? 'vscode-dark';send('renderProof',{rows:pane?.querySelectorAll('tr[data-entry-id]').length ?? 0,height:scroll?.clientHeight ?? 0,rowHeight:row?.getBoundingClientRect().height ?? 0,scrollHeight:scroll?.scrollHeight ?? 0,theme,focusColor:getComputedStyle(document.documentElement).getPropertyValue('--vscode-focusBorder').trim()});},100);};const observer=new MutationObserver(report);observer.observe(document.body,{attributes:true,attributeFilter:['class','style']});window.addEventListener('resize',report);report();return () => {clearTimeout(timer);observer.disconnect();window.removeEventListener('resize',report);};
  },[model?.diagnostics,model?.local.entries,model?.local.status]);
  setLanguage(model?.locale ?? document.documentElement.lang ?? 'de');document.documentElement.lang=getLanguage();
  const watching=!!(model?.autoUpload?.active || model?.autoUpload?.starting);
  return <main className="commander">
    <header className="appbar"><h1>FileTandem</h1><span className="badge">Commander</span></header>
    <div className="toolbar">
      <div className="connection-status" role="status"><Icon name={model?.connection.state==='connected' ? 'plug':model?.connection.state==='connecting' ? 'loading':'debug-disconnect'} /><strong>{model?.connection.name ?? t("No server")}</strong><span>{t(stateLabels[model?.connection.state] ?? "Loading")}</span></div>
      <div className="toolbar-group" role="group" aria-label={t("Transfer")}>
        <button className="primary" disabled={watching || model?.connection.state!=='connected' || !['sftp','scp'].includes(model?.connection.protocol)} onClick={() => send('selectUpload')}>{t("Upload files/folders …")}</button>
        <button disabled={watching || model?.connection.state!=='connected' || model?.local.status!=='ready' || model?.remote.status!=='ready'} onClick={() => send('synchronize')}>{t("Synchronize folders …")}</button>
        {!watching && <button disabled={model?.connection.state!=='connected' || model?.local.status!=='ready' || model?.remote.status!=='ready'} onClick={() => send('autoUploadStart')}>{t("Keep remote folder up to date …")}</button>}
      </div>
      <div className="toolbar-group connection-actions" role="group" aria-label={t("Connection")}>
        <button disabled={watching} onClick={() => send('connect')}>{t("Connect profile")}</button>
        <button onClick={() => send('newSession')}>{t("New session")}</button>
        {model?.connection.state==='connected' ? <button onClick={() => send('disconnect')}>{t("Disconnect")}</button>:<button disabled={watching || !model?.connection.id} onClick={() => send('reconnect')}>{t("Reconnect")}</button>}
      </div>
    </div>
    {watching && <section className="auto-upload-status" aria-labelledby="watch-title">
      <div className="watch-summary" role="status" aria-atomic="true"><strong id="watch-title"><Icon name={model.autoUpload.starting ? 'loading':'sync'} />{model.autoUpload.starting ? t("Initial synchronization in progress …"):t("Automatic upload active")}</strong><span className="watch-counts">{t("Uploaded files:")} {model.autoUpload.uploaded} · {t("Deleted entries:")} {model.autoUpload.deleted ?? 0}</span></div>
      <button className="watch-stop" onClick={() => send('autoUploadStop')}>{t("Stop monitoring")}</button>
      <div className="watch-paths"><span title={model.autoUpload.localRoot}><span className="badge">{t("Local")}</span> {model.autoUpload.localRoot}</span><Icon name="arrow-right" /><span title={model.autoUpload.remoteRoot}><span className="badge">Remote</span> {model.autoUpload.remoteRoot}</span></div>
      <p className="watch-note">{t("Manual transfers and folder navigation are disabled.")}</p>
    </section>}
    {model?.autoUpload?.error && <div className="watch-error error-message" role="alert"><Icon name="error" /><span><strong>{t("Monitoring stopped:")}</strong> {t(model.autoUpload.error)}</span></div>}
    <div className="split-control"><label>{t("Pane width")}<input type="range" min={30} max={70} value={state.split} aria-valuetext={t(`Local ${state.split}%, Remote ${100-state.split}%`)} onChange={e => setState({...state,split:Number(e.target.value)})} /></label></div>
    <div className="panes" style={{'--local-width':`${state.split}%`}}>{sides.map(side => <FilePane key={side} side={side} activate={activate} model={model?.[side]} send={send} prefs={state.panes[side]} watching={watching} connectionId={model?.connection.id} connected={!watching && model?.connection.state==='connected' && ['sftp','scp'].includes(model?.connection.protocol)} defaultHidden={model?.showHiddenFiles} commanderKeys={model?.commanderKeys} sessionId={sessionId} drag={drag} setDrag={setDrag} oppositePath={model?.[side==='local' ? 'remote':'local'].path} update={value => setState(current => ({...current,panes:{...current.panes,[side]:value}}))} />)}</div>
    <TransferList jobs={model?.queue ?? []} paused={model?.queuePaused} watching={watching} send={send} open={state.queueOpen} setOpen={queueOpen => setState(current => ({...current,queueOpen}))} />
    <footer className="status">{t("Local: Desktop computer · SFTP / SCP")}</footer>
  </main>;
}

function TransferList({jobs,paused,send,watching,open,setOpen}) {
  const retryable=jobs.filter(j => ['failed','cancelled','interrupted'].includes(j.state));
  const failures=jobs.filter(j => ['failed','interrupted'].includes(j.state)).length;
  const active=jobs.filter(j => ['queued','running'].includes(j.state)).length;
  const action=(action,ids) => send('queueAction',{action,ids});
  const icons={queued:'clock',running:'sync',completed:'check',skipped:'debug-step-over',failed:'error',cancelled:'circle-slash',interrupted:'warning'};
  return <section className="queue" aria-label={t("Transfer queue")}>
    <button className="queue-toggle" aria-expanded={open} aria-controls={open ? 'transfer-content':undefined} onClick={() => setOpen(!open)}><Icon name={open ? 'chevron-down':'chevron-right'} /><strong>Transfers</strong><span className="count-badge">{jobs.length}</span><span className="queue-summary">{paused ? t("Queue paused"):active ? t(`${active} active or queued`):t("No active transfers")}{failures>0 && <span className="queue-failures"> · {t(`${failures} failed`)}</span>}</span></button>
    {open && <div id="transfer-content" className="queue-content">
      <div className="queue-toolbar">
        <button onClick={() => send('queuePause',{paused:!paused})}><Icon name={paused ? 'debug-continue':'debug-pause'} /> {paused ? t("Resume queue"):t("Pause queue")}</button>
        <button disabled={watching || !retryable.length} onClick={() => action('retry',retryable.slice(0,1000).map(j => j.id))}>{t("Retry failed jobs")}</button>
        <span className="badge">{paused ? t(" New starts paused; active transfers continue."):t(" Pause applies globally to new starts.")}</span>
      </div>
      <div className="queue-scroll" tabIndex={0} role="region" aria-label={t("Transfer history")}>
        {!jobs.length ? <p className="queue-empty">{t("No transfers yet. Select files, then upload or download them.")}</p>:<table aria-label={t("Transfer queue")} className="transfer-table"><colgroup><col className="transfer-path-column" /><col className="transfer-direction-column" /><col className="transfer-status-column" /><col className="transfer-bytes-column" /></colgroup><thead><tr><th scope="col">{t("File / destination")}</th><th scope="col">{t("Direction")}</th><th scope="col">{t('Status')}</th><th scope="col" className="numeric">Bytes / Rate</th></tr></thead><tbody>
          {jobs.slice(-200).reverse().map(job => {
            const target=job.finalTarget ?? job.target;
            return <tr key={job.id}>
              <td title={`${job.source} → ${target}`}><span className="transfer-name">{target.split(/[\\/]/).at(-1) || target}</span><span className="transfer-path">{target}</span></td>
              <td><Icon name={job.direction==='upload' ? 'arrow-up':'arrow-down'} /> {job.direction==='upload' ? 'Upload':'Download'}</td>
              <td><span className={`transfer-state state-${job.state}`}><Icon name={icons[job.state] ?? 'circle-outline'} />{t(transferLabels[job.state] ?? job.state)}</span>
                <div className="transfer-actions">
                  {['queued','running'].includes(job.state) && <button onClick={() => action('cancel',[job.id])}>{t("Cancel")}</button>}
                  {['failed','cancelled','interrupted'].includes(job.state) && <><button disabled={watching} onClick={() => action('retry',[job.id])}>{t("Restart from the beginning")}</button>{job.attempt && (job.protocol ?? 'sftp')==='sftp' && <button disabled={watching} onClick={() => action('resume',[job.id])}>{t("Resume after verification")}</button>}</>}
                  {job.attempt && !job.partialCleaned && !job.committed && ['failed','cancelled','interrupted','completed'].includes(job.state) && <button onClick={() => action('cleanup',[job.id])}>{t("Clean up partial file")}</button>}
                </div>
                {(job.error || job.reason) && <span className="transfer-error">{t(job.error || job.reason)}</span>}
              </td><td className="numeric"><span>{job.bytes.toLocaleString(getLanguage())} B</span><span className="transfer-rate">{(job.rate/1024).toFixed(1)} KiB/s</span></td>
            </tr>;
          })}
        </tbody></table>}
      </div>
      <div className="queue-footer"><span>{t("Newest first · For this profile across all sessions.")}</span>{jobs.length>200 && <span>{t("Showing the last 200 jobs.")}</span>}</div>
    </div>}
  </section>;
}
