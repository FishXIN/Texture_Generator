export const generators = {
  noise: '多尺度噪声', ridged: '岩石脊线', cells: '细胞表面', cracks: '裂纹',
  fibers: '方向纤维', woven: '编织', waves: '波纹', spots: '随机斑点', image: '导入灰度',
} as const;
export type Generator = keyof typeof generators;
export type HeightLayer = {
  id: string; name: string; visible: boolean; locked: boolean; kind: Generator;
  seed: number; scale: number; octaves: number; detail: number; warp: number;
  direction: 'horizontal' | 'vertical' | 'diagonal';
  contrast: number; bias: number; invert: boolean; opacity: number;
  blend: 'replace' | 'add' | 'multiply' | 'max'; sourceId: string; tileSource: boolean;
};
export type HeightSource = { id: string; name: string; original: string; mime: string; width: number; height: number };
export type MaterialProject = {
  kind: 'surface-material'; version: 1; name: string; layers: HeightLayer[]; sources: HeightSource[];
  normal: { strength: number; convention: 'opengl' | 'directx' };
  export: { size: number; depth: 8 | 16; maps: 'both' | 'height' | 'normal'; background: 'white' | 'transparent' };
};
export const materialId = () => crypto.randomUUID();
export const copyMaterial = (p: MaterialProject) => structuredClone(p);
export const heightLayer = (kind: Generator = 'noise', patch: Partial<HeightLayer> = {}): HeightLayer => ({
  id: materialId(), name: generators[kind], visible: true, locked: false, kind,
  seed: 74291, scale: 6, octaves: 4, detail: 0.52, warp: 0.25,
  direction: 'horizontal', contrast: 1.35, bias: 0, invert: false, opacity: 1,
  blend: 'replace', sourceId: '', tileSource: true, ...patch,
});
export const materialPresets = [
  { id: 'paper', name: '01 纸张颗粒', subtitle: '浅色底 · 柔和纸感', layers: () => [
    heightLayer('noise', { name: '纸面起伏', scale: 32, octaves: 5, detail: 0.72, contrast: 0.35, bias: 0.35, warp: 0.1 }),
  ] },
  { id: 'grain', name: '02 颗粒斑点', subtitle: '黑色微粒 · 随机散布', layers: () => [
    heightLayer('spots', { name: '随机颗粒', scale: 55, detail: 0.4, contrast: 1, warp: 0.2 }),
  ] },
  { id: 'grunge', name: '03 斑驳', subtitle: '粗糙块面 · 明暗层次', layers: () => [
    heightLayer('noise', { name: '斑驳分布', scale: 8, octaves: 5, contrast: 2.6, bias: 0.1, warp: 0.75 }),
  ] },
  { id: 'stone', name: '04 岩石', subtitle: '粗糙脊线 · 细颗粒', layers: () => [
    heightLayer('ridged', { name: '岩石起伏', scale: 5, warp: 0.55, contrast: 1.4 }),
    heightLayer('noise', { name: '表面微粒', scale: 36, octaves: 3, opacity: 0.16, blend: 'add', warp: 0.1, seed: 991 }),
  ] },
  { id: 'concrete', name: '05 混凝土', subtitle: '柔和起伏 · 致密细节', layers: () => [
    heightLayer('noise', { scale: 9, octaves: 5, detail: 0.65, contrast: 1.8, warp: 0.15 }),
    heightLayer('cells', { name: '细小凹坑', scale: 35, opacity: 0.22, blend: 'add', invert: true, seed: 310 }),
  ] },
  { id: 'cracks', name: '06 干裂表面', subtitle: '细胞裂缝 · 表面噪声', layers: () => [
    heightLayer('cracks', { scale: 9, detail: 0.45, warp: 0.25, contrast: 1 }),
    heightLayer('noise', { name: '细节起伏', scale: 30, opacity: 0.12, blend: 'add', seed: 928 }),
  ] },
  { id: 'cells', name: '07 细胞', subtitle: '圆润凸起 · 周期分布', layers: () => [heightLayer('cells', { scale: 9, warp: 0.15, contrast: 1.2 })] },
  { id: 'fibers', name: '08 纤维', subtitle: '方向纹路 · 轻微扰动', layers: () => [heightLayer('fibers', { scale: 24, warp: 0.45, contrast: 1.2 })] },
  { id: 'woven', name: '09 编织', subtitle: '经纬交错 · 细密织物', layers: () => [heightLayer('woven', { scale: 14, warp: 0.04, contrast: 1.1 })] },
  { id: 'waves', name: '10 波纹', subtitle: '连续波峰 · 柔和流线', layers: () => [heightLayer('waves', { scale: 7, warp: 0.4, contrast: 1.2 })] },
] as const;
export function newMaterial(preset: string = 'paper'): MaterialProject {
  const entry = materialPresets.find(p => p.id === preset) ?? materialPresets[0];
  return {
    kind: 'surface-material', version: 1, name: `${entry.name.slice(3)}纹理`,
    layers: entry.layers(), sources: [], normal: { strength: 0.65, convention: 'opengl' },
    export: { size: 2048, depth: 8, maps: 'height', background: 'white' },
  };
}
export const isSeamless = (p: MaterialProject) => p.layers.filter(l => l.visible && l.opacity > 0).every(l => l.kind !== 'image' || l.tileSource);
export function parseMaterial(text: string): MaterialProject {
  if (text.length > 25_000_000) throw new Error('项目超过 25 MB。');
  const p = JSON.parse(text) as MaterialProject;
  const object = (v: unknown) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('项目结构无效'); };
  const num = (v: number, min: number, max: number, integer = false) => {
    if (!Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) throw new Error('项目参数超出范围');
  };
  const choice = (v: string, options: readonly string[]) => { if (!options.includes(v)) throw new Error('项目参数类型不支持'); };
  const str = (v: string, max = 200) => { if (typeof v !== 'string' || v.length > max) throw new Error('项目文本无效'); };
  const bool = (v: boolean) => { if (typeof v !== 'boolean') throw new Error('项目开关无效'); };
  object(p);
  if (p.kind !== 'surface-material' || p.version !== 1) throw new Error('不是受支持的材质项目');
  str(p.name, 80);
  if (!Array.isArray(p.layers) || p.layers.length > 8 || !Array.isArray(p.sources) || p.sources.length > 4) throw new Error('最多 8 个高度层、4 个导入源');
  const ids = new Set<string>();
  const id = (v: string) => { if (typeof v !== 'string' || !/^[\w-]{1,100}$/.test(v) || ids.has(v)) throw new Error('项目 ID 无效或重复'); ids.add(v); };
  for (const s of p.sources) {
    object(s); id(s.id); str(s.name); num(s.width, 1, 8192, true); num(s.height, 1, 8192, true);
    choice(s.mime, ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']); str(s.original, 8_000_000);
    if (s.mime === 'image/svg+xml') {
      if (!s.original.trim().startsWith('<')) throw new Error('SVG 源无效');
    } else if (!new RegExp(`^data:${s.mime};base64,[A-Za-z0-9+/=]+$`).test(s.original)) throw new Error('仅支持内嵌的本地图像');
  }
  for (const l of p.layers) {
    object(l); id(l.id); str(l.name); choice(l.kind, Object.keys(generators));
    bool(l.visible); bool(l.locked); bool(l.invert); bool(l.tileSource);
    num(l.seed, 0, 2 ** 32 - 1, true); num(l.scale, 1, 64, true); num(l.octaves, 1, 6, true);
    num(l.detail, 0, 1); num(l.warp, 0, 1); num(l.contrast, 0, 4); num(l.bias, -1, 1); num(l.opacity, 0, 1);
    choice(l.direction, ['horizontal', 'vertical', 'diagonal']); choice(l.blend, ['replace', 'add', 'multiply', 'max']);
    str(l.sourceId, 100);
    if (l.kind === 'image' && !p.sources.some(s => s.id === l.sourceId)) throw new Error('图层引用的灰度源不存在');
  }
  object(p.normal); num(p.normal.strength, 0, 2); choice(p.normal.convention, ['opengl', 'directx']);
  object(p.export); num(p.export.size, 128, 4096, true);
  if (![128, 256, 512, 1024, 2048, 4096].includes(p.export.size)) throw new Error('导出尺寸不支持');
  if (![8, 16].includes(p.export.depth)) throw new Error('高度位深不支持');
  choice(p.export.maps, ['both', 'height', 'normal']);
  choice(p.export.background, ['white', 'transparent']);
  return p;
}
