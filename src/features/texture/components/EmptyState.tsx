import { ImagePlus, Sparkles } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30">
      <div className="max-w-md px-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-sm shadow-black/5">
          <ImagePlus className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">先导入一张底图</h2>
        <p className="mt-2 text-ui-sm leading-6 text-muted-foreground">
          上传底图后，左侧会以原始比例显示实时预览；再导入元素素材并调整密度、尺寸、角度即可生成随机纹理。
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-ui-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          支持导出 PNG / JPEG / SVG
        </div>
      </div>
    </div>
  );
}
