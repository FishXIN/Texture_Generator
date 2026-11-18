import type { HeightLayer, HeightSource, MaterialProject } from './model';
import { createParticles } from './particles';
import type { Particle } from './particles';
import { random, frac } from './algorithms';

/** Shared geometry for preview, editable export, placement and hit testing. */
export function artworkSize(o:Particle, source:Pick<HeightSource,'width'|'height'>, width:number) {
  const ratio=source.width/source.height,w=o.size*2*width*o.aspect,h=o.size*2*width;
  return {width:ratio>=1?w:w*ratio,height:ratio>=1?h/ratio:h};
}
export function artworkCopies(l:HeightLayer,o:Particle,width:number,height:number,w:number,h:number) {
  const radius=Math.hypot(w,h)/2,nx=l.repeat===false?0:Math.ceil(radius/width),ny=l.repeat===false?0:Math.ceil(radius/height);
  const copies:{x:number;y:number}[]=[];
  for(let y=-ny;y<=ny;y++)for(let x=-nx;x<=nx;x++){
    const cx=(o.x+x)*width,cy=(o.y+y)*height;
    if(cx+radius<0||cx-radius>width||cy+radius<0||cy-radius>height)continue;
    copies.push({x:cx,y:cy});
  }
  return copies;
}
export function layerParticles(p:MaterialProject,l:HeightLayer,phase=0):Particle[] {
  if(l.role!=='elements'||l.distribution==='manual'||l.repeat!==false&&(l.elementSpacing??-1)<0)return createParticles(l,phase);
  const {width,height}=p.canvas,sources=new Map(p.sources.map(s=>[s.id,s]));
  const bases=createParticles({...l,motion:'none'},0),gap=l.elementSpacing??-1,repeat=l.repeat!==false;
  const dimensions=(o:Particle)=>artworkSize(o,sources.get(o.sourceId)??{width:1,height:1},width);
  const maxRadius=Math.max(1,...bases.map(o=>{const d=dimensions(o);return Math.hypot(d.width,d.height)/2;}));
  const cols=Math.max(1,Math.floor(width/(2*maxRadius+Math.max(0,gap)))),rows=Math.max(1,Math.floor(height/(2*maxRadius+Math.max(0,gap))));
  const bins=new Map<number,{x:number;y:number;r:number}[]>(),placed:Particle[]=[];
  const cell=(x:number,y:number)=>Math.min(rows-1,Math.floor(y/height*rows))*cols+Math.min(cols-1,Math.floor(x/width*cols));
  const overlaps=(x:number,y:number,r:number)=>{
    const cx=Math.floor(x/width*cols),cy=Math.floor(y/height*rows),seen=new Set<number>();
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      let ix=cx+dx,iy=cy+dy;
      if(repeat){ix=(ix+cols)%cols;iy=(iy+rows)%rows;}else if(ix<0||iy<0||ix>=cols||iy>=rows)continue;
      const key=iy*cols+ix;if(seen.has(key))continue;seen.add(key);
      for(const other of bins.get(key)??[]){
        let vx=Math.abs(x-other.x),vy=Math.abs(y-other.y);
        if(repeat){vx=Math.min(vx,width-vx);vy=Math.min(vy,height-vy);}
        if(Math.hypot(vx,vy)<r+other.r+gap-1e-7)return true;
      }
    }
    return false;
  };
  for(const o of bases){
    const d=dimensions(o),r=Math.hypot(d.width,d.height)/2;
    if(repeat&&gap>=0&&2*r+gap>Math.min(width,height))continue;
    const extentX=(Math.abs(o.cs)*d.width+Math.abs(o.sn)*d.height)/2,extentY=(Math.abs(o.sn)*d.width+Math.abs(o.cs)*d.height)/2;
    const left=repeat?0:Math.max(0,extentX+l.edgeMargin),top=repeat?0:Math.max(0,extentY+l.edgeMargin);
    const right=repeat?width:Math.min(width,width-extentX-l.edgeMargin),bottom=repeat?height:Math.min(height,height-extentY-l.edgeMargin);
    if(right<left||bottom<top)continue;
    const rng=random((l.seed+o.order*7919+49157)>>>0),attempts=l.distribution==='random'?64:1;
    for(let attempt=0;attempt<attempts;attempt++){
      const x=attempt?left+rng()*(right-left):o.x*width,y=attempt?top+rng()*(bottom-top):o.y*height;
      if(x<left||x>right||y<top||y>bottom||gap>=0&&overlaps(x,y,r))continue;
      placed.push({...o,x:x/width,y:y/height});const key=cell(x,y),list=bins.get(key)??[];list.push({x,y,r});bins.set(key,list);break;
    }
  }
  // Apply motion after static layout constraints so changing time does not reshuffle the arrangement.
  return createParticles({...l,distribution:'manual',objects:placed},phase);
}
export function artworkHit(p:MaterialProject,l:HeightLayer,o:Particle,x:number,y:number) {
  const source=p.sources.find(s=>s.id===o.sourceId);if(!source)return false;
  const d=artworkSize(o,source,p.canvas.width);
  const dx=(l.repeat===false?x-o.x:frac(x-o.x+.5)-.5)*p.canvas.width;
  const dy=(l.repeat===false?y-o.y:frac(y-o.y+.5)-.5)*p.canvas.height;
  return Math.abs(dx*o.cs+dy*o.sn)<=d.width/2&&Math.abs(-dx*o.sn+dy*o.cs)<=d.height/2;
}
