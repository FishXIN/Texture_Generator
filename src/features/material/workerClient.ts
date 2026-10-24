import { decodeSource } from './import';
import type { MaterialProject } from './model';
import type { MaterialMaps } from './engine';
import { materialSvg, vectorOutput } from './vector';

type Output = { blob: Blob; filename: string; extension: string };
export type MaterialTaskOptions={phase?:number;format?:'png'|'sequence'|'pure'|'optimized'|'effect'};
export function materialTask<T extends MaterialMaps | Output>(project: MaterialProject, size: number, exporting = false, progress?: (v: number) => void,options:MaterialTaskOptions={}) {
  let worker: Worker | null = null, canceled = false, settled = false;
  let rejectTask: (reason: Error) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    rejectTask = reject;
    if(exporting&&(options.format==='pure'||options.format==='optimized')){
      Promise.resolve().then(()=>{
        if(canceled)return;
        const snapshot=structuredClone(project);snapshot.export.size=size;snapshot.timeline.phase=options.phase??project.timeline.phase;
        if(snapshot.export.scope==='material')snapshot.layers=snapshot.layers.filter(l=>l.role!=='background');
        const output=vectorOutput(snapshot,materialSvg(snapshot,options.format as 'pure'|'optimized'),options.format as 'pure'|'optimized');
        settled=true;resolve(output as T);
      }).catch(e=>{settled=true;reject(e);});return;
    }
    Promise.all(project.sources.map(source=>decodeSource(source,exporting?Math.min(8192,Math.max(size,source.width,source.height)):1024))).then(sources => {
      if (canceled) return;
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const finish = () => { settled = true; worker?.terminate(); worker = null; };
      worker.onmessage = event => {
        if (event.data.type === 'progress') progress?.(event.data.progress);
        else if (event.data.type === 'error') { finish(); reject(new Error(event.data.message)); }
        else { finish(); resolve((event.data.maps ?? event.data.output) as T); }
      };
      worker.onerror = event => { finish(); reject(new Error(event.message || '生成进程失败，请降低分辨率后重试')); };
      worker.postMessage({ project, size, sources, exporting,format:options.format??'png',phase:options.phase??project.timeline?.phase??0 });
    }).catch(e => { if (!settled && !canceled) { settled = true; reject(e); } });
  });
  return { promise, cancel: () => {
    if (settled || canceled) return; canceled = true; worker?.terminate(); worker = null;
    rejectTask(new DOMException('已取消生成', 'AbortError'));
  } };
}

/** One persistent preview worker. The caller submits one job at a time. */
export function createMaterialPreview() {
  const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  let sourceKey='',disposed=false,rejectJob:((e:Error)=>void)|undefined;
  return {
    async render(project:MaterialProject,size:number,phase:number,previewChannel:'height'|'normal'='height'):Promise<MaterialMaps>{
      if(disposed)throw new DOMException('已取消','AbortError');
      const key=project.sources.map(s=>s.id).join(',');
      const sources=key===sourceKey?undefined:await Promise.all(project.sources.map(s=>decodeSource(s)));
      if(disposed)throw new DOMException('已取消','AbortError');
      sourceKey=key;
      return new Promise((resolve,reject)=>{
        rejectJob=reject;
        worker.onmessage=event=>{
          if(event.data.type==='maps'){rejectJob=undefined;resolve(event.data.maps);}
          else if(event.data.type==='error'){rejectJob=undefined;reject(new Error(event.data.message));}
        };
        worker.onerror=event=>reject(new Error(event.message||'预览失败'));
        worker.postMessage({project:{...project,sources:project.sources.map(s=>({...s,original:''}))},sources,size,phase,exporting:false,preview:true,previewChannel});
      });
    },
    cancel(){disposed=true;worker.terminate();rejectJob?.(new DOMException('已取消','AbortError'));}
  };
}
