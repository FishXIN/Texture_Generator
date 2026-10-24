import { create } from 'zustand';
import type { Params } from './types';

export const defaultParams: Params = {
  density: 260,
  baseSize: 0.35,
  spacing: 0,
  edgeMargin: 0,
  sizeRandomness: 0.3,
  baseAngle: 0,
  rotationRandomness: 25,
  rotationFullRandom: false,
  seed: 20260501,
};

type ParamsState = {
  params: Params;
  setParam: <K extends keyof Params>(key: K, value: Params[K]) => void;
  reshuffle: () => void;
  reset: () => void;
};

export const useParamsStore = create<ParamsState>((set) => ({
  params: defaultParams,
  setParam(key, value) {
    set((state) => ({ params: { ...state.params, [key]: value } }));
  },
  reshuffle() {
    set((state) => ({
      params: {
        ...state.params,
        seed: Math.floor(Math.random() * 2147483647),
      },
    }));
  },
  reset() {
    set({ params: defaultParams });
  },
}));
