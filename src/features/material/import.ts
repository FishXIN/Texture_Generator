import { sanitizeSvg } from '@/features/assets/svg';
import { materialId } from './model';
import type { HeightSource } from './model';
import type { DecodedSource } from './engine';

const cache = new Map<string, Promise<DecodedSource>>();
export async function decodeSource(source: HeightSource): Promise<DecodedSource> {
  const key = `${source.id}:${source.original}`;
  if (cache.has(key)) return cache.get(key)!;
  const work = (async () => {
    const svg = source.mime === 'image/svg+xml' ? sanitizeSvg(source.original, source.name).svg : '';
    const blob = svg ? new Blob([svg], { type: 'image/svg+xml' }) : await (await fetch(source.original)).blob();
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth < 1 || image.naturalHeight < 1 || image.naturalWidth > 8192 || image.naturalHeight > 8192) throw new Error('图像尺寸需在 1–8192 像素范围内');
      const ratio = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio)), height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data, pixels = new Float32Array(width * height);
      for (let i = 0; i < pixels.length; i++) {
        const alpha = data[i * 4 + 3] / 255;
        pixels[i] = ((data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722) / 255) * alpha + 0.5 * (1 - alpha);
      }
      return { id: source.id, width, height, pixels };
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
  const decoded = await decodeSource(source); source.width = decoded.width; source.height = decoded.height;
  warnings.push('导入源按灰度读取，透明区域使用中灰；解码上限 1024 px。边缘融合会调整原图。');
  return { source, warnings };
}
