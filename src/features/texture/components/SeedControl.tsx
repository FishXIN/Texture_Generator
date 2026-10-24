import { Shuffle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

type SeedControlProps = {
  seed: number;
  onSeedChange: (value: number) => void;
  onReshuffle: () => void;
};

export function SeedControl({ seed, onSeedChange, onReshuffle }: SeedControlProps) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-ui-sm font-medium">随机种子</div>
          <div className="mt-1 text-ui-xs text-muted-foreground">固定种子可复现当前布局，重排会自动生成新种子。</div>
        </div>
        <Button variant="secondary" onClick={onReshuffle}>
          <Shuffle className="h-4 w-4" />
          重排
        </Button>
      </div>
      <Input
        className="mt-3"
        type="number"
        value={seed}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onSeedChange(Number.isFinite(nextValue) ? nextValue : 0);
        }}
      />
    </div>
  );
}
