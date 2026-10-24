import type { Asset } from '@/features/project/model';
import { assetSvg } from '@/features/assets/svg';
import type { Scene } from '@/features/texture/engine/scene';
import { atTime, copies, itemPath } from '@/features/texture/engine/scene';
import type { RenderRegion } from '@/features/texture/engine/render';

const n = (value: number) => String(Math.round(value*100000)/100000);
const esc = (text: string) => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function nested(asset: Asset, prefix: string, x: number, y: number, w: number, h: number, color='') {
  const doc=new DOMParser().parseFromString(assetSvg(asset,prefix,color),'image/svg+xml'); const root=doc.documentElement;
  for (const [key,v] of Object.entries({x,y,width:w,height:h})) root.setAttribute(key,n(v));
  return new XMLSerializer().serializeToString(root);
}
export function studioSvg(scene: Scene, time: number, region: RenderRegion, scale: number, background: boolean, mode: 'pure'|'effects'|'optimized') {
  const p=scene.project; const {width:W,height:H,seamless}=p.canvas;
  const defs: string[]=[`<clipPath id="tileClip"><rect width="${W}" height="${H}"/></clipPath>`];
  const reused=new Map<string,string>(); let counter=0; let content='';
  const area=seamless?region:{x:0,y:0,width:W,height:H};
  if (background) content+=`<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" fill="${p.background.color}"/>`;
  for (const {layer,items} of scene.layers) {
    let layerContent='';
    for (const source of items) {
      const item=atTime(source,layer,p,time); let shape='';
      if (item.shape==='custom') {
        const asset=p.assets.find(a=>a.id===item.assetId); if (!asset) continue;
        if (mode==='optimized') {
          const key=asset.id+item.color; let id=reused.get(key);
          if (!id) {
            id=`asset${counter++}`; reused.set(key,id);
            defs.push(`<g id="${id}">${nested(asset,id,-asset.width/2,-asset.height/2,asset.width,asset.height,item.color)}</g>`);
          }
          shape=`<use href="#${id}" transform="scale(${n(item.width/asset.width)} ${n(item.height/asset.height)})"/>`;
        } else shape=nested(asset,`a${counter++}`,-item.width/2,-item.height/2,item.width,item.height,item.color);
      } else if (item.shape==='chip') shape=`<path d="${itemPath(item.shape,item.width,item.height)}" fill="${item.color}"/>`;
      else if (item.shape==='line') shape=`<rect x="${n(-item.width/2)}" y="${n(-item.height/2)}" width="${n(item.width)}" height="${n(item.height)}" rx="${n(item.height/2)}" fill="${item.color}"/>`;
      else shape=`<ellipse rx="${n(item.width/2)}" ry="${n(item.height/2)}" fill="${item.color}"/>`;
      if (item.shape==='custom' && mode!=='optimized') {
        const id=`object${counter++}`;
        defs.push(`<g id="${id}">${shape}</g>`);
        shape=`<use href="#${id}"/>`;
      }
      for (const pos of copies(item,W,H,seamless,area)) {
        layerContent+=`<g data-object="${esc(item.id)}" transform="translate(${n(pos.x)} ${n(pos.y)}) rotate(${n(item.rotation)})" opacity="${n(item.opacity)}">${shape}</g>`;
      }
    }
    let maskAttr='';
    if (layer.mask.enabled) {
      const m=layer.mask; const id=`mask${counter++}`; const inside=m.mode==='inside'; const paint=inside?'#ffffff':'#000000';
      let geometry='';
      const firstX=seamless?Math.floor((area.x-m.x-m.width)/W):0;const lastX=seamless?Math.ceil((area.x+area.width-m.x)/W):0;
      const firstY=seamless?Math.floor((area.y-m.y-m.height)/H):0;const lastY=seamless?Math.ceil((area.y+area.height-m.y)/H):0;
      for (let ix=firstX;ix<=lastX;ix++) for (let iy=firstY;iy<=lastY;iy++) {
        const dx=ix*W;const dy=iy*H;
        if (m.kind==='rect') geometry+=`<rect x="${n(m.x+dx)}" y="${n(m.y+dy)}" width="${m.width}" height="${m.height}" fill="${paint}"/>`;
        else if (m.kind==='ellipse') geometry+=`<ellipse cx="${n(m.x+dx+m.width/2)}" cy="${n(m.y+dy+m.height/2)}" rx="${m.width/2}" ry="${m.height/2}" fill="${paint}"/>`;
        else {
          const asset=p.assets.find(a=>a.id===m.assetId);
          if (asset) {
            let node=nested(asset,`${id}_${counter++}`,m.x+dx,m.y+dy,m.width,m.height,paint);
            if (!asset.pure) {
              const filter=`maskPaint${counter++}`; const rgb=inside?1:0;
              defs.push(`<filter id="${filter}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${rgb} 0 0 0 0 ${rgb} 0 0 0 0 ${rgb} 0 0 0 1 0"/></filter>`);
              node=`<g filter="url(#${filter})">${node}</g>`;
            }
            geometry+=node;
          }
        }
      }
      defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" style="mask-type:luminance">${inside?'':`<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" fill="white"/>`}${geometry}</mask>`);
      maskAttr=` mask="url(#${id})"`;
    }
    content+=`<g data-layer="${esc(layer.name)}" opacity="${layer.opacity}"${maskAttr}${layer.blend==='normal'?'':` style="mix-blend-mode:${layer.blend};isolation:isolate"`}>${layerContent}</g>`;
  }
  let tiles=content;
  if (!seamless) {
    defs.push(`<g id="unit" clip-path="url(#tileClip)" style="isolation:isolate">${content}</g>`);tiles='';
    for (let x=Math.floor(region.x/W)*W;x<region.x+region.width;x+=W) for (let y=Math.floor(region.y/H)*H;y<region.y+region.height;y+=H) {
      tiles+=`<use href="#unit" x="${x}" y="${y}"/>`;
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(region.width*scale)}" height="${Math.ceil(region.height*scale)}" viewBox="${region.x} ${region.y} ${region.width} ${region.height}" preserveAspectRatio="none" style="isolation:isolate"><title>${esc(p.name)}</title><desc>${mode==='effects'?'效果保留，可能包含滤镜、字体或位图':'矢量图形；复用结构可在设计软件中展开'}</desc><defs>${defs.join('')}</defs>${tiles}</svg>`;
}
