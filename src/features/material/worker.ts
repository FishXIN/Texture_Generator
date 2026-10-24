import { renderMaterial } from './engine';
import { exportMaterial } from './export';
import type { MaterialProject } from './model';
import type { DecodedSource } from './engine';
import { exportSequence } from './sequence';
import { effectSvg, vectorOutput } from './vector';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
let cachedSources:DecodedSource[]=[];
scope.onmessage = async event => {
  const { project, size, sources:incoming, exporting,format,phase,preview,previewChannel } = event.data as { project: MaterialProject; size: number; sources?: DecodedSource[]; exporting: boolean;format:string;phase:number;preview?:boolean;previewChannel?:'height'|'normal' };
  if(incoming)cachedSources=incoming;
  const sources=cachedSources;
  try {
    if(exporting&&format==='sequence'){
      const output=await exportSequence(project,size,sources,progress=>scope.postMessage({type:'progress',progress}));
      scope.postMessage({type:'export',output});return;
    }
    const channels=exporting?format==='effect'?'height':project.export.maps:preview?previewChannel??'height':'both';
    const maps = renderMaterial(project, size, sources, progress => scope.postMessage({ type: 'progress', progress: progress * (exporting ? 0.8 : 1) }),phase,preview,channels);
    if (exporting) {
      const output = format==='effect'?vectorOutput(project,await effectSvg(project,maps),'effect'):await exportMaterial(project, maps, progress => scope.postMessage({ type: 'progress', progress: 0.8 + progress * 0.2 }));
      scope.postMessage({ type: 'export', output });
    } else scope.postMessage({ type: 'maps', maps }, [maps.height.buffer, maps.normal.buffer,...(maps.composition?[maps.composition.buffer]:[])]);
  } catch (e) { scope.postMessage({ type: 'error', message: e instanceof Error ? e.message : '生成失败' }); }
};
