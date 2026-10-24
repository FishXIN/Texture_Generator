import { zipFiles } from '@/features/export/zip';
import { isSeamless } from './model';
import type { MaterialProject } from './model';
import type { MaterialMaps } from './engine';
import { encodePng } from './png';

export const materialFilename = (p: MaterialProject) => p.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'material';
export async function exportMaterial(p: MaterialProject, maps: MaterialMaps, progress?: (v: number) => void) {
  const name = materialFilename(p), size = maps.size, convention = p.normal.convention === 'opengl' ? 'OpenGL' : 'DirectX';
  const files: { name: string; data: Uint8Array }[] = [];
  if (p.export.maps !== 'normal') {
    files.push({ name: maps.composition?`${name}_${p.export.scope==='material'?'Material':'Canvas'}_${maps.width}x${maps.pixelHeight}.png`:`${name}_${p.export.background === 'transparent' ? p.export.pigment === 'white' ? 'White_Alpha' : 'Black_Alpha' : 'Grayscale'}_${p.export.depth}bit_${size}.png`, data: await encodePng(maps, 'height', p.export.depth, p.export.background === 'transparent', p.export.pigment) }); progress?.(0.5);
  }
  if (p.export.maps !== 'height') {
    files.push({ name: `${name}_Normal_${convention}_${size}.png`, data: await encodePng(maps, 'normal', 8) }); progress?.(0.85);
  }
  if (p.export.maps !== 'both') return { blob: new Blob([new Uint8Array(files[0].data)], { type: 'image/png' }), filename: files[0].name, extension: 'png' };
  files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({
    generator: 'Texture Generator 0.6.0', size,width:maps.width??size,height:maps.pixelHeight??size,scope:p.export.scope, seamless: isSeamless(p),phase:p.timeline.phase,
    texture: { bitDepth: maps.composition?8:p.export.depth, colorType: maps.composition?'RGBA':p.export.background === 'transparent' ? 'grayscale-alpha' : 'grayscale', background: p.export.background,
      range: [0, 1], alpha: maps.composition?'original source Alpha and layer coverage':p.export.background === 'transparent' ? p.export.pigment === 'white' ? 'white pigment with alpha = grayscale' : 'black pigment with alpha = 1 - grayscale' : 'opaque', space: maps.composition?'untagged RGBA':'untagged grayscale' },
    normal: { bitDepth: 8, colorType: 'RGB', space: 'linear data', convention, tangentSpace: true, strength: p.normal.strength, formula: 'normalize(-dh/du * strength * 0.05, +dh/dv * strength * 0.05, 1); DirectX flips green', imageV: 'down' },
    layers: p.layers.map(l => ({ name: l.name, kind: l.kind, seed: l.seed, visible: l.visible })),
    usage: 'Opaque grayscale: use Multiply or Screen in a design app, or import as non-color height/mask data. Transparent black: alpha = 1 - grayscale. Transparent white: alpha = grayscale, for light overlays. Normal: import as non-color data with the matching OpenGL / DirectX convention.',
  }, null, 2)) });
  progress?.(1); return { blob: zipFiles(files), filename: `${name}_Maps_${size}.zip`, extension: 'zip' };
}
