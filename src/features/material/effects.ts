import type { HeightLayer } from './model';
import type { DecodedSource } from './engine';
import { algorithmField, clamp, frac, hash, heightAt, mod, numerical, random, TAU } from './algorithms';
import type { Field } from './algorithms';
import { particleField, sourceValue } from './particles';

const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function sourceChannels(l:HeightLayer,s:DecodedSource|undefined,u:number,v:number) {
  if(!s)return{gray:.5+.4*Math.cos(TAU*u)*Math.cos(TAU*v),alpha:1};
  const read=(x:number,y:number)=>({gray:sourceValue(s,frac(x),frac(y)),alpha:sourceValue(s,frac(x),frac(y),'alpha')});
  if(!l.tileSource)return read(u,v);
  const a=read(u,v),b=read(u+.5,v),c=read(u,v+.5),d=read(u+.5,v+.5);
  const wx=Math.sin(Math.PI*u)**2,wy=Math.sin(Math.PI*v)**2;
  return {
    gray:(a.gray*wx+b.gray*(1-wx))*wy+(c.gray*wx+d.gray*(1-wx))*(1-wy),
    alpha:(a.alpha*wx+b.alpha*(1-wx))*wy+(c.alpha*wx+d.alpha*(1-wx))*(1-wy),
  };
}
export function effectField(l:HeightLayer,sources:DecodedSource[]):Field {
  const n=l.scale,source=sources.find(s=>s.id===l.sourceId),seed=l.seed;
  const low=algorithmField(l.algorithm==='uniform'||l.algorithm==='salt'||l.algorithm==='poisson'||l.algorithm==='gaussian'?'perlin':l.algorithm,Math.max(2,Math.round(n/4)),seed,l.detail);
  const medium=algorithmField('value',n,seed^931),fine=algorithmField('value',n*4,seed^731),rough=algorithmField('value',n*12,seed^777);
  const cell=algorithmField('worley',n,seed),white=algorithmField('uniform',n*8,seed);
  const read=(f:Field,u:number,v:number)=>heightAt(f,u,v),L=(u:number,v:number)=>read(low,u,v),M=(u:number,v:number)=>read(medium,u,v),F=(u:number,v:number)=>read(fine,u,v),R=(u:number,v:number)=>read(rough,u,v);
  const ax=l.direction==='horizontal'?0:1,ay=l.direction==='vertical'?0:1;
  const along=(u:number,v:number)=>ay*u-ax*v,across=(u:number,v:number)=>ax*u+ay*v;
  const pixel=(u:number,v:number,k=n*8)=>hash(mod(Math.floor(u*k),k),mod(Math.floor(v*k),k),seed);
  const input=(u:number,v:number)=>sourceChannels(l,source,u,v);
  const ink=(u:number,v:number)=>{const s=input(u,v);return(1-s.gray)*s.alpha;};
  const edge=(u:number,v:number)=>{
    const e=1/Math.max(64,n*8);return clamp(Math.hypot(ink(u+e,v)-ink(u-e,v),ink(u,v+e)-ink(u,v-e))*4);
  };
  const response=(u:number,v:number)=>{
    if(l.response==='dark')return ink(u,v);
    if(l.response==='edge')return edge(u,v);
    if(l.response==='alpha')return input(u,v).alpha;
    return 1;
  };
  const halftone=['halftoneSquare','halftoneEllipse','halftoneLine','ditherRandom','ditherOrdered'].includes(l.kind);
  if(halftone){
    const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    return numerical((u,v)=>{
      const x=frac(u)*n,y=frac(v)*n,cx=Math.floor(x),cy=Math.floor(y);
      const s=input((cx+.5)/n,(cy+.5)/n),tone=source?clamp(1-(1-s.gray)*s.alpha):clamp(.5+.45*Math.cos(TAU*u));
      if(l.kind==='ditherRandom')return tone>pixel(u,v,n*4)?1:0;
      if(l.kind==='ditherOrdered')return tone>(bayer[mod(Math.floor(v*n*4),4)*4+mod(Math.floor(u*n*4),4)]+.5)/16?1:0;
      if(tone===1)return 1;
      const width=Math.sqrt(1-tone)*(.15+.5*l.coverage),dx=Math.abs(frac(x)-.5),dy=Math.abs(frac(y)-.5);
      const d=l.kind==='halftoneSquare'?Math.max(dx,dy):l.kind==='halftoneLine'?dy:Math.hypot(dx/l.aspect,dy);
      return smooth(width-.002-l.softness*.08,width+.002+l.softness*.08,d);
    },1e-7);
  }
  if(l.kind==='spray'||l.kind==='dust'||l.kind==='sand'){
    const stamp=particleField({...l,distribution:l.kind==='spray'?'cluster':l.distribution,
      shape:l.kind==='dust'?'debris':l.kind==='sand'?'polygon':'circle',
      count:l.count,sizeMin:l.sizeMin,sizeMax:l.sizeMax,softness:l.softness},sources);
    return numerical((u,v)=>1-(1-read(stamp,u,v))*response(u,v),1e-7);
  }
  if(l.kind==='scratches'||l.kind==='brushed'){
    const rng=random(seed),curves=Array.from({length:Math.max(4,Math.round(n*(l.kind==='brushed'?8:1)))},()=>({
      start:rng(),length:.1+rng()*.75,position:rng(),width:(.0004+.002*l.coverage)*(.5+rng()),wiggle:rng()*.025,phase:TAU*rng(),strength:.3+.7*rng(),
    }));
    return numerical((u,v)=>{
      const a=frac(along(u,v)),b=frac(across(u,v));let density=0;
      for(const c of curves){
        const t=frac(a-c.start),end=l.kind==='brushed'?1:c.length;
        if(t>end)continue;
        const center=c.position+c.wiggle*Math.sin(TAU*t+c.phase)+c.wiggle*.25*Math.sin(TAU*t*3+c.phase);
        const d=frac(b-center+.5)-.5,tip=l.kind==='brushed'?1:Math.sin(Math.PI*t/end)**.5;
        density+=Math.exp(-d*d/(c.width*c.width))*tip*c.strength;
      }
      return Math.exp(-density);
    },1e-7);
  }
  const generated=numerical((u,v)=>{
    const low=L(u,v),mid=M(u,v),fine=F(u,v),rough=R(u,v),a=along(u,v),b=across(u,v),cov=l.coverage,detail=l.detail;
    if(l.kind==='film'||l.kind==='oldphoto'){
      const grain=read(white,u,v)*(.3+.7*fine),tone=input(u,v),sensitivity=l.response==='dark'?(1-tone.gray)*tone.alpha:response(u,v);
      let darkness=grain*cov*sensitivity;
      if(l.kind==='oldphoto')darkness+=cov*.4*smooth(.4,.8,low)+.12*smooth(.6,.8,mid);
      return 1-clamp(darkness);
    }
    if(l.kind==='copier'){
      const toner=ink(u,v),threshold=.12+pixel(u,v)*(.2+detail*.5),deposit=smooth(threshold-.04,threshold+.04,toner+edge(u,v)*.35);
      return 1-deposit*(.6+.4*fine);
    }
    if(l.kind==='pulp')return .95-.3*smooth(.3,.8,low)*(.3+.7*fine)-.1*rough;
    if(l.kind==='stains')return 1-cov*smooth(.42,.7,low+mid*.25)*(.4+.6*fine);
    if(l.kind==='smoke'||l.kind==='turbulence'||l.kind==='flame'){
      const curl=low*2-1,warped=L(u+Math.sin(TAU*v)*curl*.3,v+Math.cos(TAU*u)*curl*.3);
      const ribbons=Math.exp(-(Math.sin(TAU*(b*n+warped*(2+detail*8)))**2)/(.02+.18*l.softness));
      if(l.kind==='flame'){
        const rise=(1-Math.cos(TAU*a))/2,tip=1-smooth(.15,.85,rise),envelope=smooth(.1,.6,warped+tip*.4);
        return 1-cov*envelope*(.2+.8*ribbons)*tip;
      }
      if(l.kind==='turbulence')return clamp(.5+.65*(Math.abs(warped*2-1)-.5)+ribbons*.2);
      return 1-cov*ribbons*smooth(.2,.7,low);
    }
    if(l.kind==='wood'){
      const dx=Math.sin(TAU*(u-l.centerX)),dy=Math.sin(TAU*(v-l.centerY));
      const rings=TAU*n*Math.sqrt(dx*dx+dy*dy*.2+.005)+mid*(1+detail*5);
      const vein=Math.exp(-(Math.sin(rings)**2)/(.015+.12*l.softness));
      return .85-.45*vein-.2*F(u*2,v*8)-.15*low;
    }
    if(l.kind==='terrain'){
      const ridge=1-Math.abs(2*mid-1),h=.65*low+.25*ridge+.1*fine;
      return clamp(detail>.7?Math.floor(h*(3+Math.round(cov*12)))/(3+Math.round(cov*12)):h);
    }
    if(l.kind==='water'){
      let wave=0;for(let k=1;k<=4;k++)wave+=Math.sin(TAU*(n*k*u+(n+k)*v)+low*detail*4)/k;
      return .5+wave*.15;
    }
    if(l.kind==='airbrush'){
      const dx=Math.sin(Math.PI*(u-l.centerX)),dy=Math.sin(Math.PI*(v-l.centerY));
      return 1-cov*Math.exp(-(dx*dx+dy*dy)/(.008+.5*l.softness))*(.9+.1*fine);
    }
    if(l.kind==='bleed'){
      const base=source?ink(u,v):smooth(.35,.6,low),spread=(.002+.04*cov),fuzz=F(u+mid*.03,v+low*.03);
      let diffusion=base;
      for(let k=0;k<8;k++){
        const angle=TAU*k/8,offset=spread*(.5+fuzz);
        const value=source?ink(u+Math.cos(angle)*offset,v+Math.sin(angle)*offset):smooth(.35,.6,L(u+Math.cos(angle)*offset,v+Math.sin(angle)*offset));
        diffusion+=value*.12;
      }
      return 1-clamp(diffusion*(.7+.3*fine));
    }
    if(['drybrush','pencil','charcoal','chalk','crayon'].includes(l.kind)){
      const brush=(1+Math.sin(TAU*(b*Math.max(2,Math.round(n/4))+(low-.5)*detail*3)))/2;
      const bristles=F(a,b*8),stroke=smooth(.35,.55,brush);
      if(l.kind==='drybrush')return 1-stroke*smooth(.3+.4*(1-cov),.7,bristles)*(.5+.5*fine);
      if(l.kind==='pencil')return 1-cov*stroke*(.2+.8*smooth(.35,.75,R(a,b*4)));
      if(l.kind==='charcoal')return 1-stroke*cov*(.35+.65*mid)*(.5+.5*rough)*(1-.3*low);
      if(l.kind==='chalk')return 1-stroke*cov*smooth(.15,.65,rough)*(.7+.3*fine);
      return 1-stroke*smooth(.28,.52,bristles)*cov*(.6+.4*mid);
    }
    if(l.kind==='screen'||l.kind==='stamp'||l.kind==='wear'){
      const mask=source?ink(u,v):smooth(.15,.22,Math.cos(TAU*u)*Math.cos(TAU*v)+.5);
      const pores=smooth(.45,.45+.2*detail,fine),flaking=smooth(.4,.65,low+mid*.2);
      let damage=cov*(l.kind==='wear'?.55*pores+.45*flaking:pores);
      if(l.kind==='screen')damage*=.45+.55*(.5+.5*Math.sin(TAU*n*u)*Math.sin(TAU*n*v));
      return 1-mask*(1-clamp(damage));
    }
    if(l.kind==='plaster')return .9-.1*low-.15*mid-.2*(1-read(cell,u,v))**8;
    if(l.kind==='stucco'){
      const trowel=Math.sin(TAU*(b*Math.max(2,Math.round(n/3))+low*detail*4));
      return .65+.15*trowel+.15*mid+.05*rough;
    }
    if(l.kind==='rust'){
      const boundary=low+mid*.3,corrosion=smooth(.3+.35*(1-cov),.7,boundary);
      return 1-corrosion*(.5+.3*fine+.2*rough);
    }
    if(l.kind==='frosted')return .75+.12*fine+.08*rough+.05*mid;
    if(l.kind==='peeling'){
      const raw=low+.3*mid,outline=Math.exp(-(((raw-(.4+.3*(1-cov)))/(.01+.08*l.softness))**2));
      const missing=smooth(.4+.3*(1-cov),.55+.3*(1-cov),raw);
      return clamp(1-missing*(.6+.3*fine)-outline*.4);
    }
    if(l.kind==='snow')return read(white,u,v);
    if(l.kind==='pixel')return pixel(u,v,n*2)<cov?pixel(u,v,n*2)*.5:1;
    if(l.kind==='blocks'){
      const coarse=hash(Math.floor(frac(u)*n/2),Math.floor(frac(v)*n/2),seed);
      return coarse<cov?pixel(u,v,n*2):coarse;
    }
    if(l.kind==='scan'){
      const row=mod(Math.floor(v*n*4),n*4),band=hash(0,row,seed),line=.5+.5*Math.cos(TAU*v*n*4);
      return 1-cov*(line*.6+band*.25+pixel(u,v)*.15);
    }
    if(l.kind==='bands')return 1-cov*hash(mod(Math.floor(b*n*3),n*3),0,seed)*(.7+.3*fine);
    if(l.kind==='glitch'||l.kind==='compression'||l.kind==='signal'){
      const row=mod(Math.floor(v*n*2),n*2),offset=(hash(row,0,seed)-.5)*detail*.5;
      const shifted=source?sourceChannels(l,source,u+offset,v).gray:M(u+offset,v);
      const block=hash(mod(Math.floor(u*n),n),mod(Math.floor(v*n),n),seed);
      if(l.kind==='glitch')return block<cov?shifted:input(u,v).gray;
      if(l.kind==='compression'){
        const quant=Math.round(shifted*(2+Math.round(detail*12)))/(2+Math.round(detail*12));
        return clamp(quant+(block-.5)*cov*.3+(pixel(u,v)-.5)*edge(u,v)*.3);
      }
      return clamp(shifted*(1-cov*.5)+pixel(u,v)*cov*.3+hash(row,1,seed)*cov*.2);
    }
    throw new Error(`未接入的生成器：${l.kind}`);
  },1e-7);
  if(source&&['airbrush','drybrush','pencil','charcoal','chalk','crayon'].includes(l.kind))
    return numerical((u,v)=>1-(1-heightAt(generated,u,v))*(l.response==='alpha'?input(u,v).alpha:ink(u,v)),1e-7);
  return generated;
}
