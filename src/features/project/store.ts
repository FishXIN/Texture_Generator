import { create } from 'zustand';
import { clone, newLayer, newProject, uid } from './model';
import type { Layer, Project, RandomPart } from './model';

type StudioStore = {
  project: Project; past: Project[]; future: Project[]; selectedLayer: string;
  selectedObject: string | null; notice: string; revision: number;
  edit: (mutate: (project: Project) => void, group?: string) => void;
  replace: (project: Project) => void; undo: () => void; redo: () => void;
  selectLayer: (id: string) => void; selectObject: (id: string | null) => void;
  message: (notice: string) => void; updateLayer: (patch: Partial<Layer>, group?: string) => void;
  addLayer: () => void; randomize: (part?: RandomPart) => void;
};
let lastGroup = '';
let lastEdit = 0;
const initial = newProject();
export const useProjectStore = create<StudioStore>((set, get) => ({
  project: initial, past: [], future: [], selectedLayer: initial.layers[0].id,
  selectedObject: null, notice: '所有素材与导出均在本机处理', revision: 0,
  edit: (mutate, group = '') => {
    const current = get(); const next = clone(current.project); mutate(next);
    if (JSON.stringify(next) === JSON.stringify(current.project)) return;
    const now = Date.now(); const coalesce = !!group && group === lastGroup && now - lastEdit < 700;
    lastGroup = group; lastEdit = now;
    set({ project: next, past: coalesce ? current.past : [...current.past.slice(-39), current.project],
      future: [], revision: current.revision + 1 });
  },
  replace: project => {
    lastGroup = '';
    set(state => ({ project, past: [...state.past.slice(-39), state.project], future: [],
      selectedLayer: project.layers[project.layers.length - 1]?.id ?? '', selectedObject: null,
      revision: state.revision + 1 }));
  },
  undo: () => {
    const state = get(); const project = state.past.at(-1); if (!project) return;
    lastGroup = '';
    set({ project, past: state.past.slice(0, -1), future: [state.project, ...state.future],
      selectedObject: null, selectedLayer: project.layers.some(l => l.id === state.selectedLayer)
        ? state.selectedLayer : project.layers.at(-1)?.id ?? '', revision: state.revision + 1 });
  },
  redo: () => {
    const state = get(); const project = state.future[0]; if (!project) return;
    lastGroup = '';
    set({ project, past: [...state.past, state.project], future: state.future.slice(1),
      selectedLayer: project.layers.some(l => l.id === state.selectedLayer) ? state.selectedLayer : project.layers.at(-1)?.id ?? '',
      selectedObject: null, revision: state.revision + 1 });
  },
  selectLayer: selectedLayer => set({ selectedLayer, selectedObject: null }),
  selectObject: selectedObject => set(state => ({ selectedObject,
    selectedLayer: state.project.objects.find(o => o.id === selectedObject)?.layerId ?? state.selectedLayer })),
  message: notice => set({ notice }),
  updateLayer: (patch, group) => {
    const id = get().selectedLayer;
    get().edit(project => {
      const layer = project.layers.find(l => l.id === id);
      if (layer && (!layer.locked || Object.keys(patch).every(k => k === 'locked' || k === 'visible'))) Object.assign(layer, patch);
    }, group);
  },
  addLayer: () => {
    const layer = newLayer(`${String(get().project.layers.length + 1).padStart(2,'0')} 图形颗粒`);
    layer.count=Math.min(layer.count,Math.max(0,20000-get().project.layers.reduce((sum,l)=>sum+l.count,0)));
    if (get().project.layers.length >= 16) { get().message('最多 16 个图层，请先合并或删除图层。'); return; }
    get().edit(project => { project.layers.push(layer); }); set({ selectedLayer: layer.id, selectedObject: null });
  },
  randomize: part => {
    const id = get().selectedLayer;
    get().edit(project => {
      const layer = project.layers.find(l => l.id === id); if (!layer || layer.locked) return;
      for (const key of (part ? [part] : ['position', 'size', 'rotation', 'color']) as RandomPart[]) {
        if (!layer.locks[key]) layer.seeds[key] = crypto.getRandomValues(new Uint32Array(1))[0];
      }
    });
    get().message('已更新未锁定的随机参数，手工图形保持原位');
  },
}));

export function duplicateLayer(id: string) {
  const state = useProjectStore.getState(); const source = state.project.layers.find(l => l.id === id);
  if (!source || state.project.layers.length >= 16) return;
  if (state.project.layers.reduce((sum,l)=>sum+l.count,0)+source.count>20000 ||
    state.project.objects.length+state.project.objects.filter(o=>o.layerId===id).length>2000) {
    state.message('复制后会超过 20,000 颗粒或 2,000 手工图形，请先降低密度。');return;
  }
  const layer = clone(source); layer.id = uid(); layer.name += ' 副本'; layer.locked = false;
  state.edit(p => {
    p.layers.splice(p.layers.findIndex(l => l.id === id) + 1, 0, layer);
    p.objects.push(...p.objects.filter(o => o.layerId === id).map(o => ({ ...o, id: uid(), layerId: layer.id })));
  });
  useProjectStore.setState({ selectedLayer: layer.id, selectedObject: null });
}
