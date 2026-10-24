import type { HeightLayer, ManualObject, ParticleShape } from './model';
import type { DecodedSource } from './engine';
import { bluePoints, clamp, frac, mod, numerical, random, TAU, torusDistance } from './algorithms';
import type { Field, Point } from './algorithms';
import { motionAttributes, motionPoint } from './animation';

export type Particle = ManualObject & { outline:Point[]; hole:boolean; radius:number; cs:number; sn:number; order:number };
export function shapeOutline(shape:ParticleShape,seed:number):Point[] {
  const rng=random(seed),count=shape==='square'?4:shape==='polygon'?5:shape==='star'?10:32,points:Point[]=[];
  if(shape==='square')return[{x:-1,y:-1},{x:1,y:-1},{x:1,y:1},{x:-1,y:1}];
  if(shape==='line')return[{x:-1,y:-.12},{x:1,y:-.12},{x:1,y:.12},{x:-1,y:.12}];
  if(shape==='symbol')return[{x:-.25,y:-1},{x:.25,y:-1},{x:.25,y:-.25},{x:1,y:-.25},{x:1,y:.25},{x:.25,y:.25},{x:.25,y:1},{x:-.25,y:1},{x:-.25,y:.25},{x:-1,y:.25},{x:-1,y:-.25},{x:-.25,y:-.25}];
  const radii=Array.from({length:8},()=>.5+rng()*.5);
  for(let i=0;i<count;i++){
    const angle=TAU*i/count-Math.PI/2;
    let r=1;
    if(shape==='star')r=i%2?.42:1;
    if(shape==='blob'||shape==='splatter'||shape==='debris'){
      const k=i/count*8,a=Math.floor(k),t=k-a;
      r=radii[a]*(1-t)+radii[(a+1)%8]*t;
      if(shape==='splatter'&&i%8===0)r*=1.5;
      if(shape==='debris')r*=.75+rng()*.25;
    }
    if(shape==='flower')r=.62+.38*Math.cos(5*angle);
    if(shape==='leaf'){
      points.push({x:Math.cos(angle),y:Math.sin(angle)*(.35+.25*Math.abs(Math.sin(angle)))});continue;
    }
    points.push({x:Math.cos(angle)*r,y:Math.sin(angle)*r});
  }
  return points;
}
export function pathPositions(path:Point[],count:number):{x:number;y:number;angle:number}[] {
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y)),total=lengths.reduce((a,b)=>a+b,0);
  if(total<1e-9)return Array.from({length:count},()=>({...path[0],angle:0}));
  return Array.from({length:count},(_,i)=>{
    let d=total*(count===1?.5:i/(count-1)),j=0;
    while(j<lengths.length-1&&d>lengths[j]){d-=lengths[j];j++;}
    const a=path[j],b=path[j+1],t=lengths[j]>0?d/lengths[j]:0;
    return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
  });
}
export function createParticles(l:HeightLayer,phase=0):Particle[] {
  const rng=random(l.seed),count=l.count,grid=Math.max(1,Math.ceil(Math.sqrt(count)));
  const path=l.distribution==='path'?pathPositions(l.path,count):[];
  const bound=(l.shape==='square'||l.shape==='custom'?Math.SQRT2:l.shape==='splatter'?1.5:1)+l.softness*.4;
  const blue=l.distribution==='blue'||l.distribution==='spaced'
    ?bluePoints(Math.min(512,count),l.seed,l.distribution==='spaced'?Math.max(l.spacing,2*l.sizeMax*Math.max(l.aspect,1)*bound):0):[];
  const clusters=Array.from({length:Math.max(2,Math.round(l.scale/3))},()=>({x:rng(),y:rng()}));
  const bases:ManualObject[]=l.distribution==='manual'?structuredClone(l.objects):[];
  const totalWeight=l.sourceMix.reduce((a,b)=>a+b.weight,0);
  for(let i=0;i<(l.distribution==='manual'?0:count);i++){
    let x=rng(),y=rng(),angle=l.angleMin+(l.angleMax-l.angleMin)*rng(),flipX=false,flipY=false;
    if(l.distribution==='grid'||l.distribution==='stagger'||l.distribution==='mirror'){
      const row=Math.floor(i/grid),col=i%grid;
      x=(col+.5+(l.distribution==='stagger'&&row%2?.5:0))/grid;y=(row+.5)/grid;
      if(l.distribution==='mirror'){flipX=col%2===1;flipY=row%2===1;}
    }else if(l.distribution==='cluster'){
      const c=l.kind==='spray'?{x:l.centerX,y:l.centerY}:clusters[i%clusters.length],a=TAU*rng();
      const r=l.kind==='spray'?Math.sqrt(-2*Math.log(Math.max(1e-9,rng())))*(.015+.07*l.coverage):Math.sqrt(rng())*(.015+.18*l.coverage);
      x=c.x+Math.cos(a)*r;y=c.y+Math.sin(a)*r;
    }else if(l.distribution==='blue'||l.distribution==='spaced'){
      if(!blue[i])continue;x=blue[i].x;y=blue[i].y;
    }else if(l.distribution==='gradient'){
      x=Math.sqrt(x); // density rises linearly from left to right; separate from size / opacity.
    }else if(l.distribution==='radial'){
      const rings=Math.max(1,Math.round(Math.sqrt(count)/2)),ring=i%rings+1,turn=Math.floor(i/rings),perRing=Math.ceil(count/rings);
      const a=TAU*turn/perRing,r=.45*ring/rings;x=l.centerX+Math.cos(a)*r;y=l.centerY+Math.sin(a)*r;angle+=a*180/Math.PI;
    }else if(l.distribution==='path'){x=path[i].x;y=path[i].y;angle+=path[i].angle;}
    else if(l.distribution==='kaleidoscope'){
      const sector=i%l.sectors,group=Math.floor(i/l.sectors),local=random(l.seed+group*7919);
      let a=local()*Math.PI/l.sectors;
      if(sector%2){a=-a;flipY=true;}
      a+=TAU*sector/l.sectors;const r=Math.sqrt(local())*.45;
      x=l.centerX+Math.cos(a)*r;y=l.centerY+Math.sin(a)*r;angle=a*180/Math.PI;
    }
    const attributes=l.distribution==='kaleidoscope'?random(l.seed+Math.floor(i/l.sectors)*7919+991):rng;
    let sourceId=l.sourceId;
    if(totalWeight>0){let roll=attributes()*totalWeight;for(const s of l.sourceMix){roll-=s.weight;if(roll<=0){sourceId=s.id;break;}}}
    bases.push({id:`particle-${i}`,x:frac(x),y:frac(y),angle,size:l.sizeMin+(l.sizeMax-l.sizeMin)*attributes(),aspect:l.aspect,
      gray:l.grayMin+(l.grayMax-l.grayMin)*attributes(),opacity:l.alphaMin+(l.alphaMax-l.alphaMin)*attributes(),
      shape:l.shape,sourceId,flipX,flipY,locked:false,motionLocked:false});
  }
  return bases.map((p,i)=>{
    const at=p.motionLocked?{x:p.x,y:p.y}:motionPoint(l,p.x,p.y,phase,i),attr=motionAttributes(l,phase,i,p);
    const size=p.size*attr.size,aspect=p.aspect*attr.aspect,angle=p.angle*Math.PI/180;
    const outlineSeed=p.outlineSeed??(l.distribution==='manual'?[...p.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17):(l.seed+(l.distribution==='kaleidoscope'?Math.floor(i/l.sectors):i)*137)>>>0);
    const outline=shapeOutline(p.shape,outlineSeed);
    const radius=p.shape==='custom'?size*Math.hypot(aspect,1):size*Math.max(1,aspect)*(Math.max(...outline.map(q=>Math.hypot(q.x,q.y)))+l.softness*.4);
    return{...p,outlineSeed,x:frac(at.x),y:frac(at.y),size,aspect,opacity:p.opacity*attr.opacity,outline,hole:p.shape==='ring',radius,cs:Math.cos(angle),sn:Math.sin(angle),order:i};
  });
}
function signedDistance(x:number,y:number,points:Point[]) {
  let inside=false,distance=Infinity;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1));
    distance=Math.min(distance,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));
  }
  return inside?-distance:distance;
}
export function sourceValue(s:DecodedSource,u:number,v:number,channel:'gray'|'alpha'='gray') {
  const values=channel==='alpha'?s.alpha:s.gray??s.pixels;
  if(!values)return 1;
  const x=clamp(u)*(s.width-1),y=clamp(v)*(s.height-1),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const a=values[iy*s.width+ix],b=values[iy*s.width+Math.min(ix+1,s.width-1)];
  const c=values[Math.min(iy+1,s.height-1)*s.width+ix],d=values[Math.min(iy+1,s.height-1)*s.width+Math.min(ix+1,s.width-1)];
  return(a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
}
export function particleField(l:HeightLayer,sources:DecodedSource[],phase=0):Field {
  const particles=createParticles(l,phase),radius=Math.max(.001,...particles.map(p=>p.radius));
  const bins=Math.max(1,Math.min(64,Math.floor(1/Math.max(.025,radius*2)))),grid=new Map<number,Particle[]>();
  for(const p of particles){
    const key=Math.floor(p.y*bins)*bins+Math.floor(p.x*bins),list=grid.get(key)??[];list.push(p);grid.set(key,list);
  }
  const lookup=new Map(sources.map(s=>[s.id,s]));
  return numerical((u,v)=>{
    const x=frac(u),y=frac(v),ix=Math.floor(x*bins),iy=Math.floor(y*bins),seen=new Set<number>();let h=l.baseGray;
    const candidates:Particle[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const key=mod(iy+dy,bins)*bins+mod(ix+dx,bins);
      if(!seen.has(key)){seen.add(key);candidates.push(...grid.get(key)??[]);}
    }
    // Consistent stacking order with the vector exporter.
    candidates.sort((a,b)=>a.order-b.order);
    for(const p of candidates){
      const shade=(dx:number,dy:number)=>{
        if(Math.hypot(dx,dy)>p.radius)return;
        const a=(dx*p.cs+dy*p.sn)/Math.max(1e-8,p.size*p.aspect)*(p.flipX?-1:1);
        const b=(-dx*p.sn+dy*p.cs)/Math.max(1e-8,p.size)*(p.flipY?-1:1);
        let alpha=0,gray=p.gray;
        if(p.shape==='custom'){
          const s=lookup.get(p.sourceId);if(!s||Math.abs(a)>1||Math.abs(b)>1)return;
          alpha=sourceValue(s,(a+1)/2,(b+1)/2,'alpha');gray=sourceValue(s,(a+1)/2,(b+1)/2);
        }else{
          let d=p.shape==='circle'||p.shape==='ellipse'||p.shape==='ring'?Math.hypot(a,b)-1:signedDistance(a,b,p.outline);
          if(p.hole)d=Math.max(d,.62-Math.hypot(a,b));
          const edge=l.softness*.4;
          if(edge===0)alpha=d<=0?1:0;
          else{const t=clamp((d+edge)/(2*edge));alpha=1-t*t*(3-2*t);}
        }
        alpha*=p.opacity;h=h*(1-alpha)+gray*alpha;
      };
      if(p.radius<=.5)shade(frac(x-p.x+.5)-.5,frac(y-p.y+.5)-.5);
      else{
        // Large or elongated stamps can overlap their own periodic copies.
        // Composite every contributing copy in the same order as SVG.
        for(let dy=Math.ceil(y-p.y-p.radius);dy<=Math.floor(y-p.y+p.radius);dy++)
          for(let dx=Math.ceil(x-p.x-p.radius);dx<=Math.floor(x-p.x+p.radius);dx++)
            shade(x-p.x-dx,y-p.y-dy);
      }
    }
    return h;
  },1e-7);
}
export function minimumParticleDistance(particles:Particle[]) {
  let minimum=Infinity;
  for(let i=0;i<particles.length;i++)for(let j=0;j<i;j++)minimum=Math.min(minimum,torusDistance(particles[i],particles[j]));
  return minimum;
}
