import {useState, useEffect, useRef} from 'react';
import {drawFootball} from './football.js';
import {drawBasketball,drawSkateboard} from './court-sports.js';
import {transferSports} from '../../src/shared/browser-settings.js';

const renderers={football:drawFootball,basketball:drawBasketball,skateboard:drawSkateboard};
export function TransferSport({mode}) {
  const [randomSport]=useState(() => transferSports[Math.floor(Math.random()*transferSports.length)]);
  const sport=mode==='random' ? randomSport:mode;
  const draw=renderers[sport];
  const ref=useRef(null);
  useEffect(() => {
    const canvas=ref.current, ctx=canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(2,0,0,2,-120,0);
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame,last=0,elapsed=0;
    const tick=now => {
      if (now-last>=32) {
        elapsed+=now-last;last=now;draw(ctx,elapsed);
      }
      frame=requestAnimationFrame(tick);
    };
    const refresh=() => {
      cancelAnimationFrame(frame);
      draw(ctx,elapsed);
      if (!media.matches && !document.hidden && !document.body.classList.contains('vscode-reduce-motion')) {
        last=performance.now();frame=requestAnimationFrame(tick);
      }
    };
    const observer=new MutationObserver(refresh);
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    media.addEventListener('change',refresh);document.addEventListener('visibilitychange',refresh);refresh();
    return () => {cancelAnimationFrame(frame);observer.disconnect();media.removeEventListener('change',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[draw]);
  return <div className={`transfer-sport sport-${sport}`} aria-hidden="true"><canvas ref={ref} width="400" height="328" /></div>;
}
