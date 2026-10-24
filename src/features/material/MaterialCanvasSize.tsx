import { ChevronDown } from 'lucide-react';
import { StudioSelect } from '@/shared/ui/StudioSelect';
import { useMaterialStore } from './store';
import { CANVAS_RATIOS, EXPORT_SIZES, MAX_CANVAS_SIZE, canvasDimensions, canvasRatio, resolutionLabel } from './dimensions';

export function MaterialCanvasSize() {
  const s = useMaterialStore(), canvas = s.project.canvas;
  const ratio = canvasRatio(canvas), longest = Math.max(canvas.width, canvas.height);
  const resolution = EXPORT_SIZES.some(size => size === longest) ? String(longest) : 'custom';
  return <details className="material-canvas-size">
    <summary aria-label="画布尺寸">{canvas.width} × {canvas.height}<ChevronDown size={12}/></summary>
    <div>
      <label>比例<StudioSelect label="画布比例" value={ratio} onChange={v => {
        const [width, height] = v.split(':').map(Number);
        s.edit(p => { p.canvas = canvasDimensions(width, height, longest); });
      }}>
        {ratio === 'custom' && <option value="custom">自定义</option>}
        {CANVAS_RATIOS.map(([w,h]) => <option key={`${w}:${h}`} value={`${w}:${h}`}>{w}:{h}</option>)}
      </StudioSelect></label>
      <label>清晰度<StudioSelect label="画布清晰度" value={resolution} onChange={v => {
        const size = Number(v);
        s.edit(p => { p.canvas = canvasDimensions(canvas.width, canvas.height, size); p.export.size = size; });
      }}>
        {resolution === 'custom' && <option value="custom">自定义 · {longest} px</option>}
        {EXPORT_SIZES.map(size => <option key={size} value={size}>{resolutionLabel(size)}</option>)}
      </StudioSelect></label>
      <div className="material-canvas-dimensions">
        {(['width','height'] as const).map(key => <label key={key}>{key === 'width' ? '宽' : '高'}<input
          aria-label={`画布${key === 'width' ? '宽度' : '高度'}`} type="number" min={1} max={MAX_CANVAS_SIZE} value={canvas[key]} onChange={e => {
            const value = Number(e.target.value);
            if (Number.isInteger(value) && value >= 1 && value <= MAX_CANVAS_SIZE) s.edit(p => {
              p.canvas[key] = value;
              const longest = Math.max(p.canvas.width, p.canvas.height);
              if (EXPORT_SIZES.some(size => size === longest)) p.export.size = longest;
            }, `canvas:${key}`);
          }}/></label>)}
      </div>
    </div>
  </details>;
}
