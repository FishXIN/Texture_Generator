import { create } from 'zustand';
import { loadAssetFromFile } from './loader';
import type { LoadedAsset } from './types';

type AssetsState = {
  baseAsset: LoadedAsset | null;
  elements: LoadedAsset[];
  isLoading: boolean;
  setBaseImage: (file: File) => Promise<void>;
  clearBaseImage: () => void;
  addElements: (files: File[]) => Promise<void>;
  removeElement: (id: string) => void;
};

export const useAssetsStore = create<AssetsState>((set, get) => ({
  baseAsset: null,
  elements: [],
  isLoading: false,
  async setBaseImage(file) {
    set({ isLoading: true });
    try {
      const nextAsset = await loadAssetFromFile(file);
      get().baseAsset?.bitmap.close();
      set({ baseAsset: nextAsset });
    } finally {
      set({ isLoading: false });
    }
  },
  clearBaseImage() {
    get().baseAsset?.bitmap.close();
    set({ baseAsset: null });
  },
  async addElements(files) {
    set({ isLoading: true });
    try {
      const loaded = await Promise.all(files.map((file) => loadAssetFromFile(file)));
      set((state) => ({ elements: [...state.elements, ...loaded] }));
    } finally {
      set({ isLoading: false });
    }
  },
  removeElement(id) {
    const target = get().elements.find((item) => item.id === id);
    target?.bitmap.close();
    set((state) => ({ elements: state.elements.filter((item) => item.id !== id) }));
  },
}));
