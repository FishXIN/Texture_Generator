import { zipFiles } from '@/features/export/zip';
import { renderMaterial } from './engine';
import type { DecodedSource } from './engine';
import { encodePng } from './png';
import { materialFilename } from './export';
import { isSeamless } from './model';
import type { MaterialProject } from './model';
import { outputDimensions } from './composition';

export async function exportSequence(p:MaterialProject,size:number,sources:DecodedSource[],progress?:(v:number)=>void) {
  const frames=Math.max(1,Math.round(p.timeline.duration*p.timeline.fps));
  const dims=outputDimensions(p,size);
  if(frames*dims.width*dims.height>128_000_000)throw new Error('序列总像素超过本机打包上限，请降低尺寸、时长或帧率。');
  const files:{name:string;data:Uint8Array}[]=[],name=materialFilename(p);
  for(let frame=0;frame<frames;frame++){
    const phase=frame/frames,maps=renderMaterial(p,size,sources,v=>progress?.((frame+v*.8)/frames),phase,false,p.export.maps),id=String(frame).padStart(5,'0');
    if(p.export.maps!=='normal')files.push({name:`${name}_${id}.png`,data:await encodePng(maps,'height',p.export.depth,p.export.background==='transparent',p.export.pigment)});
    if(p.export.maps!=='height')files.push({name:`${name}_Normal_${id}.png`,data:await encodePng(maps,'normal',8)});
    progress?.((frame+1)/frames);
  }
  files.push({name:'manifest.json',data:new TextEncoder().encode(JSON.stringify({
    generator:'Texture Generator 0.6.0',frames,fps:p.timeline.fps,duration:frames/p.timeline.fps,requestedDuration:p.timeline.duration,
    size,width:dims.width,height:dims.height,scope:p.export.scope,depth:p.layers.some(l=>l.role!=='texture'&&(p.export.scope!=='material'||l.role!=='background'))?8:p.export.depth,background:p.export.background,pigment:p.export.pigment,
    alpha:p.export.background==='transparent'?(p.export.pigment==='white'?'grayscale':'1-grayscale'):'opaque',
    seamless:isSeamless(p),phase:'frame / frameCount; [0, 1); endpoint is not duplicated',
    loop:'Continuous motions use periodic functions or integer tile traversal. Curl flow follows reversible oscillating advection. Refresh uses repeating discrete seeds.',
    normalConvention:p.normal.convention,project:p,
  },null,2))});
  return{blob:zipFiles(files),filename:`${name}_Sequence_${size}.zip`,extension:'zip'};
}
