import { MoonStar, SunMedium } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { ThemeMode } from './store';

type ThemeToggleProps = {
  theme: ThemeMode;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <Button variant="secondary" onClick={onToggle} className="min-w-[104px] justify-center">
      {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
    </Button>
  );
}
