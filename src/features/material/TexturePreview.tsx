import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { MaterialMaps } from './engine';

export function mapCanvas(maps: MaterialMaps, normal: boolean, transparent = false, pigment: 'black' | 'white' = 'black') {
  const w=maps.width??maps.size,h=maps.pixelHeight??maps.size;
  const canvas = document.createElement('canvas'); canvas.width=w;canvas.height=h;
  const data = new Uint8ClampedArray(w * h * 4);
  if (normal) data.set(maps.normal);
  else if(maps.composition)data.set(maps.composition);
  else for (let i = 0; i < maps.height.length; i++) {
    const h = Math.round(maps.height[i] * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = transparent ? pigment === 'white' ? 255 : 0 : h;
    data[i * 4 + 3] = transparent ? pigment === 'white' ? h : 255 - h : 255;
  }
  canvas.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0); return canvas;
}
export function MapView({ maps, normal = false, transparent = false, pigment = 'black', repeat = 1, boundaries = false, label }: {
  maps: MaterialMaps | null; normal?: boolean; transparent?: boolean; pigment?: 'black' | 'white'; repeat?: number; boundaries?: boolean; label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !maps) return;
    if(normal&&!maps.normal.length)return;
    const unit = mapCanvas(maps, normal, transparent, pigment); canvas.width=unit.width;canvas.height=unit.height;
    const ctx = canvas.getContext('2d')!, w = unit.width / repeat,h=unit.height/repeat;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(repeat===1)ctx.drawImage(unit,0,0);
    else{
      const pattern=ctx.createPattern(unit,'repeat')!;
      pattern.setTransform(new DOMMatrix().scale(1/repeat));
      ctx.fillStyle=pattern;ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    if (boundaries && repeat > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
      for (let k = 1; k < repeat; k++) { ctx.beginPath(); ctx.moveTo(k * w, 0); ctx.lineTo(k * w, canvas.height); ctx.moveTo(0, k * h); ctx.lineTo(canvas.width, k * h); ctx.stroke(); }
    }
  }, [maps, normal, transparent, pigment, repeat, boundaries]);
  return <canvas ref={ref} aria-label={label} className="material-map" style={{'--canvas-aspect':(maps?.width??maps?.size??1)/(maps?.pixelHeight??maps?.size??1)} as CSSProperties} />;
}
