import { createParticles } from './particles';
import { phaseSeed } from './animation';
import type { HeightLayer, MaterialProject } from './model';
import type { DecodedSource, Sample } from './engine';

export const outputDimensions = (p: MaterialProject, size: number) => {
  const w = p.canvas?.width ?? size, h = p.canvas?.height ?? size, ratio = size / Math.max(w,h);
  return { width:Math.max(1,Math.round(w*ratio)), height:Math.max(1,Math.round(h*ratio)) };
};
export function renderComposition(p:MaterialProject,width:number,height:number,sources:DecodedSource[],phase:number,
  field:(l:HeightLayer)=>(u:number,v:number,out:Sample)=>void) {
  const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d')!;
  if(p.export.background!=='transparent'){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);}
  const images=new Map<string,OffscreenCanvas>();
  for(const source of sources){
    if(!source.rgba)continue;
    const image=new OffscreenCanvas(source.width,source.height);
    image.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(source.rgba),source.width,source.height),0,0);
    images.set(source.id,image);
  }
  for(const l of p.layers){
    if(!l.visible||l.opacity<=0||p.export.scope==='material'&&l.role==='background')continue;
    ctx.save();ctx.globalAlpha=l.opacity;
    ctx.globalCompositeOperation=l.blend==='multiply'?'multiply':l.blend==='max'?'lighten':l.blend==='add'?'overlay':'source-over';
    if(l.role==='background'){
      const image=images.get(l.sourceId);
      if(image){
        if(l.fit==='tile'){
          const scale=Math.min(width,height)/Math.max(image.width,image.height),w=image.width*scale,h=image.height*scale;
          for(let y=0;y<height;y+=h)for(let x=0;x<width;x+=w)ctx.drawImage(image,x,y,w,h);
        }else{
          const ratio=(l.fit==='fit'?Math.min:Math.max)(width/image.width,height/image.height),w=image.width*ratio,h=image.height*ratio;
          ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
        }
      }
    }else if(l.role==='elements'){
      for(const o of createParticles({...l,seed:phaseSeed(l,phase,Math.round(p.timeline.duration*p.timeline.fps))},phase)){
        const image=images.get(o.sourceId);if(!image)continue;
        const w=o.size*2*width*o.aspect,h=o.size*2*width,imageAspect=image.width/image.height;
        const dw=imageAspect>=1?w:w*imageAspect,dh=imageAspect>=1?h/imageAspect:h;
        // Repeat complete objects across all intersected tile edges.
        const radius=Math.hypot(dw,dh)/2;
        const nx=Math.ceil(radius/width),ny=Math.ceil(radius/height);
        for(let y=-ny;y<=ny;y++)for(let x=-nx;x<=nx;x++){
          const cx=(o.x+x)*width,cy=(o.y+y)*height;
          if(cx+radius<0||cx-radius>width||cy+radius<0||cy-radius>height)continue;
          ctx.save();ctx.globalAlpha=l.opacity*o.opacity;ctx.translate(cx,cy);ctx.rotate(o.angle*Math.PI/180);
          ctx.scale(o.flipX?-1:1,o.flipY?-1:1);ctx.drawImage(image,-dw/2,-dh/2,dw,dh);ctx.restore();
        }
      }
    }else{
      const sample=field(l),t:Sample={h:0,du:0,dv:0},data=new Uint8ClampedArray(width*height*4);
      const hasBelow=p.layers.slice(0,p.layers.indexOf(l)).some(v=>v.visible&&v.opacity>0&&(p.export.scope!=='material'||v.role!=='background'));
      const transparent=p.export.background==='transparent'||hasBelow;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        sample(x/width,y/height,t);const k=(y*width+x)*4,value=Math.round(t.h*255);
        data[k]=data[k+1]=data[k+2]=transparent?p.export.pigment==='white'?255:0:value;
        data[k+3]=transparent?p.export.pigment==='white'?value:255-value:255;
      }
      const image=new OffscreenCanvas(width,height);image.getContext('2d')!.putImageData(new ImageData(data,width,height),0,0);
      // Pigment alpha represents texture coverage; Multiply preserves the artwork beneath it.
      if(transparent&&l.blend==='add')ctx.globalCompositeOperation='source-over';
      ctx.drawImage(image,0,0);
    }
    ctx.restore();
  }
  return ctx.getImageData(0,0,width,height).data;
}
