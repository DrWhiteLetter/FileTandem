import { useRef,useState } from 'react';
import { translate as t } from '../../src/shared/localization.js';

export function SplitView({split,onChange,localMode=false,children}) {
  const container=useRef(null),pointer=useRef(null);
  const [resizing,setResizing]=useState(false);
  const update=value => onChange(Math.max(30,Math.min(70,Math.round(value))));
  const move=event => {
    if (pointer.current!==event.pointerId) return;
    const element=container.current;
    if (!element.clientWidth) return;
    update((event.clientX-element.getBoundingClientRect().left-element.clientLeft)/element.clientWidth*100);
  };
  const finish=event => {
    if (pointer.current!==event.pointerId) return;
    pointer.current=null;setResizing(false);
  };
  const keyboard=event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step=event.shiftKey ? 10:1;
    const value={ArrowLeft:split-step,ArrowRight:split+step,Home:30,End:70,Enter:50}[event.key];
    if (value===undefined) return;
    event.preventDefault();update(value);
  };
  return <div ref={container} className={`split-view${resizing ? ' is-resizing':''}`} style={{'--local-width':`${split}%`}}>
    <div className="panes">{children}</div>
    <div className="pane-divider" role="separator" tabIndex={0} aria-label={t('Pane width')} aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={split} aria-valuetext={localMode ? t(`Left ${split}%, Right ${100-split}%`):t(`Local ${split}%, Remote ${100-split}%`)} title={t('Drag to resize panes. Double-click to reset.')}
      onPointerDown={event => {
        if (event.button!==0 || pointer.current!==null) return;
        event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current=event.pointerId;setResizing(true);
      }} onPointerMove={move} onPointerUp={event => {move(event);finish(event);}} onPointerCancel={finish} onLostPointerCapture={finish} onDoubleClick={() => update(50)} onKeyDown={keyboard} />
  </div>;
}
