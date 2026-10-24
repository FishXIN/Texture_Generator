import type { ExportSettings, Project } from '@/features/project/model';
import type { Scene } from '@/features/texture/engine/scene';
import { drawTile, sceneImages, canvasBlob } from '@/features/texture/engine/render';
import { studioSvg } from './studioSvg';
import { zipFiles } from './zip';

export function exportRegion(p: Project, settings: ExportSettings) {
  const {width,height}=p.canvas;
  if (settings.region==='selection') return settings.selection;
  const repeats=settings.region==='filled'?settings.repeats:1;
  return {x:0,y:0,width:width*repeats,height:height*repeats};
}
export function exportCheck(scene: Scene, settings: ExportSettings) {
  const p=scene.project; const region=exportRegion(p,settings);
  const width=Math.ceil(region.width*settings.scale); const height=Math.ceil(region.height*settings.scale);
  const errors:string[]=[]; const warnings:string[]=[];
  const transparent=settings.transparent && settings.format!=='jpeg';
  if (width*height>16_777_216 || width>8192 || height>8192) errors.push('导出尺寸超过 16 MP / 8192 px，请降低倍率或铺设数量。');
  if (scene.count>20000) errors.push('图形超过 20,000 个，请降低密度。');
  if (settings.region==='unit' && !p.canvas.seamless) errors.push('重复单元需要先开启无缝平铺。');
  if (settings.region==='filled' && !p.canvas.seamless) warnings.push('当前未开启无缝模式，铺满后可能存在接缝。');
  if (settings.region==='selection' && (region.x<0 || region.y<0 || region.width<1 || region.height<1 || region.x+region.width>p.canvas.width || region.y+region.height>p.canvas.height)) errors.push('选定区域必须位于当前画布内。');
  const used=new Set<string>();
  for (const {layer,items} of scene.layers) {
    for (const item of items) if (item.assetId) used.add(item.assetId);
    if (layer.mask.enabled && layer.mask.kind==='svg') {
      used.add(layer.mask.assetId);
      if (!p.assets.some(a=>a.id===layer.mask.assetId)) errors.push(`${layer.name} 的 SVG 蒙版尚未选择素材。`);
    }
    if (layer.shape==='custom' && layer.count>0 && !layer.assets.some(a=>a.weight>0 && p.assets.some(asset=>asset.id===a.id))) errors.push(`${layer.name} 尚未选择散布素材或比例均为 0。`);
    if (layer.blend!=='normal') warnings.push(`${layer.name} 使用 ${layer.blend}，请在目标软件检查混合外观。`);
  }
  for (const a of p.assets.filter(a=>used.has(a.id))) {
    warnings.push(...a.issues.map(issue=>`${a.name}：${issue}`));
    if (settings.format==='svg' && settings.svgMode!=='effects' && !a.pure) errors.push(`${a.name} 含位图、字体或滤镜，请转轮廓 / 简化素材，或选择效果保留。`);
  }
  if (settings.format==='svg' && scene.count>5000) warnings.push('SVG 对象较多，优化模式可复用图形；导入后仍可能需要等待。');
  const frameCount=Math.max(1,Math.round(p.animation.duration*settings.fps));
  if (settings.format==='sequence') {
    if (!Number.isInteger(p.animation.duration*settings.fps)) errors.push('时长 × 帧率需要为整数帧，请选择偶数帧率或调整循环时长。');
    if (frameCount>720) errors.push('序列最多 720 帧，请降低时长或帧率。');
    if (width*height>4_194_304) errors.push('序列每帧最多 4 MP，请降低倍率或铺设数量。');
    if (!scene.layers.some(l=>l.layer.motion.enabled)) warnings.push('所有图层均未启用运动，导出序列将是静态帧。');
  }
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)],width,height,transparent,frameCount};
}
export async function createExport(scene: Scene, settings: ExportSettings, time: number, signal: AbortSignal, progress: (value:number,label:string)=>void) {
  const check=exportCheck(scene,settings);
  if (check.errors.length) throw new Error(check.errors[0]);
  const abort=()=>{ if (signal.aborted) throw new DOMException('导出已取消','AbortError'); };
  const p=scene.project; const region=exportRegion(p,settings);
  const background=!check.transparent; abort();
  if (settings.format==='svg') {
    progress(0.3,'正在构建矢量图形'); await new Promise(r=>setTimeout(r,0)); abort();
    const text=studioSvg(scene,time,region,settings.scale,background,settings.svgMode);
    abort(); progress(1,'SVG 已生成');
    return {blob:new Blob([text],{type:'image/svg+xml'}),extension:'svg'};
  }
  const images=await sceneImages(scene,settings.scale); abort();
  if (settings.format!=='sequence') {
    progress(0.35,'正在以导出尺寸绘制'); await new Promise(r=>setTimeout(r,0)); abort();
    const canvas=drawTile(scene,time,settings.scale,background,images,region);
    const blob=await canvasBlob(canvas,settings.format==='jpeg'?'image/jpeg':'image/png');
    abort(); progress(1,'图像已生成'); return {blob,extension:settings.format==='jpeg'?'jpg':'png'};
  }
  const files:{name:string;data:Uint8Array}[]=[]; let bytes=0;
  for (let frame=0;frame<check.frameCount;frame++) {
    abort(); progress(frame/check.frameCount,`正在生成 ${frame+1} / ${check.frameCount} 帧`);
    await new Promise(r=>setTimeout(r,0)); abort();
    const timeAt=frame/check.frameCount*p.animation.duration;
    const canvas=drawTile(scene,timeAt,settings.scale,background,images,region);
    const blob=await canvasBlob(canvas); const data=new Uint8Array(await blob.arrayBuffer()); bytes+=data.length;
    if (bytes>256_000_000) throw new Error('序列超过 256 MB，请减小尺寸、时长或密度后重试。');
    files.push({name:`frame_${String(frame).padStart(4,'0')}.png`,data});
  }
  files.push({name:'manifest.json',data:new TextEncoder().encode(JSON.stringify({
    name:p.name,width:check.width,height:check.height,frames:check.frameCount,fps:check.frameCount/p.animation.duration,
    duration:p.animation.duration,loop:true,transparent:check.transparent,sampling:'[0, duration)',region:settings.region,
    import:'按文件名顺序作为图片序列导入；帧率以此 manifest 为准',
  },null,2))});
  abort(); progress(0.98,'正在打包 PNG 序列'); await new Promise(r=>setTimeout(r,0)); abort();
  const blob=zipFiles(files); progress(1,'序列打包完成'); return {blob,extension:'zip'};
}
