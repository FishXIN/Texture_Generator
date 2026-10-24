import { renderMaterial } from './engine';
import { exportMaterial } from './export';
import type { MaterialProject } from './model';
import type { DecodedSource } from './engine';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async event => {
  const { project, size, sources, exporting } = event.data as { project: MaterialProject; size: number; sources: DecodedSource[]; exporting: boolean };
  try {
    const maps = renderMaterial(project, size, sources, progress => scope.postMessage({ type: 'progress', progress: progress * (exporting ? 0.8 : 1) }));
    if (exporting) {
      const output = await exportMaterial(project, maps, progress => scope.postMessage({ type: 'progress', progress: 0.8 + progress * 0.2 }));
      scope.postMessage({ type: 'export', output });
    } else scope.postMessage({ type: 'maps', maps }, [maps.height.buffer, maps.normal.buffer]);
  } catch (e) { scope.postMessage({ type: 'error', message: e instanceof Error ? e.message : '生成失败' }); }
};
