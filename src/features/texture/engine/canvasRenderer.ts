import type { LoadedAsset } from '@/features/assets/types';
import type { PlacedItem } from '../types';

type RenderSceneArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  baseAsset: LoadedAsset;
  elementsById: Map<string, LoadedAsset>;
  placements: PlacedItem[];
  background?: string;
};

export function renderScene({ ctx, width, height, baseAsset, elementsById, placements, background }: RenderSceneArgs) {
  if (background) {
    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  ctx.drawImage(baseAsset.bitmap, 0, 0, width, height);

  for (const item of placements) {
    const element = elementsById.get(item.elementId);
    if (!element) continue;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(element.bitmap, -item.width / 2, -item.height / 2, item.width, item.height);
    ctx.restore();
  }
}
