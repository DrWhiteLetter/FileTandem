// Contact, lateral position, duration in 40 ms beats, and height of the next arc.
const sequence = [
  ['R',153,24,38], ['L',150,19,28], ['R',153,14,16], ['R',156,16,21],
  ['R',161,24,36], ['L',166,27,45], ['r',169,20,26], ['l',167,17,19],
  ['l',164,25,28], ['r',162,31,52], ['H',158,26,28], ['H',149,23,20],
  ['H',141,28,29], ['r',138,24,27], ['L',137,22,35], ['R',143,28,51],
  ['L',151,22,0], ['L',151,30,57], ['R',162,17,24], ['L',168,16,21],
  ['R',173,14,16], ['L',177,23,38], ['r',177,18,22], ['R',175,30,47],
  ['l',169,31,50], ['H',164,28,27], ['L',159,26,40], ['R',155,19,26], ['L',151,25,39]
];
const duration = sequence.reduce((sum, step) => sum + step[2], 0);
const mix = (a,b,u) => a+(b-a)*u;
function contact(code,x) {
  if (code==='H') return [x,42];
  const side=code.toUpperCase()==='R' ? 1 : -1;
  return code===code.toUpperCase() ? [x+31*side,111] : [x+22*side,91];
}
export function drawFootball(ctx,time) {
  let beat=(time/40)%duration, index=0;
  while (beat>=sequence[index][2]) beat-=sequence[index++][2];
  const [from,start,length,height]=sequence[index];
  const [to,end]=sequence[(index+1)%sequence.length];
  const u=beat/length, x=mix(start,end,u*u*(3-2*u));
  const weight=code => (from===code ? (height ? Math.cos(u*Math.PI/2)**4 : 1) : 0)
    +(to===code && height ? Math.sin(u*Math.PI/2)**4 : 0);
  const lean=3*(weight('L')+weight('l')-weight('R')-weight('r'));
  const bob=height ? 2*Math.sin(Math.PI*u)**2 : 0;
  const ink='#edf8f2', accent='#95edaa';
  const line=(points,color,width) => {
    ctx.beginPath();ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  const circle=(cx,cy,r,color) => {
    ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
  };
  ctx.clearRect(60,0,200,164);
  ctx.lineCap='round';ctx.lineJoin='round';
  const hip=[x+lean,102+bob], shoulder=[x+lean*2,76+bob];
  for (const [side,code] of [[-1,'L'],[1,'R']]) {
    const foot=weight(code), thigh=weight(code.toLowerCase()), reach=foot+thigh+weight('H');
    const knee=[x+side*(9+9*foot+13*thigh),125-13*foot-24*thigh+bob];
    const heel=[x+side*(11+12*foot+3*thigh),148-26*foot-24*thigh];
    line([hip,knee,heel],ink,5);
    line([heel,[heel[0]+side*8,heel[1]-foot]],accent,6);
    line([shoulder,[shoulder[0]+side*(12+3*reach),90-6*reach+bob],
      [shoulder[0]+side*(20+7*reach),84-11*reach+bob]],ink,4);
  }
  line([hip,shoulder,[shoulder[0],67+bob]],ink,6);
  circle(shoulder[0],60+bob,9,ink);
  const p=contact(from,start), q=contact(to,end);
  const bx=mix(p[0],q[0],u), by=mix(p[1],q[1],u)-4*height*u*(1-u);
  circle(bx,by,8,'#fcfbef');
  circle(bx,by,2.8,'#24333c');
  for (let k=0;k<5;k++) {
    const angle=2*Math.PI*(k/5+(height ? u:0));
    circle(bx+6*Math.cos(angle),by+6*Math.sin(angle),1.5,'#24333c');
  }
}
