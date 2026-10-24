import { useEffect, useRef, useState } from 'react';
import { createMaterialPreview } from './workerClient';
import { useMaterialStore } from './store';
import type { MaterialMaps } from './engine';
import { frac } from './algorithms';

export function useMaterialPreview(playing:boolean,clock:React.MutableRefObject<number>) {
  const project=useMaterialStore(s=>s.project);
  const [maps,setMaps]=useState<MaterialMaps|null>(null),[error,setError]=useState('');
  const options=useRef({playing,dragging:false}),dirty=useRef(true),wake=useRef(()=>{});
  options.current.playing=playing;
  const key=JSON.stringify({layers:project.layers.map(({locked,name,...l})=>l),sources:project.sources.map(s=>s.id),canvas:project.canvas,
    normal:project.normal,timeline:project.timeline,background:project.export.background,pigment:project.export.pigment});
  useEffect(()=>{
    let alive=true,running=false,frame=0,interactiveSize=192;
    const client=createMaterialPreview();
    const run=async()=>{
      if(running||!alive)return;running=true;
      try{
        while(alive&&(dirty.current||options.current.playing)){
          dirty.current=false;
          const p=useMaterialStore.getState().project;
          const phase=options.current.playing?frac((performance.now()-clock.current)/1000/p.timeline.duration):p.timeline.phase;
          const interactive=options.current.dragging||options.current.playing,start=performance.now();
          const result=await client.render({...p,export:{...p.export,scope:'canvas'}},interactive?interactiveSize:512,phase);
          if(!alive)break;
          if(interactive){
            const elapsed=performance.now()-start;
            if(elapsed>55)interactiveSize=128;
            else if(elapsed<20)interactiveSize=192;
          }
          setMaps(result);setError('');
          if(options.current.playing){frame=requestAnimationFrame(()=>void run());break;}
        }
      }catch(e){if(alive){dirty.current=false;setError((e as Error).message);}}
      finally{running=false;}
    };
    wake.current=()=>void run();
    const start=()=>{options.current.dragging=true;interactiveSize=192;dirty.current=true;void run();};
    const end=()=>{options.current.dragging=false;dirty.current=true;void run();};
    window.addEventListener('texture-range-start',start);window.addEventListener('texture-range-end',end);
    void run();
    return()=>{alive=false;client.cancel();cancelAnimationFrame(frame);window.removeEventListener('texture-range-start',start);window.removeEventListener('texture-range-end',end);};
  },[]);
  useEffect(()=>{dirty.current=true;wake.current();},[key,playing]);
  return {maps,error};
}
