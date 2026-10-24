import { assetSvg, sanitizeSvg } from '@/features/assets/svg';
import type { MaterialProject } from './model';
import type { MaterialMaps } from './engine';
import { createParticles } from './particles';
import { phaseSeed } from './animation';
import { encodePng } from './png';
import { materialFilename } from './export';

export type VectorMode='pure'|'optimized'|'effect';
const gray=(v:number)=>{const c=Math.round(Math.max(0,Math.min(1,v))*255);return`rgb(${c},${c},${c})`;};
export function vectorIssues(p:MaterialProject) {
  const issues:string[]=[];
  if(p.export.maps!=='height')issues.push('SVG 只输出黑白纹理；法线请使用 PNG');
  for(const l of p.layers.filter(l=>l.visible&&l.opacity>0)){
    if(l.kind!=='particles'){issues.push(`${l.name}：连续纹理或效果需要位图`);continue;}
    if(l.softness>0)issues.push(`${l.name}：软边需要位图`);
    if(l.contrast!==1||l.bias!==0||l.invert)issues.push(`${l.name}：灰度调整需要效果模式`);
    if(l.blend!=='replace')issues.push(`${l.name}：当前混合需要效果模式`);
    for(const source of p.sources.filter(s=>s.id===l.sourceId||l.sourceMix.some(m=>m.id===s.id)||l.objects.some(o=>o.sourceId===s.id))){
      if(source.mime!=='image/svg+xml')issues.push(`${source.name}：输入是位图`);
      else if(!sanitizeSvg(source.original,source.name).pure)issues.push(`${source.name}：包含滤镜、位图或字体`);
    }
    if(l.shape==='custom'&&!l.sourceId&&!l.sourceMix.length&&l.distribution!=='manual')issues.push(`${l.name}：没有 SVG 素材`);
  }
  return [...new Set(issues)];
}
function monochromeSvg(svg:string,invert=false) {
  const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
  if(!doc.documentElement.hasAttribute('fill'))doc.documentElement.setAttribute('fill','black');
  if(!doc.documentElement.hasAttribute('color'))doc.documentElement.setAttribute('color','black');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;
  const convert=(value:string,negative=invert)=>{
    if(value==='none'||value==='currentColor'||/url\s*\(/i.test(value))return value;
    ctx.clearRect(0,0,1,1);ctx.fillStyle='#000';ctx.fillStyle=value;ctx.fillRect(0,0,1,1);
    const d=ctx.getImageData(0,0,1,1).data,g=Math.round(d[0]*.2126+d[1]*.7152+d[2]*.0722),c=negative?255-g:g;
    return`rgba(${c},${c},${c},${d[3]/255})`;
  };
  for(const node of [doc.documentElement,...doc.querySelectorAll('*')]){
    const negative=invert&&!node.closest('mask,clipPath');
    for(const key of ['fill','stroke','stop-color','color'])if(node.hasAttribute(key))node.setAttribute(key,convert(node.getAttribute(key)!,negative));
    if(node.hasAttribute('style'))node.setAttribute('style',node.getAttribute('style')!.replace(/(^|;)\s*(fill|stroke|stop-color|color)\s*:\s*([^;]+)/g,(_,prefix,key,value)=>`${prefix}${key}:${convert(value.trim().replace(/\s*!important$/,''),negative)}`));
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export function materialSvg(p:MaterialProject,mode:Exclude<VectorMode,'effect'>='pure') {
  const issues=vectorIssues(p);if(issues.length)throw new Error(`无法纯矢量导出：${issues.join('；')}。请选择效果模式。`);
  const size=p.export.size,defs:string[]=[],content:string[]=[],sources=new Map(p.sources.map(s=>[s.id,s]));
  const transparent=p.export.background==='transparent',white=p.export.pigment==='white',inverse=transparent&&!white;
  const paint=(v:number)=>gray(inverse?1-v:v);
  content.push(`<rect width="1" height="1" fill="${paint(1)}"/>`);
  for(const l of p.layers.filter(l=>l.visible&&l.opacity>0)){
    const seed=phaseSeed(l,p.timeline.phase,Math.round(p.timeline.duration*p.timeline.fps));
    const objects:string[]=[`<rect width="1" height="1" fill="${paint(l.baseGray)}"/>`],particles=createParticles({...l,seed},p.timeline.phase);
    const definitions=new Map<string,string>();
    for(const point of particles){
      let shape:string;
      if(point.shape==='custom'){
        const source=sources.get(point.sourceId);if(!source)throw new Error('SVG 素材不存在');
        const asset=sanitizeSvg(source.original,source.name,source.id),key=`source-${l.id}-${source.id}`;
        if(!definitions.has(key)){
          const svg=monochromeSvg(assetSvg(asset,key),inverse);
          definitions.set(key,`<g id="${key}"><svg x="-1" y="-1" width="2" height="2" preserveAspectRatio="none">${svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</svg></g>`);
          // Preserve the original viewBox; nested SVG dimensions map onto the normalized stamp.
          const viewBox=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement.getAttribute('viewBox')!;
          definitions.set(key,definitions.get(key)!.replace('preserveAspectRatio="none"',`viewBox="${viewBox}" preserveAspectRatio="none"`));
        }
        shape=`<use href="#${key}"/>`;
      }else{
        const key=`shape-${l.id}-${point.shape}-${point.shape==='blob'||point.shape==='debris'||point.shape==='splatter'?point.order:'shared'}`;
        let path=point.outline.map((q,i)=>`${i?'L':'M'}${q.x} ${q.y}`).join(' ')+'Z';
        if(point.hole)path+=' M .62 0 A .62 .62 0 1 0 -.62 0 A .62 .62 0 1 0 .62 0 Z';
        shape=point.shape==='circle'||point.shape==='ellipse'?'<circle r="1"/>':`<path d="${path}" fill-rule="evenodd"/>`;
        if(point.shape==='ring')shape='<path d="M 1 0 A 1 1 0 1 0 -1 0 A 1 1 0 1 0 1 0 M .62 0 A .62 .62 0 1 0 -.62 0 A .62 .62 0 1 0 .62 0 Z" fill-rule="evenodd"/>';
        if(mode==='optimized'){if(!definitions.has(key))definitions.set(key,`<g id="${key}">${shape}</g>`);shape=`<use href="#${key}"/>`;}
      }
      for(let dy=Math.ceil(-point.y-point.radius);dy<=Math.floor(1-point.y+point.radius);dy++)
        for(let dx=Math.ceil(-point.x-point.radius);dx<=Math.floor(1-point.x+point.radius);dx++){
        const x=point.x+dx,y=point.y+dy;if(x+point.radius<0||x-point.radius>1||y+point.radius<0||y-point.radius>1)continue;
        objects.push(`<g transform="translate(${x} ${y}) rotate(${point.angle}) scale(${point.size*point.aspect*(point.flipX?-1:1)} ${point.size*(point.flipY?-1:1)})" fill="${paint(point.gray)}" opacity="${point.opacity}">${shape}</g>`);
      }
    }
    defs.push(...definitions.values());content.push(`<g opacity="${l.opacity}">${objects.join('')}</g>`);
  }
  const actual=content.join('');
  const body=transparent?`<defs><mask id="pigment" x="0" y="0" width="1" height="1" maskUnits="userSpaceOnUse" mask-type="luminance" color-interpolation="sRGB">${actual}</mask></defs><rect width="1" height="1" fill="${white?'white':'black'}" mask="url(#pigment)"/>`:actual;
  return`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 1 1"><metadata>Texture Generator; mode=${mode}; raster=false; phase=${p.timeline.phase}</metadata><defs>${defs.join('')}</defs>${body}</svg>`;
}
export async function effectSvg(p:MaterialProject,maps:MaterialMaps) {
  if(p.export.maps!=='height')throw new Error('效果 SVG 只输出黑白纹理；法线请使用 PNG。');
  const png=await encodePng(maps,'height',p.export.depth,p.export.background==='transparent',p.export.pigment);
  let binary='';for(let i=0;i<png.length;i+=8192)binary+=String.fromCharCode(...png.subarray(i,i+8192));
  return`<svg xmlns="http://www.w3.org/2000/svg" width="${maps.size}" height="${maps.size}" viewBox="0 0 ${maps.size} ${maps.size}"><metadata>Texture Generator; mode=effect; embedded raster PNG ${p.export.depth}bit; phase=${p.timeline.phase}</metadata><image width="${maps.size}" height="${maps.size}" href="data:image/png;base64,${btoa(binary)}"/></svg>`;
}
export const vectorOutput=(p:MaterialProject,svg:string,mode:VectorMode)=>({
  blob:new Blob([svg],{type:'image/svg+xml'}),filename:`${materialFilename(p)}_${mode}.svg`,extension:'svg',
});
