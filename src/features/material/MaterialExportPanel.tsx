import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { saveBlob } from '@/features/project/io';
import { Field, SelectField } from '@/shared/ui/StudioFields';
import { useMaterialStore } from './store';
import { copyMaterial } from './model';
import { materialTask } from './workerClient';
import type { MaterialTaskOptions } from './workerClient';
import { vectorIssues } from './vector';
import { outputDimensions } from './composition';

export function MaterialExportPanel({ onClose }: { onClose: () => void }) {
  const s = useMaterialStore(), p = s.project;
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const [format,setFormat]=useState<NonNullable<MaterialTaskOptions['format']>>('png');
  const svg=['pure','optimized','effect'].includes(format),vector=format==='pure'||format==='optimized';
  const exportProject={...p,layers:p.layers.filter(l=>p.export.scope!=='material'||l.role!=='background')};
  const composite=exportProject.layers.some(l=>l.role!=='texture');
  const issues=format==='pure'||format==='optimized'?vectorIssues(exportProject):[];
  const dims=outputDimensions(p,p.export.size);
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
    const job = materialTask<{ blob: Blob; filename: string; extension: string }>(snapshot, snapshot.export.size, true, v => { if (alive.current) setProgress(v); },{format});
    task.current = job;
    try {
      const output = await job.promise;
      if (!alive.current || task.current !== job) return;
      const saved = await saveBlob(output.blob, output.filename, output.extension);
      if (!alive.current) return;
      s.message(saved.canceled ? '已取消保存' : '素材已导出');
      setError(saved.canceled ? '已取消保存，可重新导出。' : '导出完成。');
    } catch (e) { if (alive.current && task.current === job) setError(e instanceof Error ? e.message : '导出失败，请降低分辨率后重试'); }
    finally { if (alive.current && task.current === job) { setBusy(false); task.current = null; } }
  };
  return <div className="material-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="material-dialog" role="dialog" aria-modal="true" aria-labelledby="material-export-title" tabIndex={-1} ref={dialog}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); busy ? cancel() : onClose(); }
        if (e.key === 'Tab') {
          const nodes = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary')].filter(n=>n.getClientRects().length);
          const first = nodes[0], last = nodes.at(-1);
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="material-dialog-header"><h2 id="material-export-title">导出素材</h2><button aria-label="关闭导出" disabled={busy} onClick={onClose}><X size={18}/></button></div>
      <div className="material-export-fields">
        <SelectField label="导出格式" value={format} disabled={busy} onChange={v=>{
          setFormat(v as typeof format);
          if(['pure','optimized','effect'].includes(v))s.edit(p=>{p.export.maps='height';});
        }}>
          <option value="png">PNG</option><option value="sequence">PNG 序列</option>
          <option value="pure">矢量 SVG</option><option value="optimized">优化 SVG</option><option value="effect">保留效果 SVG</option>
        </SelectField>
        {p.layers.some(l=>l.role==='background')&&<SelectField label="导出内容" value={p.export.scope} disabled={busy} onChange={v=>s.edit(p=>{p.export.scope=v as typeof p.export.scope;})}><option value="canvas">整个画布</option><option value="material">仅素材 · 不含背景图</option></SelectField>}
        <SelectField label="素材尺寸" value={String(p.export.size)} disabled={busy} onChange={v => s.edit(p => { p.export.size = Number(v); })}>
          {[128,256,512,1024,2048,4096].map(v => {const d=outputDimensions(p,v);return <option key={v} value={v}>{d.width} × {d.height}</option>;})}
        </SelectField>
        {p.export.maps !== 'normal' && <>
          <SelectField label="画布底色" value={p.export.background} disabled={busy} onChange={v => s.edit(p => { p.export.background = v as typeof p.export.background; })}><option value="white">白色</option><option value="transparent">透明</option></SelectField>
        </>}
      </div>
      {format==='sequence'&&<p className="material-help">{Math.round(p.timeline.duration*p.timeline.fps)} 帧，打包下载</p>}
      {format==='effect'&&<p className="material-help">包含嵌入的图片，保留画布效果。</p>}
      {issues.length>0&&<p className="material-help">{issues.join('；')}。可选择「保留效果 SVG」。</p>}
      <details><summary>高级设置</summary>
        {!svg&&<SelectField label="输出通道" value={p.export.maps} disabled={busy} onChange={v=>s.edit(p=>{p.export.maps=v as typeof p.export.maps;})}><option value="height">画布素材</option><option value="normal">法线</option><option value="both">素材与法线</option></SelectField>}
        {!vector&&p.export.maps!=='normal'&&!composite&&<SelectField label="灰度位深" value={String(p.export.depth)} disabled={busy} onChange={v=>s.edit(p=>{p.export.depth=Number(v) as 8|16;})}><option value="8">8 位</option><option value="16">16 位</option></SelectField>}
        {composite&&<p className="material-help">上传素材保留原色，导出为 8 位 RGBA。</p>}
        {p.export.background==='transparent'&&<SelectField label="纹理颜色" value={p.export.pigment} disabled={busy} onChange={v=>s.edit(p=>{p.export.pigment=v as 'black'|'white';})}><option value="black">黑色</option><option value="white">白色</option></SelectField>}
        {p.export.maps!=='height'&&<>
          <Field label="法线强度" value={p.normal.strength} min={0} max={2} step={.01} disabled={busy} onChange={v=>s.edit(p=>{p.normal.strength=v;},'normal')}/>
          <SelectField label="法线格式" value={p.normal.convention} disabled={busy} onChange={v=>s.edit(p=>{p.normal.convention=v as typeof p.normal.convention;})}><option value="opengl">OpenGL</option><option value="directx">DirectX</option></SelectField>
        </>}
        {format==='sequence'&&<label className="material-seed">帧率<input aria-label="序列帧率" type="number" min={1} max={60} disabled={busy} value={p.timeline.fps} onChange={e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=1&&v<=60)s.edit(p=>{p.timeline.fps=v;});}}/></label>}
        <p className="material-help">输出 {dims.width} × {dims.height}，保持画布比例。</p>
      </details>
      {busy && <div className="material-progress"><progress value={progress} max={1}/><span>{Math.round(progress * 100)}% · {progress < 0.8 ? '生成完整分辨率' : '编码 PNG'}</span></div>}
      {error&&<p role="status" className="material-export-message">{error}</p>}
      <div className="material-dialog-footer">{busy ? <button onClick={cancel}>取消生成</button> : <button onClick={onClose}>返回编辑</button>}
        <button className="material-primary" disabled={busy||issues.length>0} onClick={download}><Download size={15}/>{busy ? '正在导出' : '下载素材'}</button></div>
    </div>
  </div>;
}
