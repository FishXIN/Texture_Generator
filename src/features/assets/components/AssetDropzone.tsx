import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/cn';

type AssetDropzoneProps = {
  title: string;
  description: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
};

export function AssetDropzone({
  title,
  description,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
}: AssetDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const emitFiles = async (list: FileList | null) => {
    if (!list || disabled) return;
    await onFiles(Array.from(list));
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-border bg-muted/40 p-4 transition',
        isDragging && 'border-primary bg-accent',
        disabled && 'pointer-events-none opacity-60',
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setIsDragging(false);
        await emitFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={async (event) => {
          const input = event.currentTarget;
          await emitFiles(input.files);
          input.value = '';
        }}
      />
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-card p-2 text-primary shadow-sm shadow-black/5">
          <UploadCloud className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ui-sm font-medium">{title}</div>
          <p className="mt-1 text-ui-xs leading-5 text-muted-foreground">{description}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled}>
              选择文件
            </Button>
            <Button variant="ghost" onClick={() => inputRef.current?.click()} disabled={disabled}>
              拖拽到这里
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
