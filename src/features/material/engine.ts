import type { HeightLayer, MaterialProject } from './model';
import { algorithmField } from './algorithms';
import { particleField } from './particles';
import { motionAttributes, motionMap, phaseSeed } from './animation';
import { effectField, sourceChannels } from './effects';

export type Sample = { h: number; du: number; dv: number };
export type DecodedSource = { id: string; width: number; height: number; pixels: Float32Array; gray?:Float32Array; alpha?:Float32Array };
export type MaterialMaps = { size: number; height: Float32Array; normal: Uint8ClampedArray };
type Field = (u: number, v: number, out: Sample) => void;
const TAU = Math.PI * 2;
const mod = (x: number, n: number) => ((x % n) + n) % n;
const frac = (x: number) => x - Math.floor(x);
const scratch = (): Sample => ({ h: 0, du: 0, dv: 0 });
function hash(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const fadeD = (t: number) => 30 * t * t * (t - 1) * (t - 1);
function noise(n: number, seed: number): Field {
  const grid = n <= 256 ? new Float64Array(n * n) : null;
  if (grid) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) grid[y * n + x] = hash(x, y, seed);
  const at = (x: number, y: number) => grid ? grid[mod(y, n) * n + mod(x, n)] : hash(mod(x, n), mod(y, n), seed);
  return (u, v, o) => {
    const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    const sx = fade(fx), sy = fade(fy), ab = a + (b - a) * sx, cd = c + (d - c) * sx;
    o.h = ab + (cd - ab) * sy;
    o.du = ((b - a) * (1 - sy) + (d - c) * sy) * fadeD(fx) * n;
    o.dv = (cd - ab) * fadeD(fy) * n;
  };
}
function fractal(l: HeightLayer): Field {
  const angle=l.direction==='horizontal'?0:l.direction==='vertical'?Math.PI/2:Math.PI/4;
  const fields = Array.from({ length: l.octaves }, (_, i) => l.algorithm==='value'?noise(l.scale * 2 ** i, (l.seed + i * 1619) >>> 0):algorithmField(l.algorithm,l.scale*2**i,(l.seed+i*1619)>>>0,l.detail,angle));
  const weights = fields.map((_, i) => (0.2 + l.detail * 0.65) ** i);
  const sum = weights.reduce((a, b) => a + b, 0), t = scratch();
  return (u, v, o) => {
    o.h = o.du = o.dv = 0;
    for (let i = 0; i < fields.length; i++) {
      fields[i](u, v, t); const w = weights[i] / sum;
      if (l.kind === 'ridged'||l.transform==='ridged') {
        const sign = t.h < 0.5 ? 2 : -2;
        o.h += (1 - Math.abs(t.h * 2 - 1)) * w; o.du += t.du * sign * w; o.dv += t.dv * sign * w;
      } else if(l.transform==='turbulence'){
        const sign=t.h<.5?-2:2;o.h+=Math.abs(t.h*2-1)*w;o.du+=t.du*sign*w;o.dv+=t.dv*sign*w;
      } else { o.h += t.h * w; o.du += t.du * w; o.dv += t.dv * w; }
    }
  };
}
function cellular(l: HeightLayer): Field {
  const n = l.scale, points = new Float64Array(n * n * 2), cracked = l.kind === 'cracks';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = (y * n + x) * 2;
    points[k] = 0.15 + hash(x, y, l.seed) * 0.7;
    points[k + 1] = 0.15 + hash(x, y, l.seed ^ 0x9e3779b9) * 0.7;
  }
  return (u, v, o) => {
    const x = frac(u) * n, y = frac(v) * n, ix = Math.floor(x), iy = Math.floor(y);
    let f1 = Infinity, f2 = Infinity, x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const cx = ix + dx, cy = iy + dy, k = (mod(cy, n) * n + mod(cx, n)) * 2;
      const vx = x - cx - points[k], vy = y - cy - points[k + 1], d = vx * vx + vy * vy;
      if (d < f1) { f2 = f1; x2 = x1; y2 = y1; f1 = d; x1 = vx; y1 = vy; }
      else if (d < f2) { f2 = d; x2 = vx; y2 = vy; }
    }
    const d1 = Math.max(Math.sqrt(f1), 1e-9), d2 = Math.max(Math.sqrt(f2), 1e-9);
    if (cracked) {
      const width = 0.035 + l.detail * 0.25, raw = (d2 - d1) / width, t = Math.max(0, Math.min(1, raw));
      o.h = t * t * (3 - 2 * t);
      const ds = raw > 0 && raw < 1 ? 6 * t * (1 - t) * n / width : 0;
      o.du = (x2 / d2 - x1 / d1) * ds; o.dv = (y2 / d2 - y1 / d1) * ds;
    } else {
      o.h = Math.max(0, 1 - d1 / 1.2);
      o.du = o.h > 0 ? -x1 / d1 * n / 1.2 : 0; o.dv = o.h > 0 ? -y1 / d1 * n / 1.2 : 0;
    }
  };
}
function directional(l: HeightLayer): Field {
  const n = l.scale, perturb = noise(4, l.seed), t = scratch();
  const ax = l.direction === 'horizontal' ? 0 : 1, ay = l.direction === 'vertical' ? 0 : 1;
  if (l.kind === 'fibers') {
    const fields = Array.from({ length: 4 }, (_, i) => noise(4, (l.seed + i * 1619) >>> 0));
    const weights = fields.map((_, i) => (0.3 + l.detail * 0.5) ** i), total = weights.reduce((a,b)=>a+b,0);
    return (u,v,o) => {
      o.h = o.du = o.dv = 0;
      for (let i=0;i<fields.length;i++) {
        const a=2**i,b=n*2**i,w=weights[i]/total;
        if (l.direction === 'horizontal') { fields[i](u*a,v*b,t);o.du+=t.du*a*w;o.dv+=t.dv*b*w; }
        else if (l.direction === 'vertical') { fields[i](v*a,u*b,t);o.du+=t.dv*b*w;o.dv+=t.du*a*w; }
        else { fields[i]((u+v)*a,(v-u)*b,t);o.du+=(t.du*a-t.dv*b)*w;o.dv+=(t.du*a+t.dv*b)*w; }
        o.h+=t.h*w;
      }
    };
  }
  return (u, v, o) => {
    if (l.kind === 'woven') {
      const a=TAU*n*2*u,b=TAU*n*2*v,pa=(1+Math.cos(a))/2,pb=(1+Math.cos(b))/2;
      const x=pa**3,y=pb**3,dx=-3*pa*pa*Math.sin(a)*TAU*n,dy=-3*pb*pb*Math.sin(b)*TAU*n;
      const mix=(1+Math.cos(a/2)*Math.cos(b/2))/2;
      const mu=-Math.sin(a/2)*Math.cos(b/2)*TAU*n/2,mv=-Math.cos(a/2)*Math.sin(b/2)*TAU*n/2;
      o.h=.12+.86*(mix*x+(1-mix)*y);
      o.du=.86*(mix*dx+mu*(x-y));o.dv=.86*((1-mix)*dy+mv*(x-y));
    } else {
      perturb(u, v, t);
      const distortion = 0.75;
      const phase = TAU * n * (ax * u + ay * v) + (t.h - 0.5) * distortion;
      const derivative = 0.5 * Math.cos(phase);
      o.h = 0.5 + 0.5 * Math.sin(phase);
      o.du = derivative * (TAU * n * ax + t.du * distortion);
      o.dv = derivative * (TAU * n * ay + t.dv * distortion);
    }
  };
}
function spots(l: HeightLayer): Field {
  const n = l.scale, data = new Float64Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = (y * n + x) * 4;
    data[k] = hash(x, y, l.seed);
    data[k + 1] = hash(x, y, l.seed ^ 0x9e3779b9);
    data[k + 2] = 0.08 + hash(x, y, l.seed ^ 171) * (0.15 + l.detail * 0.3);
    data[k + 3] = hash(x, y, l.seed ^ 293) < l.coverage ? 1 : 0;
  }
  return (u, v, o) => {
    const x = frac(u) * n, y = frac(v) * n, ix = Math.floor(x), iy = Math.floor(y);
    let darkness = 0, du = 0, dv = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, k = (mod(cy, n) * n + mod(cx, n)) * 4;
      if (!data[k + 3]) continue;
      const vx = x - cx - data[k], vy = y - cy - data[k + 1], rr = data[k + 2] ** 2;
      const t = (vx * vx + vy * vy) / rr;
      if (t >= 1) continue;
      const power = 1.6 + l.softness * 4;
      darkness += (1 - t) ** power;
      const d = 2 * power * (1 - t) ** (power - 1) * n / rr;
      du += vx * d; dv += vy * d;
    }
    o.h = Math.max(0, 1 - darkness); o.du = o.h > 0 ? du : 0; o.dv = o.h > 0 ? dv : 0;
  };
}
function paper(l: HeightLayer): Field {
  const n=l.scale, fibers=new Float64Array(n*n*8), base=noise(n,l.seed^527), micro=noise(n*4,l.seed^793), a=scratch(), b=scratch();
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const k=(y*n+x)*8,angle=TAU*hash(x,y,l.seed^882);
    fibers[k]=.2+.6*hash(x,y,l.seed);fibers[k+1]=.2+.6*hash(x,y,l.seed^189);
    fibers[k+2]=Math.cos(angle);fibers[k+3]=Math.sin(angle);
    fibers[k+4]=.18+.32*hash(x,y,l.seed^359);fibers[k+5]=.018+.052*l.softness;
    fibers[k+6]=hash(x,y,l.seed^772)<l.coverage?1:0;fibers[k+7]=.45+.55*hash(x,y,l.seed^99);
  }
  return(u,v,o)=>{
    const x=frac(u)*n,y=frac(v)*n,ix=Math.floor(x),iy=Math.floor(y);
    let ink=0,du=0,dv=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const cx=ix+dx,cy=iy+dy,k=(mod(cy,n)*n+mod(cx,n))*8;if(!fibers[k+6])continue;
      const vx=x-cx-fibers[k],vy=y-cy-fibers[k+1],cs=fibers[k+2],sn=fibers[k+3];
      const along=vx*cs+vy*sn,across=-vx*sn+vy*cs,ll=fibers[k+4]**2,ww=fibers[k+5]**2;
      const q=along*along/ll+across*across/ww;if(q>=1)continue;
      const weight=fibers[k+7],s=1-q,d=-6*s*s*weight*n;
      ink+=s*s*s*weight;du+=d*(along*cs/ll-across*sn/ww);dv+=d*(along*sn/ll+across*cs/ww);
    }
    base(u,v,a);micro(u,v,b);const dark=Math.exp(-ink);
    o.h=.93+.1*(a.h-.5)+.12*l.detail*(b.h-.5)-.26*(1-dark);
    o.du=.1*a.du+.12*l.detail*b.du-.26*dark*du;o.dv=.1*a.dv+.12*l.detail*b.dv-.26*dark*dv;
  };
}
function creases(l: HeightLayer): Field {
  const base=fractal(l),t=scratch(),width=.006+.08*l.softness;
  const fields=[noise(3,l.seed^333),noise(3,l.seed^777),noise(3,l.seed^999)],r=scratch();
  const vectors=[[1,0],[0,1],[1,-1]];
  return(u,v,o)=>{
    base(u,v,t);o.h=.86+.08*(t.h-.5);o.du=.08*t.du;o.dv=.08*t.dv;
    for(let i=0;i<fields.length;i++){
      fields[i](u,v,r);const[ax,ay]=vectors[i],distortion=1+l.detail*4;
      const phase=TAU*(l.scale*(ax*u+ay*v)+(r.h-.5)*distortion),sn=Math.sin(phase),cs=Math.cos(phase);
      const valley=Math.exp(-sn*sn/width),weight=i===2?.6:1;
      const d=weight*(.025*cs+.055*valley*2*sn*cs/width);
      o.h+=weight*(.025*sn-.055*valley);
      o.du+=d*TAU*(l.scale*ax+r.du*distortion);o.dv+=d*TAU*(l.scale*ay+r.dv*distortion);
    }
  };
}
function marble(l: HeightLayer): Field {
  const base=fractal({...l,scale:2,detail:.25+l.detail*.15,kind:'noise'}),t=scratch();
  const ax=l.direction==='horizontal'?0:1,ay=l.direction==='vertical'?0:1;
  const width=.003+.11*l.softness,distortion=1+l.detail*5,offset=TAU*hash(0,0,l.seed);
  return(u,v,o)=>{
    base(u,v,t);
    const phase=TAU*(l.scale*(ax*u+ay*v)+(t.h-.5)*distortion)+offset;
    const branch=TAU*((l.scale+2)*(ay*u-ax*v)+(t.h-.5)*distortion*1.5)+offset*.7;
    const sn=Math.sin(phase),sb=Math.sin(branch),dark=Math.exp(-sn*sn/width),fine=Math.exp(-sb*sb/(width*.3));
    const mask=t.h*t.h,d=.83*dark*2*sn*Math.cos(phase)/width;
    const db=.16*mask*fine*2*sb*Math.cos(branch)/(width*.3),dm=-.32*t.h*fine;
    o.h=.975+.04*(t.h-.5)-.83*dark-.16*mask*fine;
    o.du=d*TAU*(l.scale*ax+t.du*distortion)+db*TAU*((l.scale+2)*ay+t.du*distortion*1.5)+(.04+dm)*t.du;
    o.dv=d*TAU*(l.scale*ay+t.dv*distortion)+db*TAU*(-(l.scale+2)*ax+t.dv*distortion*1.5)+(.04+dm)*t.dv;
  };
}
function halftone(l: HeightLayer,sources:DecodedSource[]): Field {
  const n=l.scale,variation=noise(3,l.seed),radii=new Float64Array(n*n),t=scratch();
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    variation((x+.5)/n,(y+.5)/n,t);
    const source=sources.find(s=>s.id===l.sourceId),s=sourceChannels(l,source,(x+.5)/n,(y+.5)/n);
    radii[y*n+x]=source?Math.sqrt((1-s.gray)*s.alpha)*(.06+.5*l.coverage):(.06+.43*l.coverage)*(1-l.detail*.85+l.detail*1.7*t.h);
  }
  return(u,v,o)=>{
    const x=frac(u)*n,y=frac(v)*n,ix=Math.floor(x),iy=Math.floor(y);
    let ink=0,du=0,dv=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const cx=ix+dx,cy=iy+dy,r=radii[mod(cy,n)*n+mod(cx,n)],vx=x-cx-.5,vy=y-cy-.5;
      if(r===0)continue;
      const dist=Math.hypot(vx,vy),edge=.006+.22*l.softness,start=Math.max(.001,r-edge);
      const raw=(dist-start)/(2*edge),t=Math.max(0,Math.min(1,raw));
      ink+=1-t*t*(3-2*t);
      const d=raw>0&&raw<1?3*t*(1-t)*n/(edge*Math.max(dist,1e-9)):0;
      du+=d*vx;dv+=d*vy;
    }
    o.h=Math.max(0,1-ink);o.du=o.h>0?du:0;o.dv=o.h>0?dv:0;
  };
}
function hatch(l: HeightLayer): Field {
  const n=l.scale,variation=noise(3,l.seed),t=scratch(),width=.004+.24*l.coverage,power=1.4+3*l.softness;
  const ax=l.direction==='horizontal'?0:1,ay=l.direction==='vertical'?0:1;
  return(u,v,o)=>{
    variation(u,v,t);
    const a=TAU*n*(ax*u+ay*v),b=TAU*n*(ay*u-ax*v)+TAU*hash(0,0,l.seed);
    const sa=Math.sin(a),sb=Math.sin(b),za=sa*sa/width,zb=sb*sb/width;
    const x=Math.exp(-za*power),y=Math.exp(-zb*power),mix=l.detail*(.35+.65*t.h);
    const da=-2*power*sa*Math.cos(a)*x/width,db=-2*power*sb*Math.cos(b)*y/width;
    const ink=x+mix*y*(1-x);
    o.h=1-ink;
    o.du=-((1-mix*y)*da*TAU*n*ax+mix*(1-x)*db*TAU*n*ay+.65*l.detail*t.du*y*(1-x));
    o.dv=-((1-mix*y)*da*TAU*n*ay-mix*(1-x)*db*TAU*n*ax+.65*l.detail*t.dv*y*(1-x));
  };
}
function interference(l: HeightLayer): Field {
  const n=l.scale,offset=TAU*hash(0,0,l.seed),ax=l.direction==='horizontal'?0:1,ay=l.direction==='vertical'?0:1;
  return(u,v,o)=>{
    const a=TAU*n*(ax*u+ay*v)+offset,b=TAU*(2+4*l.detail)*(.5*Math.cos(TAU*u)+.5*Math.cos(TAU*v))+offset*.7;
    const sa=Math.sin(a),ca=Math.cos(a),cb=Math.cos(b),sb=Math.sin(b),mix=1-l.detail+l.detail*cb;
    o.h=.5+.5*sa*mix;
    o.du=.5*ca*mix*TAU*n*ax+.5*l.detail*sa*sb*TAU*(2+4*l.detail)*.5*TAU*Math.sin(TAU*u);
    o.dv=.5*ca*mix*TAU*n*ay+.5*l.detail*sa*sb*TAU*(2+4*l.detail)*.5*TAU*Math.sin(TAU*v);
  };
}
function contours(l: HeightLayer): Field {
  const base=fractal({...l,kind:'noise',scale:4}),t=scratch(),width=.002+.2*l.coverage,power=1.2+2*l.softness;
  return(u,v,o)=>{
    base(u,v,t);const phase=TAU*l.scale*t.h,sn=Math.sin(phase),dark=Math.exp(-sn*sn*power/width);
    const d=2*sn*Math.cos(phase)*dark*power/width*TAU*l.scale;
    o.h=1-dark;o.du=d*t.du;o.dv=d*t.dv;
  };
}
function lights(l: HeightLayer): Field {
  const n=l.scale,data=new Float64Array(n*n*4),bokeh=l.kind==='bokeh';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const k=(y*n+x)*4;
    data[k]=.1+.8*hash(x,y,l.seed);data[k+1]=.1+.8*hash(x,y,l.seed^839);
    data[k+2]=(.09+.4*l.coverage)*(.7+.6*hash(x,y,l.seed^137));data[k+3]=.4+.6*hash(x,y,l.seed^372);
  }
  return(u,v,o)=>{
    const x=frac(u)*n,y=frac(v)*n,ix=Math.floor(x),iy=Math.floor(y);let sum=0,du=0,dv=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const cx=ix+dx,cy=iy+dy,k=(mod(cy,n)*n+mod(cx,n))*4,vx=x-cx-data[k],vy=y-cy-data[k+1];
      const r=data[k+2],q=(vx*vx+vy*vy)/(r*r),amp=data[k+3];
      if(bokeh){
        const edge=.03+.7*l.softness,raw=(q-(1-edge))/(2*edge),t=Math.max(0,Math.min(1,raw));
        const core=1-t*t*(3-2*t),dc=raw>0&&raw<1?-3*t*(1-t)/edge:0;
        const ring=Math.exp(-(((q-.8)/(.06+.3*l.softness))**2)),dr=-2*(q-.8)/(.06+.3*l.softness)**2*ring;
        const value=.5*core+l.detail*.5*ring,derivative=.5*dc+l.detail*.5*dr;
        sum+=value*amp;du+=derivative*amp*2*vx*n/(r*r);dv+=derivative*amp*2*vy*n/(r*r);
      }else{
        // Compact support at three radii makes the period exact, including its gradient.
        const support=9;if(q>=support)continue;
        const spread=.35+1.4*l.softness,taper=(1-q/support)**3;
        const g=Math.exp(-q/spread),halo=Math.exp(-q/(spread*2.5));
        const value=(g+l.detail*.35*halo)*taper;
        const derivative=(-g/spread-l.detail*.35*halo/(spread*2.5))*taper
          -(g+l.detail*.35*halo)*3*(1-q/support)**2/support;
        sum+=value*amp;du+=derivative*amp*2*vx*n/(r*r);dv+=derivative*amp*2*vy*n/(r*r);
      }
    }
    const gain=Math.exp(-sum*1.6);o.h=1-gain;o.du=1.6*gain*du;o.dv=1.6*gain*dv;
  };
}
function imageField(source: DecodedSource, seamless: boolean): Field {
  const { width: w, height: h, pixels } = source;
  const read: Field = (u, v, o) => {
    const x = frac(u) * (w - 1), y = frac(v) * (h - 1), ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = pixels[iy * w + ix], b = pixels[iy * w + Math.min(ix + 1, w - 1)];
    const c = pixels[Math.min(iy + 1, h - 1) * w + ix], d = pixels[Math.min(iy + 1, h - 1) * w + Math.min(ix + 1, w - 1)];
    o.h = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    o.du = ((b - a) * (1 - fy) + (d - c) * fy) * (w - 1);
    o.dv = ((c - a) * (1 - fx) + (d - b) * fx) * (h - 1);
  };
  if (!seamless) return read;
  const a = scratch(), b = scratch(), c = scratch(), d = scratch();
  return (u, v, o) => {
    const wx = Math.sin(Math.PI * u) ** 2, wy = Math.sin(Math.PI * v) ** 2;
    const dx = Math.PI * Math.sin(TAU * u), dy = Math.PI * Math.sin(TAU * v);
    read(u, v, a); read(u + 0.5, v, b); read(u, v + 0.5, c); read(u + 0.5, v + 0.5, d);
    const top = a.h * wx + b.h * (1 - wx), bottom = c.h * wx + d.h * (1 - wx);
    o.h = top * wy + bottom * (1 - wy);
    o.du = (a.du * wx + b.du * (1 - wx) + (a.h - b.h) * dx) * wy
      + (c.du * wx + d.du * (1 - wx) + (c.h - d.h) * dx) * (1 - wy);
    o.dv = (a.dv * wx + b.dv * (1 - wx)) * wy + (c.dv * wx + d.dv * (1 - wx)) * (1 - wy) + (top - bottom) * dy;
  };
}
function layerField(l: HeightLayer, sources: DecodedSource[],phase=0,frames=72): Field {
  l={...l,seed:phaseSeed(l,phase,frames)};
  let base: Field;
  if (l.kind === 'image') {
    const source = sources.find(s => s.id === l.sourceId); if (!source) throw new Error('灰度源解码失败');
    base = imageField(source, l.tileSource);
  } else if (l.kind === 'particles') base=particleField(l,sources,phase);
  else if (l.kind === 'algorithm') base=algorithmField(l.algorithm,['uniform','gaussian','salt','poisson'].includes(l.algorithm)?l.scale*8:l.scale,l.seed,l.detail);
  else if (l.kind === 'noise' || l.kind === 'ridged') base = fractal(l);
  else if (l.kind === 'cells' || l.kind === 'cracks') base = cellular(l);
  else if (l.kind === 'spots') base = spots(l);
  else if (l.kind === 'paper') base = paper(l);
  else if (l.kind === 'creases') base = creases(l);
  else if (l.kind === 'marble') base = marble(l);
  else if (l.kind === 'halftone') base = halftone(l,sources);
  else if (l.kind === 'hatch') base = hatch(l);
  else if (l.kind === 'interference') base = interference(l);
  else if (l.kind === 'contours') base = contours(l);
  else if (l.kind === 'glow' || l.kind === 'bokeh') base = lights(l);
  else if(l.kind==='fibers'||l.kind==='woven'||l.kind==='waves')base=directional(l);
  else base=effectField(l,sources);
  if(l.kind!=='particles'&&!l.motionLocked&&l.motion!=='none'&&l.motion!=='refresh'){
    const still=base,attributes=motionAttributes(l,phase),map=motionMap(l,phase);
    base=(u,v,o)=>{
      const at=map(u,v);still(at.x,at.y,o);
      const du=o.du,dv=o.dv;
      const pulse=l.motion==='flicker'?1-l.amplitude*(1-Math.cos(TAU*phase*l.cycles+TAU*hash(Math.floor(frac(u)*l.scale),Math.floor(frac(v)*l.scale),l.seed)))/2:attributes.opacity;
      o.h=1-(1-o.h)*pulse;o.du=(du*at.xu+dv*at.yu)*pulse;o.dv=(du*at.xv+dv*at.yv)*pulse;
    };
  }
  const wa = noise(3, l.seed ^ 31337), wb = noise(3, l.seed ^ 71391), a = scratch(), b = scratch();
  return (u, v, o) => {
    const warp = l.kind === 'image'||l.kind==='particles' ? 0 : l.warp * 0.12;
    if (warp) {
      wa(u, v, a); wb(u, v, b);
      base(u + (a.h - 0.5) * warp, v + (b.h - 0.5) * warp, o);
      const du = o.du, dv = o.dv;
      o.du = du * (1 + a.du * warp) + dv * b.du * warp;
      o.dv = du * a.dv * warp + dv * (1 + b.dv * warp);
    } else base(u, v, o);
    const sign = l.invert ? -1 : 1, value = ((o.h - 0.5) * sign * l.contrast) + 0.5 + l.bias;
    const gain = value > 0 && value < 1 ? sign * l.contrast : 0;
    o.h = Math.max(0, Math.min(1, value)); o.du *= gain; o.dv *= gain;
  };
}
export function createSampler(p: MaterialProject, sources: DecodedSource[] = [],phase=p.timeline?.phase??0): Field {
  const layers = p.layers.filter(l => l.visible && l.opacity > 0).map(l => ({ l, field: layerField(l, sources,phase,Math.round((p.timeline?.duration??3)*(p.timeline?.fps??24))) }));
  const t = scratch();
  return (u, v, o) => {
    o.h = 1; o.du = o.dv = 0;
    for (const { l, field } of layers) {
      field(u, v, t);
      let h = t.h, du = t.du, dv = t.dv;
      if (l.blend === 'add') { h = o.h + t.h - 0.5; du += o.du; dv += o.dv; }
      else if (l.blend === 'multiply') { h = o.h * t.h; du = o.du * t.h + t.du * o.h; dv = o.dv * t.h + t.dv * o.h; }
      else if (l.blend === 'max' && o.h >= t.h) { h = o.h; du = o.du; dv = o.dv; }
      o.h += (h - o.h) * l.opacity; o.du += (du - o.du) * l.opacity; o.dv += (dv - o.dv) * l.opacity;
      if (o.h <= 0 || o.h >= 1) { o.h = Math.max(0, Math.min(1, o.h)); o.du = o.dv = 0; }
    }
  };
}
export function encodeNormal(du: number, dv: number, strength: number, directX: boolean, out: Uint8ClampedArray, offset: number) {
  const x = -du * strength * 0.05, y = dv * strength * 0.05, inv = 1 / Math.hypot(x, y, 1);
  out[offset] = Math.round((x * inv * 0.5 + 0.5) * 255);
  const g = Math.round((y * inv * 0.5 + 0.5) * 255);
  out[offset + 1] = directX ? 255 - g : g;
  out[offset + 2] = Math.round((inv * 0.5 + 0.5) * 255); out[offset + 3] = 255;
}
export function renderMaterial(p: MaterialProject, size: number, sources: DecodedSource[] = [], progress?: (v: number) => void,phase=p.timeline?.phase??0): MaterialMaps {
  const sample = createSampler(p, sources,phase), t = scratch(), height = new Float32Array(size * size), normal = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      sample(x / size, y / size, t); const k = y * size + x;
      height[k] = t.h; encodeNormal(t.du, t.dv, p.normal.strength, p.normal.convention === 'directx', normal, k * 4);
    }
    if (y % 32 === 0) progress?.(y / size);
  }
  progress?.(1); return { size, height, normal };
}
