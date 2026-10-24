import { clamp } from '@/shared/lib/math';
import { mulberry32 } from './rng';
import type { LoadedAsset } from '@/features/assets/types';
import type { Params, PlacedItem } from '../types';

type GenerateLayoutArgs = {
  canvasWidth: number;
  canvasHeight: number;
  elements: LoadedAsset[];
  params: Params;
};

export function generateLayout({ canvasWidth, canvasHeight, elements, params }: GenerateLayoutArgs): PlacedItem[] {
  if (!canvasWidth || !canvasHeight || !elements.length || params.density <= 0) {
    return [];
  }

  const random = mulberry32(params.seed);
  const placements: PlacedItem[] = [];
  const total = clamp(Math.round(params.density), 1, 2000);
  const enforceSpacing = params.spacing >= 0;
  const maxAttemptsPerItem = enforceSpacing ? 60 : 1;

  for (let index = 0; index < total; index += 1) {
    const element = elements[Math.floor(random() * elements.length)];
    if (!element) continue;

    const sizeJitter = 1 + (random() * 2 - 1) * params.sizeRandomness;
    const scale = clamp(params.baseSize * sizeJitter, 0.05, 6);
    const width = element.width * scale;
    const height = element.height * scale;
    const rotation = params.rotationFullRandom
      ? random() * 360
      : params.baseAngle + (random() * 2 - 1) * params.rotationRandomness;
    const bounds = getPlacementBounds(canvasWidth, canvasHeight, width, height, params.edgeMargin);
    let placed = false;

    for (let attempt = 0; attempt < maxAttemptsPerItem; attempt += 1) {
      const x = randomInRange(random, bounds.minX, bounds.maxX);
      const y = randomInRange(random, bounds.minY, bounds.maxY);

      if (enforceSpacing && hasCollision(placements, x, y, width, height, params.spacing)) {
        continue;
      }

      placements.push({
        id: `${params.seed}-${index}`,
        elementId: element.id,
        x,
        y,
        width,
        height,
        rotation,
      });
      placed = true;
      break;
    }

    if (!placed && !enforceSpacing) {
      placements.push({
        id: `${params.seed}-${index}`,
        elementId: element.id,
        x: randomInRange(random, bounds.minX, bounds.maxX),
        y: randomInRange(random, bounds.minY, bounds.maxY),
        width,
        height,
        rotation,
      });
    }
  }

  return placements;
}

function getPlacementBounds(
  canvasWidth: number,
  canvasHeight: number,
  width: number,
  height: number,
  edgeMargin: number,
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const minX = clamp(halfWidth + edgeMargin, 0, canvasWidth);
  const maxX = clamp(canvasWidth - halfWidth - edgeMargin, 0, canvasWidth);
  const minY = clamp(halfHeight + edgeMargin, 0, canvasHeight);
  const maxY = clamp(canvasHeight - halfHeight - edgeMargin, 0, canvasHeight);

  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  };
}

function randomInRange(random: () => number, min: number, max: number) {
  if (min === max) return min;
  return min + random() * (max - min);
}

function hasCollision(
  placements: PlacedItem[],
  nextX: number,
  nextY: number,
  nextWidth: number,
  nextHeight: number,
  spacing: number,
) {
  const nextRadius = Math.hypot(nextWidth / 2, nextHeight / 2);

  return placements.some((item) => {
    const currentRadius = Math.hypot(item.width / 2, item.height / 2);
    const minDistance = currentRadius + nextRadius + spacing;
    const distance = Math.hypot(item.x - nextX, item.y - nextY);
    return distance < minDistance;
  });
}
