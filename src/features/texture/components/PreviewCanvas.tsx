import { useEffect, useMemo, useRef } from 'react';
import { useCanvasFit } from '../useCanvasFit';
import { renderScene } from '../engine/canvasRenderer';
import type { LoadedAsset } from '@/features/assets/types';
import type { PlacedItem } from '../types';

type PreviewCanvasProps = {
  baseAsset: LoadedAsset;
  elements: LoadedAsset[];
  placements: PlacedItem[];
};

export function PreviewCanvas({ baseAsset, elements, placements }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { containerRef, displayWidth, displayHeight } = useCanvasFit(baseAsset.width, baseAsset.height);
  const elementsById = useMemo(() => new Map(elements.map((item) => [item.id, item])), [elements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayWidth || !displayHeight) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(baseAsset.width * ratio));
    canvas.height = Math.max(1, Math.round(baseAsset.height * ratio));
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, baseAsset.width, baseAsset.height);
    renderScene({
      ctx: context,
      width: baseAsset.width,
      height: baseAsset.height,
      baseAsset,
      elementsById,
      placements,
    });
  }, [baseAsset, displayHeight, displayWidth, elementsById, placements]);

  return (
    <div ref={containerRef} className="h-full min-h-[320px] rounded-3xl border border-border bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] p-6">
      <div className="flex h-full items-center justify-center overflow-hidden rounded-[28px] bg-[#05070b]">
        <canvas ref={canvasRef} className="max-h-full max-w-full rounded-2xl shadow-2xl shadow-black/30" />
      </div>
    </div>
  );
}
