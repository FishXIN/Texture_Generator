import { useEffect, useRef } from 'react';
import type { MaterialMaps } from './engine';

export function mapCanvas(maps: MaterialMaps, normal: boolean, transparent = false, pigment: 'black' | 'white' = 'black') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = maps.size;
  const data = new Uint8ClampedArray(maps.size * maps.size * 4);
  if (normal) data.set(maps.normal);
  else for (let i = 0; i < maps.height.length; i++) {
    const h = Math.round(maps.height[i] * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = transparent ? pigment === 'white' ? 255 : 0 : h;
    data[i * 4 + 3] = transparent ? pigment === 'white' ? h : 255 - h : 255;
  }
  canvas.getContext('2d')!.putImageData(new ImageData(data, maps.size, maps.size), 0, 0); return canvas;
}
export function MapView({ maps, normal = false, transparent = false, pigment = 'black', repeat = 1, boundaries = false, label }: {
  maps: MaterialMaps | null; normal?: boolean; transparent?: boolean; pigment?: 'black' | 'white'; repeat?: number; boundaries?: boolean; label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !maps) return;
    const unit = mapCanvas(maps, normal, transparent, pigment); canvas.width = canvas.height = maps.size;
    const ctx = canvas.getContext('2d')!, size = maps.size / repeat;
    for (let y = 0; y < repeat; y++) for (let x = 0; x < repeat; x++) ctx.drawImage(unit, x * size, y * size, size, size);
    if (boundaries && repeat > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
      for (let k = 1; k < repeat; k++) { ctx.beginPath(); ctx.moveTo(k * size, 0); ctx.lineTo(k * size, maps.size); ctx.moveTo(0, k * size); ctx.lineTo(maps.size, k * size); ctx.stroke(); }
    }
  }, [maps, normal, transparent, pigment, repeat, boundaries]);
  return <canvas ref={ref} aria-label={label} className="material-map" />;
}
