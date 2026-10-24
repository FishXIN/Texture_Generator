import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Pause, Play, Redo2, RotateCcw, Save, Undo2 } from 'lucide-react';
import { Library } from '@/features/project/Library';
import { Inspector } from '@/features/project/Inspector';
import { newProject } from '@/features/project/model';
import { parseProject, projectBlob, saveBlob } from '@/features/project/io';
import { useProjectStore } from '@/features/project/store';
import { buildScene } from '@/features/texture/engine/scene';
import type { Scene } from '@/features/texture/engine/scene';
import { StudioCanvas } from '@/features/texture/components/StudioCanvas';
import type { PreviewBackground } from '@/features/texture/components/StudioCanvas';
import { StudioExportPanel } from '@/features/export/components/StudioExportPanel';
import LegacyEditor from '@/features/texture/components/LegacyEditor';
import { StudioSelect } from '@/shared/ui/StudioSelect';

export default function PatternStudio() {
  const s=useProjectStore();const p=s.project;
  const [scene,setScene]=useState<Scene|null>(null);const [tiled,setTiled]=useState(false);const [boundaries,setBoundaries]=useState(true);
  const [zoom,setZoom]=useState<number|null>(null);
  const [background,setBackground]=useState<PreviewBackground>('checker');const [customBackground,setCustomBackground]=useState('#c8c3ae');
  const [advanced,setAdvanced]=useState(false);const [time,setTime]=useState(0);const [playing,setPlaying]=useState(false);
  const [exportOpen,setExportOpen]=useState(false);const [legacy,setLegacy]=useState(false);
  const [recovery,setRecovery]=useState(false);const [saving,setSaving]=useState(false);
  const openInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(window.electron?.platform==='darwin')document.documentElement.dataset.desktop='mac';},[]);
  const save=useCallback(async()=>{
    if(saving)return;setSaving(true);
    try{const result=await saveBlob(projectBlob(useProjectStore.getState().project),`${useProjectStore.getState().project.name}.texture.json`,'json');
      useProjectStore.getState().message(result.canceled?'已取消保存':'项目已保存，包含素材、图层和手工摆放。');
    }catch(e){useProjectStore.getState().message(e instanceof Error?e.message:'保存失败');}finally{setSaving(false);}
  },[saving]);
  useEffect(()=>{
    try{setRecovery(!!localStorage.getItem('texture-recovery'));}catch{/* Saving the project remains available. */}
  },[]);
  useEffect(()=>{
    let active=true;
    buildScene(p).then(value=>{if(active)setScene(value);}).catch(e=>s.message(e.message));
    return()=>{active=false;};
  },[p]);
  useEffect(()=>{
    if(s.revision===0)return;
    const timer=setTimeout(()=>{
      try{localStorage.setItem('texture-recovery',JSON.stringify(p));}
      catch{s.message('浏览器恢复空间不足，请保存项目文件。');}
    },700);
    return()=>clearTimeout(timer);
  },[p,s.revision]);
  useEffect(()=>{
    if(!playing)return;
    let id=0;let previous=performance.now();
    const frame=(now:number)=>{const dt=Math.min(0.1,(now-previous)/1000);previous=now;setTime(t=>(t+dt)%p.animation.duration);id=requestAnimationFrame(frame);};
    id=requestAnimationFrame(frame);return()=>cancelAnimationFrame(id);
  },[playing,p.animation.duration]);
  useEffect(()=>{setTime(t=>t%p.animation.duration);},[p.animation.duration]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(exportOpen||legacy)return;
      const target=event.target as HTMLElement;
      if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;
      const command=event.metaKey||event.ctrlKey;
      if(command&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?s.redo():s.undo();}
      else if(command&&event.key.toLowerCase()==='y'){event.preventDefault();s.redo();}
      else if(command&&event.key.toLowerCase()==='s'){event.preventDefault();void save();}
      else if(event.code==='Space'){event.preventDefault();setPlaying(v=>!v);}
      else if(event.key==='Escape')s.selectObject(null);
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[exportOpen,legacy,save]);
  const open=async(file?:File)=>{
    if(!file)return;
    try{if(file.size>25_000_000)throw new Error('项目超过 25 MB。');
      s.replace(parseProject(await file.text()));setTime(0);setPlaying(false);s.message(`已打开 ${file.name}`);
    }catch(e){s.message(e instanceof Error?e.message:'项目打开失败');}finally{if(openInput.current)openInput.current.value='';}
  };
  if(legacy)return <><LegacyEditor/><button className="legacy-return primary-button" onClick={()=>{setLegacy(false);document.documentElement.classList.remove('dark');}}>返回纹理工作台</button></>;
  return <div className="studio">
    <header className="studio-header">
      <div className="studio-brand"><span className="brand-mark">t<span>g</span></span><div><h1>纹理工作台</h1><p>TEXTURE GENERATOR</p></div></div>
      <div className="project-title"><input aria-label="项目名称" value={p.name} onChange={e=>s.edit(p=>{p.name=e.target.value.slice(0,80);},'project-name')}/><span>本地项目</span></div>
      <div className="header-actions">
        <button className="icon-button" title="撤销 ⌘Z" aria-label="撤销" disabled={!s.past.length} onClick={s.undo}><Undo2 size={17}/></button>
        <button className="icon-button" title="重做 ⇧⌘Z" aria-label="重做" disabled={!s.future.length} onClick={s.redo}><Redo2 size={17}/></button>
        <span className="toolbar-divider"/>
        <button className="text-button" onClick={()=>{s.replace(newProject());setPlaying(false);setTime(0);s.message('已新建透明纹理项目，可撤销恢复上一作品。');}}>新建</button>
        <button className="text-button" onClick={()=>openInput.current?.click()}><FolderOpen size={15}/>打开</button>
        <button className="text-button" disabled={saving} onClick={save}><Save size={15}/>{saving?'保存中':'保存'}</button>
        <button className="text-button legacy-link" onClick={()=>{setPlaying(false);setLegacy(true);}}>底图阵列</button>
        <button className="primary-button" onClick={()=>{setPlaying(false);setExportOpen(true);}}><Download size={15}/>导出</button>
      </div>
      <input ref={openInput} type="file" accept=".json,.texture.json,application/json" hidden onChange={e=>open(e.target.files?.[0])}/>
    </header>
    <div className="studio-workspace">
      <Library onPreset={()=>{setTime(0);setPlaying(false);}} onPlace={()=>{setTiled(false);setPlaying(false);}}/>
      <main className="canvas-workspace">
        <div className="canvas-toolbar">
          <div className="segmented"><button className={!tiled?'active':''} onClick={()=>setTiled(false)}>单元编辑</button><button className={tiled?'active':''} onClick={()=>setTiled(true)}>整面预览</button></div>
          <div className="preview-controls">
            <StudioSelect label="预览缩放" value={zoom??'fit'} onChange={v=>setZoom(v==='fit'?null:Number(v))}>
              <option value="fit">适配</option><option value="0.25">25%</option><option value="0.5">50%</option><option value="1">100%</option><option value="2">200%</option>
            </StudioSelect>
            {tiled&&<label><input type="checkbox" checked={boundaries} onChange={e=>setBoundaries(e.target.checked)}/>单元边界</label>}
            <StudioSelect label="透明检查背景" value={background} onChange={v=>setBackground(v as PreviewBackground)}>
              <option value="checker">棋盘格</option><option value="light">浅色底</option><option value="dark">深色底</option><option value="custom">自定义底</option>
            </StudioSelect>{background==='custom'&&<input type="color" aria-label="预览底色" value={customBackground} onChange={e=>setCustomBackground(e.target.value)}/>}
          </div>
        </div>
        {recovery&&<div className="recovery-banner"><span>有上次编辑的本地恢复副本</span><button onClick={()=>{try{s.replace(parseProject(localStorage.getItem('texture-recovery')!));s.message('已恢复上次作品');}catch(e){s.message(e instanceof Error?e.message:'恢复失败');}setRecovery(false);}}>恢复作品</button><button aria-label="关闭恢复提示" onClick={()=>setRecovery(false)}>忽略</button></div>}
        <div className="canvas-meta"><span>{p.canvas.width} × {p.canvas.height}<i/> {p.canvas.seamless?'无缝重复单元':'普通画布'}</span>
          <span>{scene?.count.toLocaleString()??'—'} 个对象{scene&&scene.count<scene.requested&&' · 间距 / 蒙版限制数量'}</span></div>
        <StudioCanvas scene={scene} time={time} tiled={tiled} boundaries={boundaries} background={background} customBackground={customBackground} zoom={zoom} onPause={()=>setPlaying(false)} selection={advanced&&p.export.region==='selection'}/>
        <div className="timeline">
          <button className="play-button" aria-label={playing?'暂停':'播放'} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button>
          <button className="icon-button" title="回到首帧" onClick={()=>{setTime(0);setPlaying(false);}}><RotateCcw size={14}/></button>
          <span className="time-code">{time.toFixed(2)} s</span><input aria-label="时间定位" type="range" min="0" max={p.animation.duration} step="0.01" value={time} onChange={e=>{setPlaying(false);setTime(Number(e.target.value));}}/>
          <span className="time-duration">{p.animation.duration.toFixed(1)} s 循环</span>
        </div>
        <footer className="studio-status"><span role="status">{s.notice}</span><span>{playing?'播放中':'可在任意帧导出'} · PNG / SVG / PNG 序列</span></footer>
      </main>
      <Inspector advanced={advanced} onAdvanced={setAdvanced}/>
    </div>
    {exportOpen&&<StudioExportPanel time={time} onClose={()=>setExportOpen(false)}/>}
  </div>;
}
