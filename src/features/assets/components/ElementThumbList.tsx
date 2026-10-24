import { Trash2 } from 'lucide-react';
import type { LoadedAsset } from '@/features/assets/types';
import { Button } from '@/shared/ui/button';

type ElementThumbListProps = {
  elements: LoadedAsset[];
  onRemove: (id: string, name: string) => void;
};

export function ElementThumbList({ elements, onRemove }: ElementThumbListProps) {
  if (!elements.length) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-5 text-center text-ui-xs text-muted-foreground">
        还没有元素素材，导入后会在这里显示缩略图。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {elements.map((item) => (
        <div key={item.id} className="group rounded-2xl border border-border bg-muted/40 p-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-card">
            <img src={item.dataUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-ui-sm font-medium">{item.name}</div>
              <div className="text-ui-xs text-muted-foreground">{item.width} x {item.height}</div>
            </div>
            <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => onRemove(item.id, item.name)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
