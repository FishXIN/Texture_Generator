import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

type ThemeState = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  toggleTheme() {
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
  },
}));
