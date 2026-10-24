import { create } from 'zustand';
import { copyMaterial, heightLayer, newMaterial } from './model';
import type { HeightLayer, MaterialProject } from './model';

type MaterialStore = {
  project: MaterialProject; past: MaterialProject[]; future: MaterialProject[];
  selected: string; revision: number; notice: string;
  edit: (fn: (p: MaterialProject) => void, group?: string) => void;
  replace: (p: MaterialProject) => void; undo: () => void; redo: () => void;
  select: (id: string) => void; message: (text: string) => void;
  updateLayer: (patch: Partial<HeightLayer>, group?: string) => void;
  addLayer: () => void; randomize: () => void;
};
let lastGroup = '', lastEdit = 0;
const initial = newMaterial();
export const useMaterialStore = create<MaterialStore>((set, get) => ({
  project: initial, past: [], future: [], selected: initial.layers[0].id, revision: 0,
  notice: '本地生成 · 黑白高度与法线来自同一表面',
  edit: (fn, group = '') => {
    const s = get(), p = copyMaterial(s.project); fn(p);
    if (JSON.stringify(p) === JSON.stringify(s.project)) return;
    const coalesce = group && group === lastGroup && Date.now() - lastEdit < 700;
    lastGroup = group; lastEdit = Date.now();
    set({ project: p, past: coalesce ? s.past : [...s.past.slice(-19), s.project], future: [], revision: s.revision + 1 });
  },
  replace: p => {
    lastGroup = '';
    set(s => ({ project: p, past: [...s.past.slice(-19), s.project], future: [], selected: p.layers[0]?.id ?? '', revision: s.revision + 1 }));
  },
  undo: () => {
    const s = get(), p = s.past.at(-1); if (!p) return; lastGroup = '';
    set({ project: p, past: s.past.slice(0, -1), future: [s.project, ...s.future], selected: p.layers.some(l => l.id === s.selected) ? s.selected : p.layers[0]?.id ?? '', revision: s.revision + 1 });
  },
  redo: () => {
    const s = get(), p = s.future[0]; if (!p) return; lastGroup = '';
    set({ project: p, past: [...s.past.slice(-19), s.project], future: s.future.slice(1), selected: p.layers.some(l => l.id === s.selected) ? s.selected : p.layers[0]?.id ?? '', revision: s.revision + 1 });
  },
  select: selected => set({ selected }), message: notice => set({ notice }),
  updateLayer: (patch, group) => {
    const s = get(); if (s.project.layers.find(l => l.id === s.selected)?.locked) return;
    s.edit(p => { const l = p.layers.find(l => l.id === s.selected); if (l) Object.assign(l, patch); }, group);
  },
  addLayer: () => {
    const s = get(); if (s.project.layers.length >= 8) { s.message('最多 8 个高度图层'); return; }
    const layer = heightLayer('noise', s.project.layers.length ? { opacity: 0.25, blend: 'add' } : { opacity: 1, blend: 'replace' });
    s.edit(p => { p.layers.push(layer); }); set({ selected: layer.id });
  },
  randomize: () => {
    const s = get(); const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    s.edit(p => { for (const l of p.layers) if (!l.locked) l.seed = (seed + p.layers.indexOf(l) * 7919) >>> 0; });
    s.message('已更新未锁定图层的种子');
  },
}));
