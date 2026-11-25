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

// Every four seconds the rider rolls into the next trick and settles the landing.
const tricks=['ollie','manual','kickflip','shove','doubleFlip','noseManual'];
export function drawSkateboard(ctx,time) {
  begin(ctx);
  const t=time/1000%24, index=Math.floor(t/4), u=t/4-index;
  const trick=tricks[index];
  const balance=trick==='manual' || trick==='noseManual';
  const phase=Math.max(0,Math.min(1,(u-.24)/.54));
  const air=Math.sin(Math.PI*phase);
  const x=157+29*Math.sin(t*tau/12);
  const crouch=u<.24 ? Math.sin(Math.PI*u/.24)*12 : u>.78 ? Math.sin(Math.PI*(u-.78)/.22)*8 : 0;
  const y=145-(balance ? 0:49*air);
  const tilt=balance ? (trick==='manual' ? -.32:.32)*air : -.23*Math.sin(tau*phase);
  const bx=x,by=y-(balance ? 6*air:0);
  const roll=trick==='kickflip' ? tau*phase : trick==='doubleFlip' ? 2*tau*phase : 0;
  const yaw=trick==='shove' ? Math.cos(tau*phase):1;
  const gap=balance ? 0:10*air;
  const hip=[x-4+tilt*28,y-45+crouch-gap], shoulder=[hip[0]+5-tilt*15,hip[1]-26];
  const lilac='#c5adff';
  const arms=[-1,1].map(s=>[[shoulder[0]+s*13,shoulder[1]+9-air*9],[shoulder[0]+s*(20+9*air),shoulder[1]+16-air*25]]);
  const legs=[-1,1].map(s=>{
    const heel=[bx+s*15,by+s*15*Math.sin(tilt)-6-gap];
    return [[x+s*(13+7*air),hip[1]+18],heel,[heel[0]+6,heel[1]]];
  });
  line(ctx,[[71,152],[249,152]],'#766e85',2);
  ctx.save();ctx.translate(bx,by);ctx.rotate(tilt);ctx.scale(yaw,Math.cos(roll));
  for (const s of [-1,1]) disc(ctx,s*16,4,3.3,'#efdaad');
  line(ctx,[[-28,-4],[-23,0],[23,0],[28,-4]],Math.cos(roll)<0 ? '#ff9b8e':lilac,4);
  ctx.restore();
  player(ctx,hip,shoulder,legs,arms,lilac);
}
