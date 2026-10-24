import type { LoadedAsset } from '@/features/assets/types';
import type { PlacedItem } from '@/features/texture/types';
import { sanitizeSvg, assetSvg } from '@/features/assets/svg';

type ExportSvgArgs = {
  baseAsset: LoadedAsset;
  elementsById: Map<string, LoadedAsset>;
  placements: PlacedItem[];
};

export function exportSvgString({ baseAsset, elementsById, placements }: ExportSvgArgs) {
  if (baseAsset.sourceType !== 'svg' || !baseAsset.rawText) {
    throw new Error('SVG export requires all imported assets to be SVG.');
  }

  const backgroundNode = buildSvgFragment(baseAsset, {
    x: 0,
    y: 0,
    width: baseAsset.width,
    height: baseAsset.height,
  },'legacy_background');

  const elementNodes = placements
    .map((item,index) => {
      const element = elementsById.get(item.elementId);
      if (!element || element.sourceType !== 'svg' || !element.rawText) {
        throw new Error('SVG export requires all imported assets to be SVG.');
      }
      const nestedSvg = buildSvgFragment(element, {
        x: -item.width / 2,
        y: -item.height / 2,
        width: item.width,
        height: item.height,
      },`legacy_object_${index}`);
      return `<g transform="translate(${item.x.toFixed(2)} ${item.y.toFixed(2)}) rotate(${item.rotation.toFixed(2)})">${nestedSvg}</g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${baseAsset.width}" height="${baseAsset.height}" viewBox="0 0 ${baseAsset.width} ${baseAsset.height}">${backgroundNode}${elementNodes}</svg>`;
}

function buildSvgFragment(
  asset: LoadedAsset,
  placement: { x: number; y: number; width: number; height: number },
  prefix: string,
) {
  const cleaned=sanitizeSvg(asset.rawText??'',asset.name);
  if(cleaned.issues.length)throw new Error(`${asset.name}：${cleaned.issues.join('；')}。请在纹理工作台检查并使用效果保留出口。`);
  const documentNode = new DOMParser().parseFromString(assetSvg(cleaned,prefix), 'image/svg+xml');
  const svgElement = documentNode.documentElement;

  if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg') {
    throw new Error(`Invalid SVG asset: ${asset.name}`);
  }

  for(const [key,value] of Object.entries(placement))svgElement.setAttribute(key,value.toFixed(2));
  svgElement.setAttribute('overflow','visible');
  return new XMLSerializer().serializeToString(svgElement);
}
