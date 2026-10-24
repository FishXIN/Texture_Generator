import { sanitizeSvg } from '@/features/assets/svg';
import { materialId } from './model';
import type { HeightSource } from './model';
import type { DecodedSource } from './engine';
import type { Point } from './algorithms';

const cache = new Map<string, Promise<DecodedSource>>();
export async function decodeSource(source: HeightSource, limit = 1024): Promise<DecodedSource> {
  const key = `${limit}:${source.id}:${source.original}`;
  if (cache.has(key)) return cache.get(key)!;
  const work = (async () => {
    const svg = source.mime === 'image/svg+xml' ? sanitizeSvg(source.original, source.name).svg : '';
    const blob = svg ? new Blob([svg], { type: 'image/svg+xml' }) : await (await fetch(source.original)).blob();
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth < 1 || image.naturalHeight < 1 || image.naturalWidth > 8192 || image.naturalHeight > 8192) throw new Error('图像尺寸需在 1–8192 像素范围内');
      const ratio = source.mime==='image/svg+xml'?limit/Math.max(image.naturalWidth,image.naturalHeight):Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio)), height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data, pixels = new Float32Array(width * height), gray=new Float32Array(width*height), alphaChannel=new Float32Array(width*height);
      for (let i = 0; i < pixels.length; i++) {
        const alpha = data[i * 4 + 3] / 255;
        gray[i]=(data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722)/255;
        alphaChannel[i]=alpha;pixels[i]=gray[i]*alpha+.5*(1-alpha);
      }
      return { id: source.id, width, height, pixels, gray, alpha:alphaChannel, rgba:new Uint8ClampedArray(data), originalWidth:image.naturalWidth, originalHeight:image.naturalHeight };
    } finally { URL.revokeObjectURL(url); }
  })();
  cache.set(key, work);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  try { return await work; } catch (e) { cache.delete(key); throw e; }
}
export async function importHeight(file: File): Promise<{ source: HeightSource; warnings: string[] }> {
  if (file.size > 5_000_000) throw new Error('单张素材不能超过 5 MB');
  let mime = file.type, original = '', warnings: string[] = [];
  if (file.name.toLowerCase().endsWith('.svg') || mime === 'image/svg+xml') {
    mime = 'image/svg+xml'; original = await file.text();
    const cleaned = sanitizeSvg(original, file.name); warnings = cleaned.issues;
  } else {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) throw new Error('支持 PNG、JPEG、WebP 和 SVG');
    original = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('素材读取失败')); reader.readAsDataURL(file);
    });
  }
  const source: HeightSource = { id: materialId(), name: file.name.slice(0, 200), mime, original, width: 1, height: 1 };
  const decoded = await decodeSource(source); source.width = decoded.originalWidth ?? decoded.width; source.height = decoded.originalHeight ?? decoded.height;
  return { source, warnings };
}
export function sampleSvgPath(source:HeightSource):Point[] {
  if(source.mime!=='image/svg+xml')throw new Error('请选择 SVG 轮廓素材');
  const asset=sanitizeSvg(source.original,source.name),host=document.createElement('div');
  host.style.cssText='position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none';
  host.innerHTML=asset.svg;document.body.append(host);
  try{
    const root=host.querySelector('svg')!,items=[...root.querySelectorAll<SVGGeometryElement>('path,polyline,polygon,line,rect,circle,ellipse')];
    let longest:SVGGeometryElement|undefined,length=0;
    for(const item of items){try{const n=item.getTotalLength();if(n>length){length=n;longest=item;}}catch{}}
    if(!longest||length<=0)throw new Error('SVG 中没有可读取的轮廓');
    const box=root.viewBox.baseVal,matrix=root.getCTM()!.inverse().multiply(longest.getCTM()!);
    const count=Math.min(128,Math.max(16,Math.round(length/4)));
    return Array.from({length:count},(_,i)=>{
      const point=longest!.getPointAtLength(length*i/(count-1)),at=new DOMPoint(point.x,point.y).matrixTransform(matrix);
      return{x:Math.max(0,Math.min(1,(at.x-box.x)/box.width)),y:Math.max(0,Math.min(1,(at.y-box.y)/box.height))};
    });
  }finally{host.remove();}
}
