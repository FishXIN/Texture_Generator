import { ImagePlus, Trash2 } from 'lucide-react';
import type { LoadedAsset } from '@/features/assets/types';
import { AssetDropzone } from './AssetDropzone';
import { Button } from '@/shared/ui/button';

type BaseImageUploaderProps = {
  baseAsset: LoadedAsset | null;
  disabled?: boolean;
  onUpload: (files: File[]) => void | Promise<void>;
  onClear: () => void;
};

export function BaseImageUploader({ baseAsset, disabled, onUpload, onClear }: BaseImageUploaderProps) {
  return (
    <div className="space-y-3">
      <AssetDropzone
        title="底图"
        description="支持 PNG / JPEG / WEBP / SVG，作为整张纹理的基础画布。"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        disabled={disabled}
        onFiles={onUpload}
      />
      {baseAsset ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-3 text-ui-sm">
          <div className="flex min-w-0 items-center gap-2">
            <ImagePlus className="h-4 w-4 text-primary" />
            <div className="min-w-0">
              <div className="truncate font-medium">{baseAsset.name}</div>
              <div className="text-ui-xs text-muted-foreground">{baseAsset.width} x {baseAsset.height}</div>
            </div>
          </div>
          <Button variant="ghost" onClick={onClear}>
            <Trash2 className="h-4 w-4" />
            清空
          </Button>
        </div>
      ) : null}
    </div>
  );
}
