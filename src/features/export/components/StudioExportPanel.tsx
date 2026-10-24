import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, X } from 'lucide-react';
import type { Scene } from '@/features/texture/engine/scene';
import { buildScene } from '@/features/texture/engine/scene';
import { useProjectStore } from '@/features/project/store';
import { clone } from '@/features/project/model';
import type { ExportSettings } from '@/features/project/model';
import { saveBlob } from '@/features/project/io';
import { Field, SelectField, Toggle } from '@/shared/ui/StudioFields';
import { createExport, exportCheck, exportRegion } from '../studioExport';
import { studioSvg } from '../studioSvg';

export function StudioExportPanel({time,onClose}:{time:number;onClose:()=>void}) {
  const s=useProjectStore();const p=s.project;
  const [settings,setSettings]=useState(clone(p.export));const [scene,setScene]=useState<Scene|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [progress,setProgress]=useState(0);const [label,setLabel]=useState('');
  const controller=useRef<AbortController|null>(null);const dialog=useRef<HTMLDialogElement>(null);
  const update=(patch:Partial<ExportSettings>)=>{setSettings(v=>({...v,...patch}));setError('');};
  useEffect(()=>{dialog.current?.showModal();let active=true;buildScene(p).then(v=>{if(active)setScene(v);}).catch(e=>setError(e.message));
    return()=>{active=false;controller.current?.abort();};},[]);
  const check=scene?exportCheck(scene,settings):null;
  const svgSize=useMemo(()=>{
    if(!scene||settings.format!=='svg'||exportCheck(scene,settings).errors.length)return null;
    return new Blob([studioSvg(scene,time,exportRegion(p,settings),settings.scale,!settings.transparent,settings.svgMode)]).size;
  },[scene,settings,time]);
  const close=()=>{if(busy)return;s.edit(p=>{p.export=clone(settings);});onClose();};
  const start=async()=>{
    if(!scene||busy)return;
    const signal=new AbortController();controller.current=signal;setBusy(true);setError('');setProgress(0);
    try{
      s.edit(p=>{p.export=clone(settings);});
      const result=await createExport(scene,settings,time,signal.signal,(v,label)=>{setProgress(v);setLabel(label);});
      if(signal.signal.aborted)throw new DOMException('导出已取消','AbortError');
      const filename=`${p.name.replace(/[\\/:*?"<>|]/g,'_')}_${settings.region}.${result.extension}`;
      setLabel('请选择保存位置');
      const saved=await saveBlob(result.blob,filename,result.extension);
      setLabel(saved.canceled?'已取消保存，可重新导出':'导出完成');s.message(saved.canceled?'已取消保存':`已导出 ${filename}`);
    }catch(e){const message=e instanceof Error?e.message:'导出失败';setError(message);setLabel('');}
    finally{setBusy(false);controller.current=null;}
  };
  return <dialog ref={dialog} className="export-dialog" onCancel={e=>{e.preventDefault();close();}}>
    <div className="export-header"><div><span className="eyebrow">EXPORT TEXTURE</span><h2>导出素材</h2></div><button className="icon-button" aria-label="关闭导出" disabled={busy} onClick={close}><X size={18}/></button></div>
    <div className="export-body">
      <fieldset disabled={busy}>
        <SelectField label="文件格式" value={settings.format} onChange={v=>update({format:v as ExportSettings['format']})}>
          <option value="png">PNG · 静态图片</option><option value="jpeg">JPEG · 带背景图片</option><option value="svg">SVG · 矢量素材</option><option value="sequence">PNG 序列 · 循环动态 ZIP</option>
        </SelectField>
        {settings.format==='svg'&&<SelectField label="SVG 输出方式" value={settings.svgMode} onChange={v=>update({svgMode:v as ExportSettings['svgMode']})}>
          <option value="pure">纯矢量 · 图形可编辑</option><option value="effects">效果保留 · 可含滤镜 / 位图</option><option value="optimized">优化 · 复用图形结构</option>
        </SelectField>}
        {settings.format==='svg'&&<p className="field-hint">{settings.svgMode==='optimized'?'自定义图形使用 defs / use 复用，进入设计软件后可展开继续编辑。':settings.svgMode==='pure'?'只接受不含位图、字体和滤镜的图形；保持逻辑对象与矢量结构。':'保留清理后的 SVG 效果，字体与混合模式仍需在目标软件中检查。'}</p>}
        <SelectField label="导出区域" value={settings.region} onChange={v=>update({region:v as ExportSettings['region']})}>
          <option value="canvas">当前画布</option><option value="unit">无缝重复单元</option><option value="selection">选定区域</option><option value="filled">铺满后的成品图</option>
        </SelectField>
        {settings.region==='filled'&&<Field label="横纵铺设数量" value={settings.repeats} min={2} max={8} onChange={v=>update({repeats:v})}/>}
        {settings.region==='selection'&&<div className="selection-fields">
          {(['x','y','width','height'] as const).map(key=><Field key={key} label={{x:'选区 X',y:'选区 Y',width:'选区宽度',height:'选区高度'}[key]}
            value={settings.selection[key]} min={key==='width'||key==='height'?1:0}
            max={key==='x'?p.canvas.width-1:key==='y'?p.canvas.height-1:key==='width'?p.canvas.width-settings.selection.x:p.canvas.height-settings.selection.y}
            onChange={v=>{const r={...settings.selection,[key]:v};r.width=Math.min(r.width,p.canvas.width-r.x);r.height=Math.min(r.height,p.canvas.height-r.y);update({selection:r});}} unit="px"/>)}
        </div>}
        <Field label="导出倍率" value={settings.scale} min={0.25} max={8} step={0.25} onChange={v=>update({scale:v})} unit="×"/>
        {settings.format!=='jpeg'?<Toggle label="保留透明背景" checked={settings.transparent} onChange={v=>update({transparent:v})}/>:<p className="field-hint">JPEG 使用画布背景颜色，不保留透明度。</p>}
        {settings.format==='sequence'&&<>
          <Field label="帧率" value={settings.fps} min={1} max={60} onChange={v=>update({fps:v})} unit="fps"/>
          <p className="field-hint">PNG 逐帧保留 Alpha；ZIP 内含帧率说明，可按图片序列导入剪辑或合成软件。</p>
        </>}
      </fieldset>
      <div className="export-checks"><h3>导出前检查</h3>
        {check&&<><div className="check-summary">
          <span><Check size={13}/>{check.width} × {check.height} px</span><span><Check size={13}/>{scene?.count.toLocaleString()} 个逻辑对象</span>
          <span><Check size={13}/>{check.transparent?'保留 Alpha 透明':'带背景'}</span>
          <span><Check size={13}/>{p.canvas.seamless?'空间无缝':'普通画布'}</span>
          {settings.format==='sequence'?<span><Check size={13}/>{p.animation.duration} 秒 · {check.frameCount} 帧 · 时间循环</span>:<span><Check size={13}/>当前帧 {time.toFixed(2)} 秒</span>}
          {svgSize!==null&&<span><Check size={13}/>SVG 大小约 {(svgSize/1024).toFixed(1)} KB</span>}
        </div>
        {check.errors.map(m=><p className="check-error" key={m}>{m}</p>)}{check.warnings.map(m=><p className="check-warning" key={m}>{m}</p>)}</>}
        {!scene&&!error&&<p className="field-hint">正在检查图形…</p>}
      </div>
      {error&&<p role="alert" className="check-error">{error}</p>}
      {(busy||label)&&<div className="export-progress"><progress value={progress} max="1"/><span aria-live="polite">{label}</span></div>}
    </div>
    <div className="export-footer"><button className="secondary-button" onClick={busy?()=>controller.current?.abort():close}>{busy?'取消导出':'返回编辑'}</button>
      <button className="primary-button" disabled={busy||!scene||!!check?.errors.length} onClick={start}><Download size={15}/>{busy?'正在导出':'导出并保存'}</button></div>
  </dialog>;
}
