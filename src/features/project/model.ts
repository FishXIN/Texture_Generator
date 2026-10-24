export type Shape = 'circle' | 'ellipse' | 'line' | 'chip' | 'custom';
export type Distribution = 'random' | 'grid' | 'stagger' | 'cluster';
export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'color-burn';
export type RandomPart = 'position' | 'size' | 'rotation' | 'color';
export type Asset = {
  id: string; name: string; original: string; svg: string; width: number; height: number;
  issues: string[]; pure: boolean;
};
export type Mask = {
  enabled: boolean; kind: 'rect' | 'ellipse' | 'svg'; mode: 'inside' | 'outside';
  x: number; y: number; width: number; height: number; assetId: string;
};
export type Motion = {
  enabled: boolean; kind: 'drift' | 'wander' | 'flow' | 'rotate' | 'breathe';
  amplitude: number; direction: number; cycles: number;
};
export type Layer = {
  id: string; name: string; visible: boolean; locked: boolean; opacity: number; blend: Blend;
  shape: Shape; count: number; minSize: number; maxSize: number; color: string;
  rotation: number; rotationRange: number; distribution: Distribution; spacing: number;
  cluster: number; gradient: number; jitter: number; direction: number;
  assets: { id: string; weight: number }[];
  seeds: Record<RandomPart, number>; locks: Record<RandomPart, boolean>;
  mask: Mask; motion: Motion;
};
export type ManualObject = {
  id: string; layerId: string; assetId: string; x: number; y: number; width: number; height: number;
  rotation: number; opacity: number; color: string; locked: boolean; motionLocked: boolean;
};
export type ExportSettings = {
  format: 'png' | 'jpeg' | 'svg' | 'sequence'; svgMode: 'pure' | 'effects' | 'optimized';
  region: 'canvas' | 'unit' | 'selection' | 'filled'; scale: number; repeats: number;
  transparent: boolean; fps: number; selection: { x: number; y: number; width: number; height: number };
};
export type Project = {
  version: 1; name: string; canvas: { width: number; height: number; seamless: boolean };
  background: { visible: boolean; color: string }; assets: Asset[]; layers: Layer[];
  objects: ManualObject[]; animation: { duration: number }; export: ExportSettings;
};
export const clone = <T,>(value: T): T => structuredClone(value);
export const uid = () => crypto.randomUUID();
export function newLayer(name = '图形颗粒'): Layer {
  return {
    id: uid(), name, visible: true, locked: false, opacity: 0.8, blend: 'normal',
    shape: 'circle', count: 600, minSize: 1, maxSize: 4, color: '#33382b',
    rotation: 0, rotationRange: 180, distribution: 'random', spacing: 0,
    cluster: 0.65, gradient: 0, jitter: 0.4, direction: 0, assets: [],
    seeds: { position: 142, size: 932, rotation: 528, color: 714 },
    locks: { position: false, size: false, rotation: false, color: false },
    mask: { enabled: false, kind: 'rect', mode: 'inside', x: 64, y: 64, width: 384, height: 384, assetId: '' },
    motion: { enabled: false, kind: 'wander', amplitude: 12, direction: 0, cycles: 1 },
  };
}
export function newProject(): Project {
  return {
    version: 1, name: '未命名纹理', canvas: { width: 512, height: 512, seamless: true },
    background: { visible: false, color: '#f5f2e9' }, assets: [], layers: [newLayer('01 细密颗粒')],
    objects: [], animation: { duration: 4 },
    export: { format: 'png', svgMode: 'pure', region: 'unit', scale: 1, repeats: 3,
      transparent: true, fps: 24, selection: { x: 128, y: 128, width: 256, height: 256 } },
  };
}
export const presets = [
  { id: 'grain', name: '01 细密颗粒', description: '透明叠加 · 细而均匀', shape: 'circle', count: 1800, minSize: 0.6, maxSize: 2, opacity: 0.35, color: '#292c25', distribution: 'random' },
  { id: 'speckle', name: '02 斑点纸感', description: '两层颗粒 · 疏密对比', shape: 'chip', count: 480, minSize: 1.5, maxSize: 6, opacity: 0.5, color: '#76604a', distribution: 'random' },
  { id: 'fiber', name: '03 纤维线条', description: '矢量短线 · 方向纹理', shape: 'line', count: 700, minSize: 3, maxSize: 12, opacity: 0.5, color: '#62644e', distribution: 'random' },
  { id: 'confetti', name: '04 彩色碎片', description: '多层配色 · 循环游动', shape: 'chip', count: 80, minSize: 8, maxSize: 18, opacity: 0.95, color: '#ca674f', distribution: 'random' },
  { id: 'dots', name: '05 错位圆点', description: '规则排列 · 包装图案', shape: 'circle', count: 100, minSize: 12, maxSize: 12, opacity: 1, color: '#626d43', distribution: 'stagger' },
] as const;
export function presetProject(id: string): Project {
  const p = newProject();
  const preset = presets.find(item => item.id === id) ?? presets[0];
  Object.assign(p.layers[0], preset, { id: uid() });
  p.name = preset.name.slice(3);
  if (id === 'speckle') {
    const fine = newLayer('02 细颗粒'); fine.count = 1600; fine.maxSize = 1.5; fine.opacity = 0.2;
    p.layers.unshift(fine);
  }
  if (id === 'confetti') {
    p.layers[0].motion.enabled = true;
    for (const [index, color] of ['#d1ac49', '#628282'].entries()) {
      const layer = clone(p.layers[0]); layer.id = uid(); layer.name = `0${index + 2} 彩色碎片`;
      layer.color = color; layer.seeds.position += (index + 1) * 107; p.layers.push(layer);
    }
  }
  return p;
}
