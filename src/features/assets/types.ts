export type LoadedAsset = {
  id: string;
  name: string;
  dataUrl: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  mimeType: string;
  sourceType: 'svg' | 'raster';
  rawText?: string;
};
