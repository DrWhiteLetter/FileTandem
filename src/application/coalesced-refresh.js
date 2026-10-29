/** Batch bursts without starving updates; never overlap directory requests. */
export function coalescedRefresh(refresh,{delay=250}={}) {
  let timer,pending=false,running=false,disposed=false;
  const schedule=() => {
    if (disposed || running || timer!==undefined || !pending) return;
    timer=setTimeout(async () => {
      timer=undefined;pending=false;running=true;
      try {await refresh();}
      finally {running=false;schedule();}
    },delay);
  };
  return {
    request() {if (disposed) return;pending=true;schedule();},
    dispose() {disposed=true;pending=false;clearTimeout(timer);timer=undefined;}
  };
}
