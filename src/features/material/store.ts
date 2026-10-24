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
let interaction = false, interactionStarted = false;
if (typeof window !== 'undefined') {
  window.addEventListener('texture-range-start', () => { interaction = true; interactionStarted = false; lastGroup = ''; });
  window.addEventListener('texture-range-end', () => { interaction = false; interactionStarted = false; lastGroup = ''; });
}
const initial = newMaterial();
const stateKey=(p:MaterialProject)=>JSON.stringify({...p,sources:p.sources.map(s=>s.id)});
export const useMaterialStore = create<MaterialStore>((set, get) => ({
  project: initial, past: [], future: [], selected: initial.layers[0].id, revision: 0,
  notice: '',
  edit: (fn, group = '') => {
    const s = get(), p = copyMaterial(s.project); fn(p);
    if (stateKey(p) === stateKey(s.project) && p.sources.every((source,i)=>source.original===s.project.sources[i]?.original)) return;
    const coalesce = interaction ? interactionStarted : group && group === lastGroup && Date.now() - lastEdit < 700;
    if (interaction) interactionStarted = true;
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
    const s = get(),layer=s.project.layers.find(l=>l.id===s.selected);
    if (!layer||layer.locked||Object.entries(patch).every(([key,value])=>layer[key as keyof HeightLayer]===value)) return;
    s.edit(p => { const l = p.layers.find(l => l.id === s.selected); if (l) Object.assign(l, patch); }, group);
  },
  addLayer: () => {
    const s = get(); if (s.project.layers.length >= 16) { s.message('最多 16 个图层'); return; }
    const layer = heightLayer('noise', s.project.layers.length ? { opacity: 0.25, blend: 'add' } : { opacity: 1, blend: 'replace' });
    s.edit(p => { p.layers.push(layer); }); set({ selected: layer.id });
  },
  randomize: () => {
    const s = get(); const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    s.edit(p => { for (const l of p.layers) if (!l.locked) l.seed = (seed + p.layers.indexOf(l) * 7919) >>> 0; });
    s.message('已重新排列');
  },
}));
