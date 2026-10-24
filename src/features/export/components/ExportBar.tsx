import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { StudioSelect } from '@/shared/ui/StudioSelect';
import { cn } from '@/shared/lib/cn';
import { exportSvgString } from '../svgExporter';
import { renderScene } from '@/features/texture/engine/canvasRenderer';
import type { ExportFormat } from '../types';
import type { LoadedAsset } from '@/features/assets/types';
import type { PlacedItem } from '@/features/texture/types';
import { downloadDataUrl, downloadText } from '@/shared/lib/download';

type ExportBarProps = {
  baseAsset: LoadedAsset | null;
  elements: LoadedAsset[];
  placements: PlacedItem[];
};

export function ExportBar({ baseAsset, elements, placements }: ExportBarProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(2);
  const [status, setStatus] = useState('');
  const elementsById = useMemo(() => new Map(elements.map((item) => [item.id, item])), [elements]);
  const canExportVector = Boolean(
    baseAsset &&
      baseAsset.sourceType === 'svg' &&
      elements.every((item) => item.sourceType === 'svg'),
  );
  const vectorBlockedReason = 'SVG 导出要求底图和所有元素素材均为 SVG。';

  const canExport = Boolean(baseAsset);

  useEffect(() => {
    if (format === 'svg' && !canExportVector) {
      setFormat('png');
    }
  }, [canExportVector, format]);

  const handleExport = async () => {
    if (!baseAsset) return;
    if (format === 'svg' && !canExportVector) {
      setStatus(vectorBlockedReason);
      return;
    }
    const filename = `texture-export.${format === 'jpeg' ? 'jpg' : format}`;

    try {
      if (format === 'svg') {
        const svg = exportSvgString({ baseAsset, elementsById, placements });
        if (window.electron?.saveFile) {
          const result = await window.electron.saveFile({
            defaultPath: filename,
            filters: [{ name: 'SVG', extensions: ['svg'] }],
            data: svg,
            encoding: 'utf8',
          });
          setStatus(result.canceled ? '已取消导出。' : `已保存：${result.filePath ?? filename}`);
        } else {
          downloadText(filename, svg, 'image/svg+xml;charset=utf-8');
          setStatus('已通过浏览器下载 SVG。');
        }
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(baseAsset.width * scale);
      canvas.height = Math.round(baseAsset.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Failed to create export canvas context.');

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.scale(scale, scale);
      renderScene({
        ctx: context,
        width: baseAsset.width,
        height: baseAsset.height,
        baseAsset,
        elementsById,
        placements,
        background: format === 'jpeg' ? '#ffffff' : undefined,
      });
      context.restore();

      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, 0.92);
      if (window.electron?.saveFile) {
        const result = await window.electron.saveFile({
          defaultPath: filename,
          filters: [
            {
              name: format === 'jpeg' ? 'JPEG' : 'PNG',
              extensions: [format === 'jpeg' ? 'jpg' : 'png'],
            },
          ],
          data: dataUrl.split(',')[1] ?? '',
          encoding: 'base64',
        });
        setStatus(result.canceled ? '已取消导出。' : `已保存：${result.filePath ?? filename}`);
      } else {
        downloadDataUrl(filename, dataUrl);
        setStatus(`已通过浏览器下载 ${format.toUpperCase()}。`);
      }
    } catch (error) {
      console.error(error);
      setStatus('导出失败，请重试。');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2 text-ui-sm">
          <span className="font-medium">格式</span>
          <div className="grid grid-cols-3 gap-2">
            {(['png', 'jpeg', 'svg'] as ExportFormat[]).map((item) => {
              const disabled = item === 'svg' && !canExportVector;
              const title = disabled ? vectorBlockedReason : `导出为 ${item.toUpperCase()}`;
              return (
                <button
                  key={item}
                  type="button"
                  title={title}
                  disabled={disabled}
                  onClick={() => setFormat(item)}
                  className={cn(
                    'h-10 rounded-xl border px-3 text-ui-sm font-medium transition',
                    format === item
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground',
                    disabled && 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-50',
                  )}
                >
                  {item.toUpperCase()}
                </button>
              );
            })}
          </div>
        </label>
        <label className="space-y-2 text-ui-sm">
          <span className="font-medium">倍率</span>
          <StudioSelect
            label="倍率"
            className="w-full"
            value={scale}
            disabled={format === 'svg'}
            onChange={value => setScale(Number(value))}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </StudioSelect>
        </label>
      </div>
      <Button className="w-full" onClick={handleExport} disabled={!canExport}>
        <Download className="h-4 w-4" />
        导出文件
      </Button>
      {!canExportVector ? (
        <p className="text-ui-xs text-amber-600 dark:text-amber-400">{vectorBlockedReason}</p>
      ) : (
        <p className="text-ui-xs text-emerald-600 dark:text-emerald-400">
          当前素材均为 SVG，可保留图形结构导出。素材内的位图、字体和滤镜仍需检查。
        </p>
      )}
      <p className="text-ui-xs text-muted-foreground">{status || '将使用系统保存对话框导出到本地文件。'}</p>
    </div>
  );
}
