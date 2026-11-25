// Both scenes share the football canvas coordinates. The floor is at y=151.
const tau=2*Math.PI;
const mix=(a,b,u)=>a+(b-a)*u;
const ease=u=>u*u*(3-2*u);
function line(ctx,points,color,width) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function disc(ctx,x,y,r,color) {
  ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.fillStyle=color;ctx.fill();
}
function begin(ctx) {
  ctx.clearRect(60,0,200,164);
  ctx.lineCap='round';ctx.lineJoin='round';
}
const chalk='#f5f3f2';
function player(ctx,hip,shoulder,legs,arms,accent) {
  for (const [knee,heel,toe] of legs) {
    line(ctx,[hip,knee,heel],chalk,5);
    line(ctx,[heel,toe],accent,6);
  }
  line(ctx,[hip,shoulder,[shoulder[0],shoulder[1]-8]],chalk,5);
  disc(ctx,shoulder[0],shoulder[1]-16,9,chalk);
  for (const [elbow,hand] of arms) line(ctx,[shoulder,elbow,hand],chalk,4);
}

export function drawBasketball(ctx,time) {
  begin(ctx);
  const t=time/1000%24;
  const orange='#ffae66';
  // Backboard, net and rim sit behind the shooter and ball.
  line(ctx,[[237,24],[237,53]],'#d6c9bb',3);
  line(ctx,[[214,45],[219,56],[229,56],[234,45]],'#bbaea0',2);
  line(ctx,[[213,44],[236,44]],orange,3);
  let x=144, bounce=0, lift=0, bx,by;
  let left=[120,95],right=[170,95];
  if (t<12 || t>=22) {
    // Two right-hand bounces, cross, two left, cross back. Increase the cadence.
    const order=[1,1,1,-1,-1,-1,1];
    const phase=t>=22 ? (t-22)*3 : t<6 ? t : (t-6)*2;
    const i=Math.floor(phase)%6, u=phase%1;
    const a=order[i],b=order[i+1];
    bounce=1-Math.abs(2*u-1)**2;
    x+=5*Math.sin(tau*phase/6);
    bx=x+26*mix(a,b,ease(u));
    by=92+48*(1-(Math.abs(2*u-1))**0.65);
    left=[x-26,82+18*bounce*(a===-1 || b===-1)];
    right=[x+26,82+18*bounce*(a===1 || b===1)];
  } else if(t<17) {
    // Lift the ball from the dribble and balance it on a rotating fingertip.
    const liftHand=ease(Math.min(1,(t-12)/0.8));
    const spin=Math.sin((t-12)*tau)*liftHand;
    bx=x+26+3*spin;by=mix(92,48,liftHand);
    right=[bx,mix(82,by+10,liftHand)];
    left=[x-26,mix(82,94,liftHand)];
  } else {
    const s=t-17;
    const prep=ease(Math.min(1,s/0.7));
    const reach=s<1 ? prep : 1-ease(Math.min(1,(s-1)/1.2));
    lift=19*Math.sin(Math.PI*Math.min(1,Math.max(0,(s-.45)/1.05)));
    right=[x+mix(26,15,reach),mix(82,40,reach)-lift];
    left=[x+mix(-26,7,reach),mix(83,42,reach)-lift];
    if (s<0.7) {
      right=[mix(x+26,x+15,prep),mix(58,40,prep)-lift];
      left=[mix(x-26,x+7,prep),mix(94,42,prep)-lift];
      bx=mix(x+26,x+16,prep);by=mix(48,35,prep)-lift; }
    else if (s<2) {
      const u=(s-.7)/1.3;
      bx=mix(x+16,224,u);by=mix(35-19*Math.sin(Math.PI*.25/1.05),44,u)-52*u*(1-u);
    } else if (s<2.8) {
      const u=(s-2)/.8;
      bx=224-8*u;by=mix(44,140,u*u);
    } else {
      const u=(s-2.8)/2.2;
      bx=mix(216,170,u);by=mix(140,92,u)-120*u*(1-u);
    }
  }
  const hip=[x,106+4*bounce-lift], shoulder=[x+2,77+4*bounce-lift];
  player(ctx,hip,shoulder,[-1,1].map(side=>[[x+side*17,127+3*bounce-lift],[x+side*19,148-lift],[x+side*26,148-lift]]),
    [[[x-17,shoulder[1]+13],left],[[x+20,shoulder[1]+8],right]],orange);
  ctx.save();ctx.translate(bx,by);ctx.rotate(t*3);
  disc(ctx,0,0,10,'#ff9a45');
  line(ctx,[[-9,0],[9,0]],'#63341e',1.8);
  ctx.beginPath();ctx.ellipse(0,0,3.8,9,0,0,tau);ctx.strokeStyle='#63341e';ctx.lineWidth=1.6;ctx.stroke();
  ctx.restore();
}

