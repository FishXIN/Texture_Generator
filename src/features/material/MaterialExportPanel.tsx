import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { saveBlob } from '@/features/project/io';
import { SelectField } from '@/shared/ui/StudioFields';
import { useMaterialStore } from './store';
import { copyMaterial, isSeamless } from './model';
import { materialTask } from './workerClient';

export function MaterialExportPanel({ onClose }: { onClose: () => void }) {
  const s = useMaterialStore(), p = s.project;
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const task = useRef<ReturnType<typeof materialTask> | null>(null), dialog = useRef<HTMLDivElement>(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement; dialog.current?.focus();
    return () => { alive.current = false; task.current?.cancel(); previous?.focus(); };
  }, []);
  const cancel = () => { task.current?.cancel(); task.current = null; setBusy(false); setProgress(0); setError('已取消，可继续调整并重新导出。'); };
  const download = async () => {
    if (busy) return; setBusy(true); setError(''); setProgress(0);
    const snapshot = copyMaterial(useMaterialStore.getState().project);
    const job = materialTask<{ blob: Blob; filename: string; extension: string }>(snapshot, snapshot.export.size, true, v => { if (alive.current) setProgress(v); });
    task.current = job;
    try {
      const output = await job.promise;
      if (!alive.current || task.current !== job) return;
      const saved = await saveBlob(output.blob, output.filename, output.extension);
      if (!alive.current) return;
      s.message(saved.canceled ? '已取消保存' : `已导出 ${snapshot.export.size} px ${snapshot.export.maps === 'both' ? '纹理＋法线配套图' : '纹理素材'}`);
      setError(saved.canceled ? '已取消保存，可重新导出。' : '导出完成。');
    } catch (e) { if (alive.current && task.current === job) setError(e instanceof Error ? e.message : '导出失败，请降低分辨率后重试'); }
    finally { if (alive.current && task.current === job) { setBusy(false); task.current = null; } }
  };
  return <div className="material-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="material-dialog" role="dialog" aria-modal="true" aria-labelledby="material-export-title" tabIndex={-1} ref={dialog}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); busy ? cancel() : onClose(); }
        if (e.key === 'Tab') {
          const nodes = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')];
          const first = nodes[0], last = nodes.at(-1);
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="material-dialog-header"><div><p>EXPORT TEXTURE</p><h2 id="material-export-title">导出纹理素材</h2></div><button aria-label="关闭导出" disabled={busy} onClick={onClose}><X size={18}/></button></div>
      <div className="material-export-fields">
        <SelectField label="输出通道" value={p.export.maps} disabled={busy} onChange={v => s.edit(p => { p.export.maps = v as typeof p.export.maps; })}>
          <option value="height">黑白纹理 · PNG</option><option value="both">黑白纹理＋法线 · ZIP</option><option value="normal">切线空间法线 · PNG</option>
        </SelectField>
        {p.export.maps !== 'height' && <SelectField label="法线格式" value={p.normal.convention} disabled={busy} onChange={v => s.edit(p => { p.normal.convention = v as typeof p.normal.convention; })}><option value="opengl">OpenGL · +Y</option><option value="directx">DirectX · −Y</option></SelectField>}
        <SelectField label="素材尺寸" value={String(p.export.size)} disabled={busy} onChange={v => s.edit(p => { p.export.size = Number(v); })}>
          {[128,256,512,1024,2048,4096].map(v => <option key={v} value={v}>{v} × {v}</option>)}
        </SelectField>
        {p.export.maps !== 'normal' && <>
          <SelectField label="背景方式" value={p.export.background} disabled={busy} onChange={v => s.edit(p => { p.export.background = v as typeof p.export.background; })}><option value="white">黑白 · 正片叠底</option><option value="transparent">透明底 · 黑色纹理</option></SelectField>
          <SelectField label="灰度位深" value={String(p.export.depth)} disabled={busy} onChange={v => s.edit(p => { p.export.depth = Number(v) as 8 | 16; })}>
            <option value="8">8 位 · 平面素材 / 蒙版</option><option value="16">16 位 · 精细灰度 / 高度</option>
          </SelectField>
        </>}
      </div>
      <div className="material-export-facts">
        <span>空间平铺<b>{isSeamless(p) ? '周期连续' : '有未融合的导入源'}</b></span>
        <span>透明通道<b>{p.export.maps === 'normal' ? '法线不透明' : p.export.background === 'transparent' ? '保留 Alpha' : '不透明黑白'}</b></span>
        <span>灰度位深<b>{p.export.maps === 'normal' ? 'RGB 8 位' : `${p.export.depth} 位`}</b></span>
        <span>{p.export.maps === 'height' ? '叠加方式' : '法线约定'}<b>{p.export.maps === 'height' ? p.export.background === 'transparent' ? '普通叠加' : '正片叠底' : p.normal.convention === 'opengl' ? 'OpenGL · +Y' : 'DirectX · −Y'}</b></span>
      </div>
      <p className="material-help">{p.export.maps === 'normal' ? '法线蓝紫色表示方向，按非颜色数据导入，并选择对应的 OpenGL / DirectX 约定。' : p.export.background === 'transparent' ? '透明版为纯黑纹理，白色转为透明；直接叠加到作品上，预览棋盘格不会写入文件。' : '黑白图导入平面设计软件后，选择正片叠底；白色保留底图，黑色增加纹理。也可作为灰度蒙版或高度使用。'}{p.export.maps === 'both' && ' ZIP 包含法线与参数说明。'}</p>
      {p.sources.length > 0 && <p className="material-help">导入源解码上限 1024 px，放大导出不会恢复原图细节。</p>}
      {busy && <div className="material-progress"><progress value={progress} max={1}/><span>{Math.round(progress * 100)}% · {progress < 0.8 ? '生成完整分辨率' : '编码 PNG'}</span></div>}
      <p role="status" className="material-export-message">{error}</p>
      <div className="material-dialog-footer">{busy ? <button onClick={cancel}>取消生成</button> : <button onClick={onClose}>返回编辑</button>}
        <button className="material-primary" disabled={busy} onClick={download}><Download size={15}/>{busy ? '正在导出' : '下载素材'}</button></div>
    </div>
  </div>;
}
