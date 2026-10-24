import { crc32 } from '@/features/export/zip';
import type { MaterialMaps } from './engine';

function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(12 + data.length), view = new DataView(bytes.buffer);
  view.setUint32(0, data.length); bytes.set(new TextEncoder().encode(type), 4); bytes.set(data, 8);
  view.setUint32(8 + data.length, crc32(bytes.subarray(4, 8 + data.length)));
  return bytes;
}
export async function encodePng(maps: MaterialMaps, channel: 'height' | 'normal', depth: 8 | 16 = 16, transparent = false): Promise<Uint8Array> {
  const size = maps.size, height = channel === 'height', alpha = height && transparent, bits = height ? depth : 8;
  const stride = size * (height ? bits / 8 * (alpha ? 2 : 1) : 3);
  const raw = new Uint8Array((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    let offset = y * (stride + 1) + 1;
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      if (height) {
        const value = Math.round(Math.max(0, Math.min(1, maps.height[k])) * (bits === 16 ? 65535 : 255));
        if (alpha) {
          raw[offset++] = 0; if (bits === 16) raw[offset++] = 0;
          const opacity = (bits === 16 ? 65535 : 255) - value;
          if (bits === 16) raw[offset++] = opacity >>> 8;
          raw[offset++] = opacity & 255;
        } else {
          if (bits === 16) raw[offset++] = value >>> 8;
          raw[offset++] = value & 255;
        }
      } else { raw[offset++] = maps.normal[k * 4]; raw[offset++] = maps.normal[k * 4 + 1]; raw[offset++] = maps.normal[k * 4 + 2]; }
    }
  }
  if (typeof CompressionStream === 'undefined') throw new Error('此浏览器不支持 PNG 压缩，请使用新版 Chrome / Edge / Safari。');
  const compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const ihdr = new Uint8Array(13), view = new DataView(ihdr.buffer);
  view.setUint32(0, size); view.setUint32(4, size); ihdr[8] = bits; ihdr[9] = height ? alpha ? 4 : 0 : 2;
  const chunks = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', new Uint8Array())];
  const png = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0)); let offset = 0;
  for (const c of chunks) { png.set(c, offset); offset += c.length; }
  return png;
}
