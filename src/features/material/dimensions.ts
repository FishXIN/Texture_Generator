export const MAX_CANVAS_SIZE = 8192;
export const EXPORT_SIZES = [128, 256, 512, 1024, 2048, 4096, 8192] as const;
export const CANVAS_RATIOS = [
  [1, 1], [16, 9], [9, 16], [4, 3], [3, 4], [3, 2], [2, 3], [4, 5], [5, 4], [21, 9],
] as const;

export function canvasDimensions(width: number, height: number, longest: number) {
  const scale = longest / Math.max(width, height);
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

export function canvasRatio(canvas: {width: number; height: number}) {
  return CANVAS_RATIOS.find(([w,h]) => {
    const dimensions = canvasDimensions(w, h, Math.max(canvas.width, canvas.height));
    return dimensions.width === canvas.width && dimensions.height === canvas.height;
  })?.join(':') ?? 'custom';
}

export const resolutionLabel = (size: number) => size >= 1024 ? `${size / 1024}K · ${size} px` : `${size} px`;
