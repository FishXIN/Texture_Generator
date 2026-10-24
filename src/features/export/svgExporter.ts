import type { LoadedAsset } from '@/features/assets/types';
import type { PlacedItem } from '@/features/texture/types';

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
  });

  const elementNodes = placements
    .map((item) => {
      const element = elementsById.get(item.elementId);
      if (!element || element.sourceType !== 'svg' || !element.rawText) {
        throw new Error('SVG export requires all imported assets to be SVG.');
      }
      const nestedSvg = buildSvgFragment(element, {
        x: -item.width / 2,
        y: -item.height / 2,
        width: item.width,
        height: item.height,
      });
      return `<g transform="translate(${item.x.toFixed(2)} ${item.y.toFixed(2)}) rotate(${item.rotation.toFixed(2)})">${nestedSvg}</g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${baseAsset.width}" height="${baseAsset.height}" viewBox="0 0 ${baseAsset.width} ${baseAsset.height}">${backgroundNode}${elementNodes}</svg>`;
}

function buildSvgFragment(
  asset: LoadedAsset,
  placement: { x: number; y: number; width: number; height: number },
) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(asset.rawText ?? '', 'image/svg+xml');
  const svgElement = documentNode.documentElement;

  if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg') {
    throw new Error(`Invalid SVG asset: ${asset.name}`);
  }

  const serializer = new XMLSerializer();
  const innerContent = Array.from(svgElement.childNodes).map((node) => serializer.serializeToString(node)).join('');
  const viewBox = svgElement.getAttribute('viewBox') ?? `0 0 ${asset.width} ${asset.height}`;
  const preserveAspectRatio = svgElement.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet';

  return `<svg x="${placement.x.toFixed(2)}" y="${placement.y.toFixed(2)}" width="${placement.width.toFixed(2)}" height="${placement.height.toFixed(2)}" viewBox="${viewBox}" preserveAspectRatio="${preserveAspectRatio}" overflow="visible">${innerContent}</svg>`;
}
