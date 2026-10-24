export const MAX_CANVAS_SIZE = 8192;
export const EXPORT_SIZES = [128, 256, 512, 1024, 2048, 4096, 8192] as const;
export const CANVAS_RATIOS = [
  [21, 9], [16, 9], [3, 2], [4, 3], [5, 4], [1, 1], [4, 5], [3, 4], [2, 3], [9, 16], [9, 21],
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
