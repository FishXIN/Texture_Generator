import { newProject, newLayer } from './model';
import type { Project } from './model';
import { sanitizeSvg } from '@/features/assets/svg';

function checkShape(value: unknown, template: unknown, path: string): void {
  if (typeof template === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 2 ** 32) throw new Error(`${path} 数值无效`);
  } else if (typeof template === 'string') {
    if (typeof value !== 'string' || value.length > 5_000_000) throw new Error(`${path} 文本无效`);
  } else if (typeof template === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${path} 开关无效`);
  } else if (Array.isArray(template)) {
    if (!Array.isArray(value)) throw new Error(`${path} 列表无效`);
  } else {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} 结构无效`);
    for (const [key, field] of Object.entries(template as object)) checkShape((value as Record<string, unknown>)[key], field, `${path}.${key}`);
  }
}
function range(value: number, min: number, max: number, field: string, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`${field} 超出范围 ${min}–${max}`);
}
function oneOf(value: string, values: string[], field: string) {
  if (!values.includes(value)) throw new Error(`${field} 类型不支持`);
}
const color = (value: string) => { if (!/^#[a-f\d]{6}$/i.test(value)) throw new Error('颜色必须为六位 HEX'); };
export function parseProject(text: string): Project {
  if (text.length > 25_000_000) throw new Error('项目超过 25 MB，请减少素材后再保存。');
  const p = JSON.parse(text) as Project;
  checkShape(p, newProject(), '项目');
  if (p.version !== 1) throw new Error('项目版本不支持');
  range(p.canvas.width, 64, 4096, '画布宽度', true); range(p.canvas.height, 64, 4096, '画布高度', true);
  if (p.layers.length > 16 || p.assets.length > 32 || p.objects.length > 2000) throw new Error('项目超出图层、素材或手工对象数量限制');
  color(p.background.color); range(p.animation.duration, 1, 30, '循环时长');
  const ids = new Set<string>();
  const id = (value: string) => {
    if (!/^[\w-]{1,100}$/.test(value) || ids.has(value)) throw new Error('对象 ID 无效或重复');
    ids.add(value);
  };
  p.assets = p.assets.map(a => {
    if (!a || typeof a.original !== 'string' || typeof a.name !== 'string' || typeof a.id !== 'string') throw new Error('素材数据无效');
    id(a.id); return sanitizeSvg(a.original, a.name.slice(0, 200), a.id);
  });
  const assetIds = new Set(p.assets.map(a => a.id));
  for (const l of p.layers) {
    checkShape(l, newLayer(), '图层'); id(l.id); color(l.color);
    oneOf(l.shape, ['circle','ellipse','line','chip','custom'], '图形');
    oneOf(l.blend, ['normal','multiply','screen','overlay','color-burn'], '混合');
    oneOf(l.distribution, ['random','grid','stagger','cluster'], '排列');
    range(l.count, 0, 5000, '密度', true); range(l.minSize, 0.2, 512, '最小尺寸'); range(l.maxSize, l.minSize, 512, '最大尺寸');
    range(l.opacity, 0, 1, '透明度'); range(l.spacing, 0, 100, '间距');
    range(l.rotation, -360, 360, '角度'); range(l.rotationRange, 0, 180, '随机旋转');
    range(l.cluster, 0, 1, '聚集'); range(l.gradient, -1, 1, '渐变'); range(l.jitter, 0, 1, '扰动'); range(l.direction, -360, 360, '方向');
    for (const seed of Object.values(l.seeds)) range(seed, 0, 2 ** 32 - 1, '种子', true);
    if (l.assets.length > 32) throw new Error('素材比例过多');
    for (const a of l.assets) { checkShape(a, { id: '', weight: 1 }, '比例'); if (!assetIds.has(a.id)) throw new Error('图层引用的素材不存在'); range(a.weight, 0, 100, '素材比例'); }
    oneOf(l.mask.kind, ['rect','ellipse','svg'], '蒙版'); oneOf(l.mask.mode, ['inside','outside'], '蒙版范围');
    range(l.mask.x, -8192, 8192, '蒙版位置'); range(l.mask.y, -8192, 8192, '蒙版位置');
    range(l.mask.width, 1, 8192, '蒙版宽度'); range(l.mask.height, 1, 8192, '蒙版高度');
    if (l.mask.kind === 'svg' && l.mask.enabled && !assetIds.has(l.mask.assetId)) throw new Error('SVG 蒙版素材不存在');
    oneOf(l.motion.kind, ['drift','wander','flow','rotate','breathe'], '运动');
    range(l.motion.amplitude, 0, 256, '运动幅度'); range(l.motion.direction, -360, 360, '运动方向'); range(l.motion.cycles, 1, 10, '循环次数', true);
  }
  if (p.layers.reduce((sum, l) => sum + l.count, 0) > 20000) throw new Error('总颗粒数超过 20,000');
  const layerIds = new Set(p.layers.map(l => l.id));
  for (const o of p.objects) {
    checkShape(o, { id:'', layerId:'', assetId:'', x:0, y:0, width:1, height:1, rotation:0, opacity:1, color:'', locked:false, motionLocked:false }, '手工图形');
    id(o.id); if (!layerIds.has(o.layerId) || !assetIds.has(o.assetId)) throw new Error('手工图形引用不存在');
    range(o.x, -8192, 8192, '图形位置'); range(o.y, -8192, 8192, '图形位置');
    range(o.width, 0.2, 2048, '图形宽度'); range(o.height, 0.2, 2048, '图形高度');
    range(o.rotation, -360, 360, '图形旋转'); range(o.opacity, 0, 1, '图形透明度'); if (o.color) color(o.color);
  }
  oneOf(p.export.format, ['png','jpeg','svg','sequence'], '导出格式'); oneOf(p.export.svgMode, ['pure','effects','optimized'], 'SVG 模式');
  oneOf(p.export.region, ['canvas','unit','selection','filled'], '导出区域');
  range(p.export.scale, 0.25, 8, '导出倍率'); range(p.export.repeats, 2, 8, '铺设数量', true); range(p.export.fps, 1, 60, '帧率', true);
  range(p.export.selection.x, 0, p.canvas.width - 1, '选区位置'); range(p.export.selection.y, 0, p.canvas.height - 1, '选区位置');
  range(p.export.selection.width, 1, p.canvas.width - p.export.selection.x, '选区宽度');
  range(p.export.selection.height, 1, p.canvas.height - p.export.selection.y, '选区高度');
  return p;
}
export async function saveBlob(blob: Blob, filename: string, extension: string) {
  if (window.electron?.saveFile) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject; reader.readAsDataURL(blob);
    });
    return window.electron.saveFile({ defaultPath: filename, filters: [{ name: extension.toUpperCase(), extensions: [extension] }], data, encoding: 'base64' });
  }
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { canceled: false };
}
export const projectBlob = (p: Project) => {
  const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});
  if(blob.size>25_000_000)throw new Error('项目超过 25 MB，请减少素材后再保存。');
  return blob;
};
