import type { Asset } from '@/features/project/model';
import { uid } from '@/features/project/model';

const allowed = new Set(('svg g defs symbol use path rect circle ellipse line polyline polygon ' +
  'linearGradient radialGradient stop clipPath mask pattern image text tspan style title desc filter ' +
  'feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap ' +
  'feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode ' +
  'feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence').toLowerCase().split(' '));
const rasterData = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i;
const safeReference = (value: string) => value.trim().startsWith('#') || rasterData.test(value.trim());
const unsafeCss = (value: string) => /@import|@font-face|expression\s*\(|javascript:|behavior\s*:|-moz-binding|\\/.test(value) ||
  [...value.matchAll(/url\s*\(([^)]*)\)/gi)].some(match => !/^['"]?#[\w:.-]+['"]?$/.test(match[1].trim()));
export function sanitizeSvg(original: string, name: string, id: string = uid()): Asset {
  if (original.length > 5_000_000) throw new Error('SVG 超过 5 MB，请简化后再导入。');
  if (/<!DOCTYPE|<!ENTITY/i.test(original)) throw new Error('SVG 含不支持的文档实体，请先从设计软件重新导出。');
  const doc = new DOMParser().parseFromString(original, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.localName !== 'svg') throw new Error(`${name} 不是有效 SVG。`);
  const issues = new Set<string>(); let pure = true;
  const nodes = [...root.querySelectorAll('*')];
  if (nodes.length > 20000) throw new Error('SVG 超过 20,000 个节点，请先简化素材。');
  for (const element of [root, ...nodes]) {
    const tag = element.localName.toLowerCase();
    if (!allowed.has(tag)) {
      issues.add(`已移除不支持或可执行元素：${element.localName}`); element.remove(); continue;
    }
    for (const attribute of [...element.attributes]) {
      const key = attribute.localName.toLowerCase(); const value = attribute.value;
      if (key.startsWith('on') || key === 'tabindex' || key === 'xml:base' || key === 'base' ||
          (key === 'href' && !safeReference(value)) ||
          ((key === 'style' || /url\s*\(/i.test(value)) && unsafeCss(value))) {
        element.removeAttributeNode(attribute); issues.add(`已移除不安全引用或属性：${attribute.name}`);
      }
    }
    if (tag === 'image' || tag === 'feimage') { issues.add('包含内嵌位图，不能作为纯矢量导出'); pure = false; }
    if (tag === 'filter' || element.hasAttribute('filter')) { issues.add('包含 SVG 滤镜，需使用效果保留模式'); pure = false; }
    if (tag === 'text' || tag === 'tspan') { issues.add('包含依赖本机字体的文字，建议先转轮廓'); pure = false; }
    if (element.hasAttribute('style') && /filter\s*:|font-family\s*:|mix-blend-mode\s*:/i.test(element.getAttribute('style')!)) {
      issues.add('包含字体、滤镜或混合样式，需检查目标软件兼容性'); pure = false;
    }
  }
  // Inline supported stylesheet rules using CSS specificity, source order and !important.
  // Stylesheets never remain in the exported document, so selectors cannot affect another asset.
  const cascade = new Map<Element, Map<string, {value:string;important:boolean;rank:number;order:number}>>();
  let order = 0;
  for (const element of [...root.querySelectorAll('style')]) {
    const css=element.textContent??'';
    if (unsafeCss(css) || /@/.test(css)) { issues.add('已移除含外部资源或不支持规则的样式表'); element.remove(); continue; }
    const sheet=new CSSStyleSheet(); sheet.replaceSync(css);
    if (css.trim() && !sheet.cssRules.length) { issues.add('SVG 样式表未能解析，请检查素材');pure=false; }
    for (const rule of [...sheet.cssRules]) {
      if (!(rule instanceof CSSStyleRule)) { issues.add('已移除不支持的 SVG 样式规则'); pure=false; continue; }
      for (const selector of rule.selectorText.split(',')) {
        const text=selector.trim();
        if (!/^(?:[a-zA-Z][\w-]*|\*)?(?:[.#][\w-]+)*(?:\s*(?:>|\s)\s*(?:[a-zA-Z][\w-]*|\*)?(?:[.#][\w-]+)*)*$/.test(text) || !text) {
          issues.add(`不支持的 SVG 样式选择器：${text}`); pure=false; continue;
        }
        const rank=(text.match(/#/g)?.length??0)*10000+(text.match(/\./g)?.length??0)*100+
          (text.match(/(?:^|[\s>])[a-zA-Z][\w-]*/g)?.length??0);
        const targets=[...(root.matches(text)?[root]:[]),...root.querySelectorAll(text)];
        for (const target of targets) {
          const values=cascade.get(target)??new Map();
          for (const key of [...rule.style]) {
            const candidate={value:rule.style.getPropertyValue(key),important:rule.style.getPropertyPriority(key)==='important',rank,order};
            const old=values.get(key);
            if (!old || (candidate.important!==old.important ? candidate.important : candidate.rank>old.rank || candidate.rank===old.rank&&candidate.order>=old.order)) values.set(key,candidate);
          }
          cascade.set(target,values);
        }
        order++;
      }
    }
    element.remove();
  }
  for (const [element,values] of cascade) {
    const inline=document.createElement('span').style;inline.cssText=element.getAttribute('style')??'';
    for (const key of [...inline]) {
      const important=inline.getPropertyPriority(key)==='important';const old=values.get(key);
      if (!old?.important || important) values.set(key,{value:inline.getPropertyValue(key),important,rank:1000000,order});
    }
    element.setAttribute('style',[...values].map(([key,v])=>`${key}:${v.value}${v.important?' !important':''}`).join(';'));
  }
  for (const element of [root,...root.querySelectorAll('*')]) {
    if (/filter\s*:|font-family\s*:|mix-blend-mode\s*:/i.test(element.getAttribute('style')??'')) {
      issues.add('包含字体、滤镜或混合样式，需检查目标软件兼容性');pure=false;
    }
  }
  const uniqueIds=new Set<string>();
  for (const element of [root,...root.querySelectorAll('[id]')]) {
    if (!element.id) continue;
    if (uniqueIds.has(element.id)) throw new Error('SVG 含重复图形 ID，请重新导出素材。');
    uniqueIds.add(element.id);
  }
  const box = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const w = parseFloat(root.getAttribute('width') ?? ''); const h = parseFloat(root.getAttribute('height') ?? '');
  const width = box.length === 4 && box[2] > 0 ? box[2] : Number.isFinite(w) && w > 0 ? w : 100;
  const height = box.length === 4 && box[3] > 0 ? box[3] : Number.isFinite(h) && h > 0 ? h : 100;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width > 100000 || height > 100000) throw new Error('SVG 尺寸无效。');
  if (Math.max(width,height)/Math.min(width,height)>512) throw new Error('SVG 长宽比超过 512:1，请调整画板边界后导入。');
  if (box.length !== 4 || !box.every(Number.isFinite)) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('width', `${width}`); root.setAttribute('height', `${height}`);
  return { id, name, original, svg: new XMLSerializer().serializeToString(root), width, height, issues: [...issues], pure };
}

export function assetSvg(asset: Asset, prefix: string, color = ''): string {
  const doc = new DOMParser().parseFromString(asset.svg, 'image/svg+xml'); const root = doc.documentElement;
  const ids = new Map<string, string>();
  for (const node of [root, ...root.querySelectorAll('[id]')]) {
    if (node.id) { ids.set(node.id, `${prefix}_${node.id}`); node.id = `${prefix}_${node.id}`; }
  }
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...element.attributes]) {
      let value = attr.value;
      if (attr.localName === 'href' && value.startsWith('#')) value = `#${ids.get(value.slice(1)) ?? `${prefix}_${value.slice(1)}`}`;
      value = value.replace(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g, (_, id) => `url(#${ids.get(id) ?? `${prefix}_${id}`})`);
      if (color && ['fill', 'stroke', 'stop-color', 'color'].includes(attr.localName) && value !== 'none' && !/url\s*\(/i.test(value)) value = color;
      if (color && attr.localName === 'style') value = value.replace(/(^|;)\s*(fill|stroke|stop-color|color)\s*:\s*([^;]+)/g,
        (all, separator, key, v) => v.trim() === 'none' || /url\s*\(/i.test(v) ? all : `${separator}${key}:${color}`);
      element.setAttributeNS(attr.namespaceURI, attr.name, value);
    }
    if(color && element.localName==='stop' && !element.hasAttribute('stop-color'))element.setAttribute('stop-color',color);
  }
  if (color) { if (!root.hasAttribute('fill')) root.setAttribute('fill', color); root.setAttribute('color', color); }
  return new XMLSerializer().serializeToString(root);
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function assetImage(asset: Asset, color = '', resolution = 256) {
  const size=Math.min(4096,Math.max(32,2**Math.ceil(Math.log2(resolution))));
  const key = asset.svg + color + size;
  let result = imageCache.get(key);
  if (!result) {
    result = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`无法渲染 ${asset.name}，请检查 SVG 内容。`));
      const doc=new DOMParser().parseFromString(assetSvg(asset,'preview',color),'image/svg+xml');
      const longest=Math.max(asset.width,asset.height);
      doc.documentElement.setAttribute('width',`${Math.max(1,size*asset.width/longest)}`);
      doc.documentElement.setAttribute('height',`${Math.max(1,size*asset.height/longest)}`);
      image.src = svgDataUrl(new XMLSerializer().serializeToString(doc));
    });
    imageCache.set(key, result);
    result.catch(() => imageCache.delete(key));
    if (imageCache.size > 512) imageCache.delete(imageCache.keys().next().value!);
  }
  return result;
}
export async function importSvg(file: File) {
  if (!file.name.toLowerCase().endsWith('.svg')) throw new Error('首版自定义图形支持 SVG，请先转为 SVG。');
  if (file.size > 5_000_000) throw new Error('SVG 超过 5 MB，请先简化。');
  const asset = sanitizeSvg(await file.text(), file.name); await assetImage(asset); return asset;
}
