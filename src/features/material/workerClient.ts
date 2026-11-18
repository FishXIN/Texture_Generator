import { decodeSource } from './import';
import type { MaterialProject } from './model';
import type { MaterialMaps } from './engine';
import { materialSvg, vectorOutput, vectorIssues } from './vector';
import { artworkSvg, textureLayerProject } from './artworkSvg';
import { outputDimensions } from './composition';

type Output = { blob: Blob; filename: string; extension: string };
export type MaterialTaskOptions={phase?:number;format?:'png'|'sequence'|'pure'|'optimized'|'editable'|'effect'};
export function materialTask<T extends MaterialMaps | Output>(project: MaterialProject, size: number, exporting = false, progress?: (v: number) => void,options:MaterialTaskOptions={}) {
  let worker: Worker | null = null, canceled = false, settled = false;
  let child:{cancel:()=>void}|null=null;
  let rejectTask: (reason: Error) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    rejectTask = reject;
    if(exporting&&options.format==='editable'){
      Promise.resolve().then(async()=>{
        const snapshot=structuredClone(project);snapshot.export.size=size;snapshot.timeline.phase=options.phase??project.timeline.phase;
        if(snapshot.export.maps!=='height')throw new Error('SVG 不输出法线，请使用 PNG');
        snapshot.layers=snapshot.layers.filter(l=>l.visible&&l.opacity>0&&(snapshot.export.scope!=='material'||l.role!=='background'));
        const check=()=>{if(canceled)throw new DOMException('已取消生成','AbortError');};
        const raster=async(p:MaterialProject)=>{
          check();const job=materialTask<Output>(p,size,true,undefined,{format:'png'});child=job;
          const output=await job.promise;check();
          const bytes=new Uint8Array(await output.blob.arrayBuffer());
          if(bytes.length>48_000_000)throw new Error('纹理图层过大，请降低可编辑 SVG 的导出尺寸。');
          let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
          const {width,height}=outputDimensions(p,size);
          return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="data:image/png;base64,${btoa(binary)}"/></svg>`;
        };
        check();let svg:string;
        if(!snapshot.layers.some(l=>l.role!=='texture'))svg=vectorIssues(snapshot).length?await raster(snapshot):materialSvg(snapshot);
        else{
          const textures=new Map<string,string>();
          for(const [index,l] of snapshot.layers.entries()){
            check();
            if(l.role==='texture'){
              const p=textureLayerProject(snapshot,l,index);
              textures.set(l.id,vectorIssues(p).length?await raster(p):materialSvg(p));
            }
            progress?.((index+1)/snapshot.layers.length*.9);
          }
          check();svg=artworkSvg(snapshot,'editable',textures);
        }
        check();settled=true;progress?.(1);resolve(vectorOutput(snapshot,svg,'editable') as T);
      }).catch(e=>{if(!canceled){settled=true;reject(e);}});return;
    }
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
    if (settled || canceled) return; canceled = true; worker?.terminate(); worker = null; child?.cancel();
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
