import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Scene } from '../engine/scene';
import { atTime, copies, mod } from '../engine/scene';
import { drawTile, sceneImages } from '../engine/render';
import { useProjectStore } from '@/features/project/store';

export type PreviewBackground = 'checker'|'light'|'dark'|'custom';
export function StudioCanvas({scene,time,tiled,boundaries,background,customBackground,zoom,onPause,selection}: {
  scene:Scene|null;time:number;tiled:boolean;boundaries:boolean;background:PreviewBackground;
  customBackground:string;zoom:number|null;onPause:()=>void;selection:boolean;
}) {
  const canvasRef=useRef<HTMLCanvasElement>(null); const viewportRef=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:600,height:600});
  const [images,setImages]=useState<Map<string,HTMLImageElement>>(new Map());
  const [error,setError]=useState('');
  const drag=useRef<{id:string;x:number;y:number;px:number;py:number;group:string}|null>(null);
  const selected=useProjectStore(s=>s.selectedObject);
  useEffect(()=>{
    const node=viewportRef.current; if (!node) return;
    const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(node); return ()=>observer.disconnect();
  },[]);
  const repeats=tiled?3:1;
  const W=scene?.project.canvas.width ?? 512; const H=scene?.project.canvas.height ?? 512;
  const displayScale=zoom??Math.max(0.05,Math.min((size.width-64)/(W*repeats),(size.height-64)/(H*repeats)));
  const displayWidth=W*repeats*displayScale; const displayHeight=H*repeats*displayScale;
  const quality=Math.min(2,displayScale*window.devicePixelRatio,4096/(Math.max(W,H)*repeats),Math.sqrt(4_194_304/(W*H*repeats**2)));
  useEffect(()=>{
    if (!scene) return; let active=true;
    sceneImages(scene,quality).then(result=>{if(active){setImages(result);setError('');}}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[scene,quality]);
  useEffect(()=>{
    const canvas=canvasRef.current; if (!scene || !canvas) return;
    canvas.width=Math.ceil(W*repeats*quality); canvas.height=Math.ceil(H*repeats*quality);
    const ctx=canvas.getContext('2d')!; ctx.clearRect(0,0,canvas.width,canvas.height);
    const drawing=drawTile(scene,time,quality,scene.project.background.visible,images,{x:0,y:0,width:W*repeats,height:H*repeats});
    ctx.drawImage(drawing,0,0);
    ctx.scale(quality,quality);
    if (boundaries && tiled) {
      ctx.strokeStyle='rgba(100,111,70,.65)'; ctx.lineWidth=1/quality; ctx.setLineDash([5/quality,5/quality]);
      for(let x=1;x<repeats;x++){ctx.beginPath();ctx.moveTo(x*W,0);ctx.lineTo(x*W,H*repeats);ctx.stroke();}
      for(let y=1;y<repeats;y++){ctx.beginPath();ctx.moveTo(0,y*H);ctx.lineTo(W*repeats,y*H);ctx.stroke();}
      ctx.setLineDash([]);
    }
    for (const sl of scene.layers) for (const source of sl.items.filter(i=>i.id===selected)) {
      const item=atTime(source,sl.layer,scene.project,time);
      for (const pos of copies(item,W,H,scene.project.canvas.seamless)) {
        ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(item.rotation*Math.PI/180);
        ctx.strokeStyle='#677448';ctx.lineWidth=1.5/quality;ctx.strokeRect(-item.width/2-3/quality,-item.height/2-3/quality,item.width+6/quality,item.height+6/quality);
        ctx.restore();
      }
    }
    if (selection && !tiled) {
      const r=scene.project.export.selection;ctx.strokeStyle='#677448';ctx.lineWidth=1.5/quality;ctx.setLineDash([6/quality,4/quality]);
      ctx.strokeRect(r.x,r.y,r.width,r.height);
    }
  },[scene,time,images,selected,tiled,boundaries,displayScale,selection]);
  const point=(event:PointerEvent<HTMLCanvasElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width*W*repeats,y:(event.clientY-rect.top)/rect.height*H*repeats};
  };
  const pointerDown=(event:PointerEvent<HTMLCanvasElement>)=>{
    if (!scene || tiled) return;
    const p=point(event); let hit:string|null=null;
    for (const sl of [...scene.layers].reverse()) {
      for (const source of [...sl.items].reverse().filter(i=>i.manual)) {
        const item=atTime(source,sl.layer,scene.project,time);
        for(const pos of copies(item,W,H,scene.project.canvas.seamless)) {
          const a=-item.rotation*Math.PI/180;const dx=p.x-pos.x;const dy=p.y-pos.y;
          const x=dx*Math.cos(a)-dy*Math.sin(a);const y=dx*Math.sin(a)+dy*Math.cos(a);
          if(Math.abs(x)<=item.width/2+4/displayScale&&Math.abs(y)<=item.height/2+4/displayScale){hit=item.id;break;}
        }
        if(hit)break;
      }
      if(hit)break;
    }
    const store=useProjectStore.getState();store.selectObject(hit);
    const object=store.project.objects.find(o=>o.id===hit);const layer=store.project.layers.find(l=>l.id===object?.layerId);
    if(object&&!object.locked&&!layer?.locked){
      onPause();drag.current={id:object.id,x:object.x,y:object.y,px:p.x,py:p.y,group:`drag-${Date.now()}`};
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const pointerMove=(event:PointerEvent<HTMLCanvasElement>)=>{
    const d=drag.current;if(!d)return;const p=point(event);
    useProjectStore.getState().edit(project=>{
      const object=project.objects.find(o=>o.id===d.id);if(!object)return;
      object.x=d.x+p.x-d.px;object.y=d.y+p.y-d.py;
      if(project.canvas.seamless){object.x=mod(object.x,W);object.y=mod(object.y,H);}
      else {object.x=Math.max(0,Math.min(W,object.x));object.y=Math.max(0,Math.min(H,object.y));}
    },d.group);
  };
  const previewStyle=background==='custom'?{backgroundColor:customBackground}:undefined;
  return <div className="canvas-viewport" ref={viewportRef}>
    <div className="canvas-scroll-content"><div className={`artboard preview-${background}`} style={{width:displayWidth,height:displayHeight,...previewStyle}}>
      <canvas ref={canvasRef} aria-label="纹理画布" style={{width:'100%',height:'100%',cursor:tiled?'default':'crosshair'}}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/>
    </div></div>
    {error&&<p className="canvas-error">{error}</p>}
    <span className="canvas-scale">{Math.round(displayScale*100)}% · {tiled?'3 × 3 整面预览':'重复单元'}{quality<displayScale*window.devicePixelRatio?' · 预览降采样，导出以设置为准':''}</span>
  </div>;
}
