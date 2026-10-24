import { decodeSource } from './import';
import type { MaterialProject } from './model';
import type { MaterialMaps } from './engine';

type Output = { blob: Blob; filename: string; extension: string };
export function materialTask<T extends MaterialMaps | Output>(project: MaterialProject, size: number, exporting = false, progress?: (v: number) => void) {
  let worker: Worker | null = null, canceled = false, settled = false;
  let rejectTask: (reason: Error) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    rejectTask = reject;
    Promise.all(project.sources.map(decodeSource)).then(sources => {
      if (canceled) return;
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const finish = () => { settled = true; worker?.terminate(); worker = null; };
      worker.onmessage = event => {
        if (event.data.type === 'progress') progress?.(event.data.progress);
        else if (event.data.type === 'error') { finish(); reject(new Error(event.data.message)); }
        else { finish(); resolve((event.data.maps ?? event.data.output) as T); }
      };
      worker.onerror = event => { finish(); reject(new Error(event.message || '生成进程失败，请降低分辨率后重试')); };
      worker.postMessage({ project, size, sources, exporting });
    }).catch(e => { if (!settled && !canceled) { settled = true; reject(e); } });
  });
  return { promise, cancel: () => {
    if (settled || canceled) return; canceled = true; worker?.terminate(); worker = null;
    rejectTask(new DOMException('已取消生成', 'AbortError'));
  } };
}
