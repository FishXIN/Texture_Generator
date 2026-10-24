import type { HeightLayer, ManualObject } from './model';
import { frac, hash, mod, TAU } from './algorithms';

export const loopPhase = (phase: number) => frac(phase);
export function curlVelocity(x:number,y:number,seed:number,turbulent=false) {
  let u=0,v=0;
  const count=turbulent?6:3;
  // v = (dψ/dy, -dψ/dx): the divergence of this velocity field is exactly zero.
  for(let i=0;i<count;i++){
    const k=i+1,a=TAU*(k*x+hash(i,0,seed)),b=TAU*((i%3+1)*y+hash(i,1,seed));
    const w=1/(k*k*count);
    u+=Math.sin(a)*Math.cos(b)*(i%3+1)*w;
    v-=Math.cos(a)*Math.sin(b)*k*w;
  }
  return {x:u,y:v};
}
export function flowMap(x:number,y:number,time:number,seed:number,turbulent=false) {
  const steps=12,dt=time/steps;
  for(let i=0;i<steps;i++){
    const a=curlVelocity(x,y,seed,turbulent),b=curlVelocity(x+a.x*dt/2,y+a.y*dt/2,seed,turbulent);
    const c=curlVelocity(x+b.x*dt/2,y+b.y*dt/2,seed,turbulent),d=curlVelocity(x+c.x*dt,y+c.y*dt,seed,turbulent);
    x+=dt*(a.x+2*b.x+2*c.x+d.x)/6;y+=dt*(a.y+2*b.y+2*c.y+d.y)/6;
  }
  return {x,y};
}
export function motionPoint(l:HeightLayer,x:number,y:number,phase:number,index=0,inverse=false) {
  if(l.motionLocked||l.motion==='none')return{x,y};
  const t=TAU*loopPhase(phase)*l.cycles,amp=l.amplitude,sign=inverse?-1:1;
  const angle=l.motionDirection*Math.PI/180,offset=TAU*hash(index,0,l.seed);
  if(l.motion==='flow'||l.motion==='turbulence') return flowMap(x,y,Math.sin(t)*amp*sign,l.seed,l.motion==='turbulence');
  if(l.motion==='vortex'){
    const dx=frac(x-l.centerX+.5)-.5,dy=frac(y-l.centerY+.5)-.5,r=Math.hypot(dx,dy);
    if(r>=.48)return{x,y};
    const a=Math.sin(t)*amp*TAU*(1-(r/.48)**2)**3*sign,cs=Math.cos(a),sn=Math.sin(a);
    return{x:x+dx*(cs-1)-dy*sn,y:y+dx*sn+dy*(cs-1)};
  }
  if(l.motion==='drift') {
    // Full integer tile traversal, so phase 1 is the same image as phase 0.
    const dx=Math.round(Math.cos(angle)*l.cycles),dy=Math.round(Math.sin(angle)*l.cycles);
    return{x:x+phase*dx*sign,y:y+phase*dy*sign};
  }
  if(l.motion==='parallax') return{x:x+amp*Math.sin(t)*Math.cos(angle)*sign,y:y+amp*(Math.cos(t)-1)*Math.sin(angle)*sign};
  if(l.motion==='wander')return{x:x+amp*(Math.sin(t+offset)-Math.sin(offset))*sign,y:y+amp*(Math.cos(t+offset)-Math.cos(offset))*sign};
  if(l.motion==='wave')return{x:x,y:y+amp*Math.sin(TAU*x*l.cycles+t)*sign};
  if(l.motion==='morph'||l.motion==='evolve')return{
    x:x+amp*(Math.sin(t)*Math.sin(TAU*y)+(Math.cos(t)-1)*Math.cos(TAU*x))*sign,
    y:y+amp*(Math.sin(t)*Math.cos(TAU*x)+(Math.cos(t)-1)*Math.sin(TAU*y))*sign,
  };
  return{x,y};
}
export function motionAttributes(l:HeightLayer,phase:number,index=0,object?:ManualObject) {
  if(l.motionLocked||object?.motionLocked||l.motion==='none')return{size:1,opacity:1,aspect:1};
  const t=TAU*loopPhase(phase)*l.cycles,offset=TAU*hash(index,7,l.seed);
  if(l.motion==='breathe')return{size:1+l.amplitude*Math.sin(t),opacity:1-l.amplitude*(1-Math.cos(t))/2,aspect:1};
  if(l.motion==='flicker')return{size:1,opacity:1-l.amplitude*(1-Math.cos(t+offset))/2,aspect:1};
  if(l.motion==='grow') {
    const size=.12+.88*(.5-.5*Math.cos(t+offset));
    return{size,opacity:size,aspect:1};
  }
  if(l.motion==='morph')return{size:1,opacity:1,aspect:1+l.amplitude*Math.sin(t+offset)};
  return{size:1,opacity:1,aspect:1};
}
export function phaseSeed(l:HeightLayer,phase:number,frames:number) {
  return l.motion==='refresh'&&!l.motionLocked
    ? (l.seed+Math.floor(loopPhase(phase)*frames+1e-8)*7919)>>>0:l.seed;
}
export function motionMap(l:HeightLayer,phase:number) {
  const n=48,dx=new Float64Array(n*n),dy=new Float64Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n,at=motionPoint(l,u,v,phase,0,true);
    dx[y*n+x]=at.x-u;dy[y*n+x]=at.y-v;
  }
  const cubic=(a:number,b:number,c:number,d:number,t:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  const derivative=(a:number,b:number,c:number,d:number,t:number)=>.5*((-a+c)+2*(2*a-5*b+4*c-d)*t+3*(-a+3*b-3*c+d)*t*t);
  const sample=(data:Float64Array,u:number,v:number)=>{
    const x=frac(u)*n,y=frac(v)*n,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const rows:number[]=[],du:number[]=[];
    for(let j=-1;j<=2;j++){
      const row=(k:number)=>data[mod(iy+j,n)*n+mod(ix+k,n)];
      const a=row(-1),b=row(0),c=row(1),d=row(2);
      rows.push(cubic(a,b,c,d,fx));du.push(derivative(a,b,c,d,fx)*n);
    }
    return{h:cubic(rows[0],rows[1],rows[2],rows[3],fy),du:cubic(du[0],du[1],du[2],du[3],fy),dv:derivative(rows[0],rows[1],rows[2],rows[3],fy)*n};
  };
  return(u:number,v:number)=>{
    const a=sample(dx,u,v),b=sample(dy,u,v);
    return{x:u+a.h,y:v+b.h,xu:1+a.du,xv:a.dv,yu:b.du,yv:1+b.dv};
  };
}
