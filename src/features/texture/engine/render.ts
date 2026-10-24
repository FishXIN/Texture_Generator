import { assetImage } from '@/features/assets/svg';
import type { Scene, SceneItem } from './scene';
import { atTime, copies, itemPath } from './scene';

export type RenderRegion = { x: number; y: number; width: number; height: number };
const canvas2d = (width: number, height: number) => {
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('浏览器无法创建绘图画布');
  return { canvas, ctx };
};
export async function sceneImages(scene: Scene, scale = 1) {
  const images = new Map<string, HTMLImageElement>();
  const needed = new Map<string, {assetId:string;color:string;resolution:number}>();
  for (const { layer, items } of scene.layers) {
    for (const item of items) if (item.assetId) {
      const key=`${item.assetId}:${item.color}`;const resolution=Math.max(item.width,item.height)*scale*(layer.motion.enabled&&layer.motion.kind==='breathe'?1.4:1);
      const previous=needed.get(key);
      needed.set(key,{assetId:item.assetId,color:item.color,resolution:Math.max(resolution,previous?.resolution??0)});
    }
    if (layer.mask.enabled&&layer.mask.kind==='svg') needed.set(`mask:${layer.id}`,{assetId:layer.mask.assetId,color:'',resolution:Math.max(layer.mask.width,layer.mask.height)*scale});
  }
  await Promise.all([...needed.entries()].map(async ([key,item]) => {
    const asset = scene.project.assets.find(a=>a.id===item.assetId);
    if (asset) images.set(key,await assetImage(asset,item.color,item.resolution));
  }));
  return images;
}
export function drawTile(scene: Scene, time: number, scale: number, background: boolean, images: Map<string, HTMLImageElement>,
  region: RenderRegion = { x:0, y:0, width:scene.project.canvas.width, height:scene.project.canvas.height }) {
  const { width:W, height:H, seamless } = scene.project.canvas;
  const { canvas, ctx } = canvas2d(region.width*scale,region.height*scale);
  const scaleX=canvas.width/region.width;const scaleY=canvas.height/region.height;
  if (background) { ctx.fillStyle=scene.project.background.color; ctx.fillRect(0,0,canvas.width,canvas.height); }
  const { canvas:layerCanvas, ctx:lc } = canvas2d(canvas.width,canvas.height);
  const { canvas:maskCanvas, ctx:mc } = canvas2d(canvas.width,canvas.height);
  for (const { layer, items, maskImage } of scene.layers) {
    lc.setTransform(1,0,0,1,0,0); lc.clearRect(0,0,layerCanvas.width,layerCanvas.height);
    lc.scale(scaleX,scaleY); lc.translate(-region.x,-region.y);
    lc.globalCompositeOperation='source-over';
    for (const source of items) {
      const item=atTime(source,layer,scene.project,time);
      const positions = seamless ? copies(item,W,H,true,region) : [];
      if (!seamless) for (let x=Math.floor(region.x/W)*W;x<region.x+region.width;x+=W) {
        for (let y=Math.floor(region.y/H)*H;y<region.y+region.height;y+=H) positions.push({x:item.x+x,y:item.y+y});
      }
      for (const position of positions) {
        lc.save();
        if (!seamless) {
          lc.beginPath(); lc.rect(position.x-item.x,position.y-item.y,W,H); lc.clip();
        }
        lc.translate(position.x,position.y); lc.rotate(item.rotation*Math.PI/180);
        lc.globalAlpha=item.opacity; lc.fillStyle=item.color || '#000000';
        if (item.shape==='custom') {
          const image=images.get(`${item.assetId}:${item.color}`);
          if (image) lc.drawImage(image,-item.width/2,-item.height/2,item.width,item.height);
        } else if (item.shape==='chip') lc.fill(new Path2D(itemPath(item.shape,item.width,item.height)));
        else if (item.shape==='line') {
          lc.beginPath(); lc.roundRect(-item.width/2,-item.height/2,item.width,item.height,item.height/2); lc.fill();
        } else {
          lc.beginPath(); lc.ellipse(0,0,item.width/2,item.height/2,0,0,Math.PI*2); lc.fill();
        }
        lc.restore();
      }
    }
    if (layer.mask.enabled) {
      mc.setTransform(1,0,0,1,0,0); mc.clearRect(0,0,maskCanvas.width,maskCanvas.height);
      mc.scale(scaleX,scaleY); mc.translate(-region.x,-region.y);
      mc.fillStyle='#ffffff'; const m=layer.mask;
      const firstX=Math.floor((region.x-m.x-m.width)/W); const lastX=Math.ceil((region.x+region.width-m.x)/W);
      const firstY=Math.floor((region.y-m.y-m.height)/H); const lastY=Math.ceil((region.y+region.height-m.y)/H);
      for (let ix=firstX;ix<=lastX;ix++) for (let iy=firstY;iy<=lastY;iy++) {
        const dx=ix*W; const dy=iy*H;
        mc.save();
        if (!seamless) { mc.beginPath();mc.rect(dx,dy,W,H);mc.clip(); }
        if (m.kind==='svg') { const mask=images.get(`mask:${layer.id}`)??maskImage;if (mask) mc.drawImage(mask,m.x+dx,m.y+dy,m.width,m.height); }
        else if (m.kind==='rect') mc.fillRect(m.x+dx,m.y+dy,m.width,m.height);
        else { mc.beginPath(); mc.ellipse(m.x+dx+m.width/2,m.y+dy+m.height/2,m.width/2,m.height/2,0,0,Math.PI*2); mc.fill(); }
        mc.restore();
      }
      lc.setTransform(1,0,0,1,0,0); lc.globalCompositeOperation=m.mode==='inside'?'destination-in':'destination-out';
      lc.drawImage(maskCanvas,0,0); lc.globalCompositeOperation='source-over';
    }
    ctx.globalAlpha=layer.opacity;
    ctx.globalCompositeOperation=layer.blend==='normal'?'source-over':layer.blend;
    ctx.drawImage(layerCanvas,0,0);
  }
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  return canvas;
}
export function canvasBlob(canvas: HTMLCanvasElement, format='image/png') {
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('编码失败，请减小导出尺寸。')),format,0.95));
}
