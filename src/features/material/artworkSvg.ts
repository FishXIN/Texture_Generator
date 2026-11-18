import { assetSvg, sanitizeSvg } from '@/features/assets/svg';
import type { HeightLayer, HeightSource, MaterialProject } from './model';
import { artworkCopies, artworkSize, layerParticles } from './artwork';
import { phaseSeed } from './animation';
import { outputDimensions } from './composition';

const escape=(v:string)=>v.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function textureLayerProject(p:MaterialProject,l:HeightLayer,index:number):MaterialProject {
  return {...p,layers:[{...l,opacity:1,blend:'replace'}],export:{...p.export,maps:'height',background:p.export.background==='transparent'||index>0?'transparent':'white'}};
}
export function artworkSvg(p:MaterialProject,mode:'pure'|'optimized'|'editable',textures:Map<string,string>) {
  const {width,height}=outputDimensions(p,p.export.size),sources=new Map(p.sources.map(s=>[s.id,s]));
  const layers=p.layers.filter(l=>l.visible&&l.opacity>0&&(p.export.scope!=='material'||l.role!=='background'));
  const defs:string[]=[],content:string[]=[],reuse=new Map<string,string>();
  const safe=new Map(p.sources.filter(s=>s.mime==='image/svg+xml').map(s=>[s.id,sanitizeSvg(s.original,s.name,s.id)]));
  let bytes=0,instance=0;
  const append=(list:string[],markup:string)=>{bytes+=markup.length;if(bytes>64_000_000)throw new Error('可编辑 SVG 超过 64 MB，请减少图形数量或导出尺寸。');list.push(markup);};
  const sourceMarkup=(s:HeightSource,w:number,h:number,prefix:string)=>{
    if(s.mime!=='image/svg+xml')return `<image width="${w}" height="${h}" preserveAspectRatio="none" href="${escape(s.original)}"/>`;
    const doc=new DOMParser().parseFromString(assetSvg(safe.get(s.id)!,prefix),'image/svg+xml'),root=doc.documentElement;
    root.setAttribute('x','0');root.setAttribute('y','0');root.setAttribute('width',String(w));root.setAttribute('height',String(h));
    root.setAttribute('preserveAspectRatio','none');root.setAttribute('overflow','hidden');
    return new XMLSerializer().serializeToString(root);
  };
  const placedSource=(s:HeightSource,w:number,h:number)=>{
    if(mode==='optimized'){
      let key=reuse.get(s.id);
      if(!key){key=`art-source-${s.id}`;reuse.set(s.id,key);append(defs,`<g id="${key}">${sourceMarkup(s,1,1,key)}</g>`);}
      return `<use href="#${key}" transform="scale(${w} ${h})"/>`;
    }
    return sourceMarkup(s,w,h,`art-instance-${instance++}`);
  };
  if(p.export.background!=='transparent')content.push(`<rect width="${width}" height="${height}" fill="white"/>`);
  for(const [index,l] of layers.entries()){
    const objects:string[]=[];
    if(l.role==='background'){
      const s=sources.get(l.sourceId);if(!s)throw new Error('背景素材不存在');
      if(l.fit==='tile'){
        const scale=Math.min(width,height)/Math.max(s.width,s.height),w=s.width*scale,h=s.height*scale;
        for(let y=0;y<height;y+=h)for(let x=0;x<width;x+=w)append(objects,`<g transform="translate(${x} ${y})">${placedSource(s,w,h)}</g>`);
      }else{
        const ratio=(l.fit==='fit'?Math.min:Math.max)(width/s.width,height/s.height),w=s.width*ratio,h=s.height*ratio;
        append(objects,`<g transform="translate(${(width-w)/2} ${(height-h)/2})">${placedSource(s,w,h)}</g>`);
      }
    }else if(l.role==='elements'){
      const seeded={...l,seed:phaseSeed(l,p.timeline.phase,Math.round(p.timeline.duration*p.timeline.fps))};
      for(const o of layerParticles(p,seeded,p.timeline.phase)){
        const s=sources.get(o.sourceId);if(!s)continue;
        const d=artworkSize(o,s,width);
        for(const at of artworkCopies(l,o,width,height,d.width,d.height)){
          append(objects,`<g data-object-id="${escape(o.id)}" data-source="${escape(s.name)}" opacity="${o.opacity}" transform="translate(${at.x} ${at.y}) rotate(${o.angle}) scale(${o.flipX?-1:1} ${o.flipY?-1:1}) translate(${-d.width/2} ${-d.height/2})">${placedSource(s,d.width,d.height)}</g>`);
        }
      }
    }else{
      const texture=textures.get(l.id);if(!texture)throw new Error(`缺少纹理图层：${l.name}`);
      // Namespace nested vector masks/definitions just like uploaded assets.
      append(objects,assetSvg({id:l.id,name:l.name,original:texture,svg:texture,width,height,issues:[],pure:false},`texture-${l.id}`));
    }
    const transparent=p.export.background==='transparent'||index>0;
    const blend=l.blend==='multiply'?'multiply':l.blend==='max'?'lighten':l.blend==='add'&&!(l.role==='texture'&&transparent)?'overlay':'normal';
    content.push(`<g data-layer="${escape(l.name)}" opacity="${l.opacity}" style="mix-blend-mode:${blend}">${objects.join('')}</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><metadata>Texture Generator; mode=${mode}; SVG artwork retains paths; raster inputs and continuous textures retain images.</metadata><defs><clipPath id="art-canvas"><rect width="${width}" height="${height}"/></clipPath>${defs.join('')}</defs><g clip-path="url(#art-canvas)" style="isolation:isolate">${content.join('')}</g></svg>`;
}