// The wheels and the painted surface follow the same circular transitions.
const flatHalf=29, radius=49, lipAngle=1.22, floorY=150;
const flatTime=0.47, transitTime=1.20, airTime=1.16;
const approach=flatTime+transitTime, pass=2*approach+airTime;
const rampTricks=['grab','kickflip','shove','tuck','doubleFlip','boneless'];
function rampPoint(side,theta) {
  return [160+side*(flatHalf+radius*Math.sin(theta)), floorY-radius*(1-Math.cos(theta))];
}
function paintRamp(ctx) {
  const [left,lipY]=rampPoint(-1,lipAngle);
  ctx.beginPath();ctx.moveTo(62,lipY);ctx.lineTo(left,lipY);
  ctx.arc(160-flatHalf,floorY-radius,radius,Math.PI/2+lipAngle,Math.PI/2,true);
  ctx.lineTo(160+flatHalf,floorY);
  ctx.arc(160+flatHalf,floorY-radius,radius,Math.PI/2,Math.PI/2-lipAngle,true);
  ctx.lineTo(258,lipY);ctx.lineTo(258,163);ctx.lineTo(62,163);ctx.closePath();
  ctx.fillStyle='#775542';ctx.fill();
  for (const side of [-1,1]) {
    const [lip]=rampPoint(side,lipAngle);
    const edge=160+side*98;
    line(ctx,[[edge,lipY],[lip,lipY]],'#e2d0bc',3);
    for(const theta of [0.44,0.88]) {
      const [x,y]=rampPoint(side,theta);
      line(ctx,[[x,y+2],[x+side*6,y+12]],'#916d54',1.5);
    }
    disc(ctx,lip,lipY,2.4,'#f2d9bd');
  }
  ctx.beginPath();
  ctx.arc(160-flatHalf,floorY-radius,radius,Math.PI/2+lipAngle,Math.PI/2,true);
  ctx.lineTo(160+flatHalf,floorY);
  ctx.arc(160+flatHalf,floorY-radius,radius,Math.PI/2,Math.PI/2-lipAngle,true);
  ctx.strokeStyle='#d8ae85';ctx.lineWidth=2.5;ctx.stroke();
}

export function drawSkateboard(ctx,time) {
  begin(ctx);
  paintRamp(ctx);
  const seconds=time/1000, index=Math.floor(seconds/pass), t=seconds%pass;
  const side=index%2 ? -1:1, trick=rampTricks[index%rampTricks.length];
  const travel=Math.min(t,pass-t,approach);
  const theta=lipAngle*Math.max(0,travel-flatTime)/transitTime;
  const [wallX,wallY]=rampPoint(side,theta);
  const phase=Math.max(0,Math.min(1,(t-approach)/airTime));
  const air=4*phase*(1-phase);
  const surfaceAngle=-side*theta;
  const x=travel<flatTime ? 160+side*flatHalf*travel/flatTime:wallX;
  const boardX=x+Math.sin(surfaceAngle)*4+side*7*air;
  const boardY=wallY-Math.cos(surfaceAngle)*4-35*air;
  const tilt=surfaceAngle*(1-air)+side*(trick==='grab' ? 0.24:-0.12)*air;
  const flip=trick==='kickflip' || trick==='doubleFlip';
  const spin=ease(phase)*tau;
  const tuck=(trick==='tuck' ? 9:5)*air;
  const gap=(flip || trick==='shove' ? 6:1)*air;

  ctx.save();ctx.translate(boardX,boardY);ctx.rotate(tilt);
  ctx.scale(trick==='shove' ? Math.cos(spin):1,flip ? Math.cos(spin*(trick==='doubleFlip' ? 2:1)):1);
  for (const s of [-1,1]) disc(ctx,s*10,2,2.5,'#ffd69d');
  line(ctx,[[-19,-2.5],[-15,0],[15,0],[19,-2.5]],flip && Math.cos(spin*(trick==='doubleFlip'?2:1))<0 ? '#ff927f':'#ceb9ff',3.5);
  ctx.restore();

  // Lean into the transition, compress on the flat, then pull the knees up.
  ctx.save();ctx.translate(boardX,boardY);ctx.scale(side,1);
  const boardAngle=side*tilt;
  const hip=[-10*theta, -30+3*Math.cos(theta)-gap];
  const facing=Math.min(1,travel/flatTime);
  const shoulder=[hip[0]-7*theta+3*facing,hip[1]-19+tuck];
  const legs=[-1,1].map(s=>{
    const kick=trick==='boneless' && s===1 ? 13*air:0;
    const heel=[s*9*Math.cos(boardAngle)+kick,s*9*Math.sin(boardAngle)-4-gap-kick];
    return [[s*(10+tuck)+hip[0]*0.55,hip[1]+9],heel,[heel[0]+4*facing,heel[1]]];
  });
  const arms=[-1,1].map(s=>{
    const grab=trick==='grab' && s===1 ? air:0;
    const elbow=[shoulder[0]+s*10,shoulder[1]+7];
    const hand=[mix(shoulder[0]+s*(15+6*air),12,grab),mix(shoulder[1]+9-17*air,-5,grab)];
    return [elbow,hand];
  });
  player(ctx,hip,shoulder,legs,arms,'#d3baff');
  ctx.restore();
}
