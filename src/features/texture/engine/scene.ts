import type { Asset, Layer, Project, Shape } from '@/features/project/model';
import { assetImage } from '@/features/assets/svg';
import { mulberry32 } from './rng';

export type SceneItem = {
  id: string; layerId: string; assetId: string; shape: Shape; manual: boolean;
  x: number; y: number; width: number; height: number; rotation: number; opacity: number;
  color: string; motionLocked: boolean; phase: number;
};
export type SceneLayer = { layer: Layer; items: SceneItem[]; maskImage?: HTMLImageElement };
export type Scene = { project: Project; layers: SceneLayer[]; count: number; requested: number };
export const mod = (v: number, period: number) => ((v % period) + period) % period;
export const radians = (value: number) => value * Math.PI / 180;
const maskCache = new Map<string, Promise<{ image: HTMLImageElement; data: Uint8ClampedArray }>>();
async function maskData(asset: Asset) {
  let entry = maskCache.get(asset.svg);
  if (!entry) {
    entry = assetImage(asset).then(image => {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0, 256, 256);
      return { image, data: ctx.getImageData(0, 0, 256, 256).data };
    });
    maskCache.set(asset.svg, entry); if (maskCache.size > 32) maskCache.delete(maskCache.keys().next().value!);
  }
  return entry;
}
const tint = (hex: string, amount: number) => '#' + [1,3,5].map(i => Math.max(0, Math.min(255, parseInt(hex.slice(i,i+2),16) + amount)).toString(16).padStart(2,'0')).join('');
export async function buildScene(project: Project): Promise<Scene> {
  const { width: W, height: H, seamless } = project.canvas;
  let requested = 0; let count = 0;
  const layers: SceneLayer[] = [];
  for (const layer of project.layers) {
    if (!layer.visible) continue;
    requested += layer.count;
    const assets = layer.assets.filter(a => a.weight > 0 && project.assets.some(x => x.id === a.id));
    const totalWeight = assets.reduce((sum,a) => sum + a.weight, 0);
    const rng = mulberry32(layer.seeds.position);
    const size = mulberry32(layer.seeds.size); const rotation = mulberry32(layer.seeds.rotation); const colors = mulberry32(layer.seeds.color);
    const choice = mulberry32(layer.seeds.position ^ 0x73a528);
    const maskAsset = project.assets.find(a => a.id === layer.mask.assetId);
    const mask = layer.mask.enabled && layer.mask.kind === 'svg' && maskAsset ? await maskData(maskAsset) : undefined;
    const inside = (x: number, y: number) => {
      if (!layer.mask.enabled) return true;
      const m = layer.mask;
      let hit = false;
      // A mask is itself a repeatable tile. Test shifted copies at periodic edges.
      const firstX=seamless?Math.ceil((x-m.x-m.width)/W):0;const lastX=seamless?Math.floor((x-m.x)/W):0;
      const firstY=seamless?Math.ceil((y-m.y-m.height)/H):0;const lastY=seamless?Math.floor((y-m.y)/H):0;
      for (let ix=firstX;ix<=lastX;ix++) for (let iy=firstY;iy<=lastY;iy++) {
        const dx=ix*W;const dy=iy*H;
        const u = (x - m.x - dx) / m.width; const v = (y - m.y - dy) / m.height;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        if (m.kind === 'ellipse') hit ||= (u-0.5)**2 + (v-0.5)**2 <= 0.25;
        else if (m.kind === 'svg') hit ||= !!mask && mask.data[(Math.floor(v*256)*256+Math.floor(u*256))*4+3] > 0;
        else hit = true;
      }
      return m.mode === 'inside' ? hit : !hit;
    };
    const columns = Math.max(1, Math.round(Math.sqrt(layer.count * W / H)));
    const rows = Math.max(1, Math.ceil(layer.count / columns));
    const clusters = Array.from({ length: 5 }, () => ({ x: rng()*W, y: rng()*H }));
    const items: SceneItem[] = [];
    const cell = Math.max(1, layer.maxSize * 1.5 + layer.spacing);
    const nx = Math.max(1, Math.floor(W/cell)); const ny = Math.max(1, Math.floor(H/cell));
    const buckets = new Map<string, SceneItem[]>();
    let attempts = 0;
    const limit = Math.min(150000, Math.max(layer.count * 35, 100));
    while (items.length < layer.count && attempts < limit && (layer.shape !== 'custom' || totalWeight > 0)) {
      const index = attempts++; let x: number; let y: number;
      if (layer.distribution === 'grid' || layer.distribution === 'stagger') {
        if (index >= layer.count) break;
        const row = Math.floor(index/columns); const col = index%columns;
        x = (col+0.5+(layer.distribution==='stagger' && row%2 ? 0.5 : 0))*W/columns;
        y = (row+0.5)*H/rows;
        x += (rng()-0.5)*W/columns*layer.jitter; y += (rng()-0.5)*H/rows*layer.jitter;
      } else if (layer.distribution === 'cluster') {
        const c = clusters[Math.floor(rng()*clusters.length)];
        const angle = rng()*Math.PI*2; const distance = Math.sqrt(-2*Math.log(Math.max(1e-7,rng()))) * (1-layer.cluster+0.08);
        x = c.x + Math.cos(angle)*distance*W*0.24; y = c.y + Math.sin(angle)*distance*H*0.24;
      } else { x = rng()*W; y = rng()*H; }
      if (seamless) { x = mod(x,W); y = mod(y,H); }
      else if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const grad = (Math.cos(radians(layer.direction))* (x/W-0.5) + Math.sin(radians(layer.direction))*(y/H-0.5))*2;
      if (layer.gradient && rng() > Math.max(0, Math.min(1, 1-Math.abs(layer.gradient)+grad*layer.gradient))) continue;
      if (!inside(x,y)) continue;
      if (layer.spacing > 0) {
        const bx = Math.floor(x/W*nx); const by = Math.floor(y/H*ny); let blocked = false;
        for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) {
          const key = `${seamless ? mod(bx+dx,nx) : bx+dx},${seamless ? mod(by+dy,ny) : by+dy}`;
          for (const other of buckets.get(key) ?? []) {
            let distanceX = Math.abs(x-other.x); let distanceY = Math.abs(y-other.y);
            if (seamless) { distanceX = Math.min(distanceX,W-distanceX); distanceY = Math.min(distanceY,H-distanceY); }
            if (Math.hypot(distanceX,distanceY) < cell) { blocked = true; break; }
          }
        }
        if (blocked) continue;
      }
      let assetId = ''; let asset: Asset | undefined;
      if (layer.shape === 'custom') {
        let pick = choice()*totalWeight;
        assetId = assets.find(a => (pick -= a.weight) < 0)?.id ?? assets[0].id;
        asset = project.assets.find(a => a.id === assetId);
      }
      const s = layer.minSize + size()*(layer.maxSize-layer.minSize);
      const item: SceneItem = {
        id: `${layer.id}_${items.length}`, layerId: layer.id, assetId, shape: layer.shape, manual: false,
        x,y, width:asset ? s*asset.width/Math.max(asset.width,asset.height) : s,
        height: asset ? s*asset.height/Math.max(asset.width,asset.height) : layer.shape==='ellipse' ? s*0.58 : layer.shape==='line' ? s*0.13 : s,
        rotation: layer.rotation + (rotation()*2-1)*layer.rotationRange,
        opacity:1, color: tint(layer.color, Math.round((colors()-0.5)*12)), motionLocked:false, phase:choice()*Math.PI*2,
      };
      items.push(item); const key = `${Math.floor(x/W*nx)},${Math.floor(y/H*ny)}`;
      const list = buckets.get(key) ?? []; list.push(item); buckets.set(key,list);
    }
    for (const o of project.objects.filter(o => o.layerId === layer.id)) {
      items.push({ ...o, shape:'custom', manual:true, phase:0 });
    }
    count += items.length; layers.push({ layer, items, maskImage:mask?.image });
  }
  return { project, layers, count, requested };
}
export function atTime(item: SceneItem, layer: Layer, project: Project, time: number): SceneItem {
  const result = { ...item }; const motion = layer.motion;
  if (!motion.enabled || item.motionLocked) return result;
  const t = mod(time, project.animation.duration) / project.animation.duration;
  const angle = t * Math.PI * 2 * motion.cycles; const direction = radians(motion.direction);
  const sin = Math.sin(angle); const cos = Math.cos(angle);
  if (motion.kind === 'drift' || motion.kind === 'flow') {
    if (project.canvas.seamless) {
      // Integer tile journeys return to exactly the same spatial phase.
      const dx = Math.round(Math.cos(direction)); const dy = Math.round(Math.sin(direction));
      result.x += dx*project.canvas.width*t*motion.cycles; result.y += dy*project.canvas.height*t*motion.cycles;
    } else {
      result.x += Math.cos(direction)*sin*motion.amplitude; result.y += Math.sin(direction)*sin*motion.amplitude;
    }
  } else if (motion.kind === 'wander') {
    result.x += (Math.sin(angle+item.phase)-Math.sin(item.phase))*motion.amplitude;
    result.y += (Math.cos(angle+item.phase)-Math.cos(item.phase))*motion.amplitude;
  } else if (motion.kind === 'rotate') result.rotation += sin*motion.amplitude;
  else {
    const scale = 1+sin*Math.min(0.4,motion.amplitude/100);
    result.width *= scale; result.height *= scale;
  }
  if (project.canvas.seamless) { result.x=mod(result.x,project.canvas.width); result.y=mod(result.y,project.canvas.height); }
  return result;
}
export function copies(item: SceneItem, width: number, height: number, seamless: boolean,
  region = { x: 0, y: 0, width, height }) {
  if (!seamless) return [{ x:item.x, y:item.y }];
  const radius = Math.hypot(item.width,item.height)/2;
  const x = mod(item.x,width); const y=mod(item.y,height); const positions = [];
  for (let ix=Math.ceil((region.x-radius-x)/width); ix<=Math.floor((region.x+region.width+radius-x)/width); ix++) {
    for (let iy=Math.ceil((region.y-radius-y)/height); iy<=Math.floor((region.y+region.height+radius-y)/height); iy++) positions.push({x:x+ix*width,y:y+iy*height});
  }
  return positions;
}
export function itemPath(shape: Shape, w: number, h: number) {
  if (shape === 'chip') return `M ${-w*.47} ${-h*.3} L ${w*.17} ${-h*.5} L ${w*.5} ${h*.15} L ${w*.1} ${h*.47} L ${-w*.5} ${h*.2} Z`;
  return '';
}
