import type { LoadedAsset } from './types';

export async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export async function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file as text.'));
    reader.readAsText(file);
  });
}

async function createBitmapFromDataUrl(dataUrl: string) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to create canvas context.');
  context.drawImage(image, 0, 0);
  return createImageBitmap(canvas);
}

export async function loadAssetFromFile(file: File): Promise<LoadedAsset> {
  const dataUrl = await readFileAsDataUrl(file);
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const rawText = isSvg ? await readFileAsText(file) : undefined;
  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = await createBitmapFromDataUrl(dataUrl);
  }

  return {
    id: crypto.randomUUID(),
    name: file.name,
    dataUrl,
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    mimeType: file.type || (isSvg ? 'image/svg+xml' : 'image/png'),
    sourceType: isSvg ? 'svg' : 'raster',
    rawText,
  };
}
