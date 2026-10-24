import { useEffect, useMemo, useRef, useState } from 'react';
import { Grid2X2, ChevronDown, ChevronUp, Copy, Download, Eye, EyeOff, FolderOpen, Layers, LockKeyhole, Plus, Redo2, Save, Shuffle, Trash2, Undo2, UnlockKeyhole, Upload } from 'lucide-react';
import { Field, SelectField, Toggle } from '@/shared/ui/StudioFields';
import { saveBlob } from '@/features/project/io';
import { generators, generatorControls, presetGroups, heightLayer, isSeamless, materialId, materialPresets, newMaterial, parseMaterial } from './model';
import type { Generator, HeightLayer } from './model';
import { useMaterialStore } from './store';
import { materialTask } from './workerClient';
import { importHeight } from './import';
import { renderMaterial } from './engine';
import type { MaterialMaps } from './engine';
import { MapView } from './TexturePreview';
import { MaterialExportPanel } from './MaterialExportPanel';
import { materialFilename } from './export';
import { MaterialLayerTools } from './MaterialLayerTools';
import { createParticles } from './particles';
import { frac, torusDistance } from './algorithms';
import './material.css';

export function MaterialStudio({ onOpenPattern }: { onOpenPattern: (text: string) => void }) {
  const s = useMaterialStore(), p = s.project, layer = p.layers.find(l => l.id === s.selected);
  const [maps, setMaps] = useState<MaterialMaps | null>(null), [busy, setBusy] = useState(false), [generationError, setGenerationError] = useState('');
  const [mode, setMode] = useState<'height' | 'normal'>('height'), [tiled, setTiled] = useState(false), [boundaries, setBoundaries] = useState(false);
  const [checkBackground, setCheckBackground] = useState('checker');
  const [category, setCategory] = useState<keyof typeof presetGroups>('all'), [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false), [saving, setSaving] = useState(false), [importing, setImporting] = useState(false), [recovery, setRecovery] = useState(false);
  const [importTarget,setImportTarget]=useState<'layer'|'reference'>('layer');
  const [playing,setPlaying]=useState(false),playClock=useRef(0),phaseDisplay=useRef<HTMLInputElement>(null),drag=useRef<{id:string;dx:number;dy:number}|null>(null);
  const openInput = useRef<HTMLInputElement>(null), sourceInput = useRef<HTMLInputElement>(null);
  const renderKey = JSON.stringify({ layers: p.layers.map(({ locked, name, ...l }) => l), sources: p.sources, normal: p.normal });
  const previews = useMemo(() => materialPresets.map(entry => renderMaterial(newMaterial(entry.id), 48)), []);
  const filteredPresets = materialPresets.map((entry,i)=>({entry,preview:previews[i]})).filter(({entry})=>
    (category==='all'||entry.group===category)&&`${entry.name}${entry.subtitle}`.includes(search.trim()));
  const controls = layer ? generatorControls[layer.kind] : null;
  useEffect(() => { if (p.export.maps === 'height') setMode('height'); }, [p.export.maps]);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof materialTask<MaterialMaps>> | undefined;
    setBusy(true); setGenerationError('');
    const timer = setTimeout(() => {
      const draw=()=>{
        if(!active)return;
        const current=useMaterialStore.getState().project;
        const phase=playing?frac((performance.now()-playClock.current)/1000/current.timeline.duration):current.timeline.phase;
        if(phaseDisplay.current)phaseDisplay.current.value=String(phase);
        task = materialTask<MaterialMaps>(current, playing?192:512,false,undefined,{phase});
        task.promise.then(m => {
          if(active){setMaps(m);setBusy(false);if(playing)requestAnimationFrame(draw);}
        }).catch(e=>{if(active){setBusy(false);setGenerationError(e.message);s.message(e.message);}});
      };
      draw();
    }, 100);
    return () => { active = false; clearTimeout(timer); task?.cancel(); };
  }, [renderKey,playing,p.timeline.phase,p.timeline.duration,p.timeline.fps]);
  useEffect(() => {
    try { setRecovery(!!localStorage.getItem('texture-material-recovery')); } catch {}
    if (window.electron?.platform === 'darwin') document.documentElement.dataset.desktop = 'mac';
  }, []);
  useEffect(() => {
    if (!s.revision) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem('texture-material-recovery', JSON.stringify(p)); }
      catch { s.message('恢复空间不足，请保存项目文件。'); }
    }, 700); return () => clearTimeout(timer);
  }, [p, s.revision]);
  const save = async () => {
    if (saving) return; setSaving(true);
    try {
      const project = useMaterialStore.getState().project, blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      if (blob.size > 25_000_000) throw new Error('项目超过 25 MB，请减少导入源');
      const result = await saveBlob(blob, `${materialFilename(project)}.material.json`, 'json');
      s.message(result.canceled ? '已取消保存' : '项目已保存，包含高度层、种子与原始导入源');
    } catch (e) { s.message(e instanceof Error ? e.message : '保存失败'); } finally { setSaving(false); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (exportOpen || ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [exportOpen, saving]);
  const open = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 25_000_000) throw new Error('项目超过 25 MB');
      const text = await file.text();
      if (JSON.parse(text).kind === 'surface-material') { s.replace(parseMaterial(text)); s.message(`已打开 ${file.name}`); }
      else onOpenPattern(text);
    } catch (e) { s.message(e instanceof Error ? e.message : '打开失败'); }
    finally { if (openInput.current) openInput.current.value = ''; }
  };
  const importFile = async (file?: File) => {
    if (!file || importing) return;
    if (p.sources.length >= 4 || (importTarget==='layer'&&p.layers.length >= 8)) { s.message('最多 4 个导入源、8 个高度层'); return; }
    setImporting(true);
    try {
      const { source, warnings } = await importHeight(file);
      const l = heightLayer('image', { name: source.name, sourceId: source.id, contrast: 1, warp: 0 });
      const current = useMaterialStore.getState().project;
      if (current.sources.length >= 4 || (importTarget==='layer'&&current.layers.length >= 8)) throw new Error('导入源或图层已达到数量上限');
      if (JSON.stringify(current).length + source.original.length > 24_000_000) throw new Error('导入后项目超过 25 MB');
      s.edit(p => { p.sources.push(source); if(importTarget==='layer')p.layers.push(l);else{const selected=p.layers.find(v=>v.id===s.selected);if(selected&&!selected.locked){selected.sourceId=source.id;if(selected.kind==='particles')selected.shape='custom';}} });
      if(importTarget==='layer')s.select(l.id); s.message(warnings.join('；') || '已导入灰度源');
    } catch (e) { s.message(e instanceof Error ? e.message : '导入失败'); }
    finally { setImporting(false); if (sourceInput.current) sourceInput.current.value = ''; }
  };
  const update = (patch: Partial<HeightLayer>, group?: string) => s.updateLayer(patch, group ? `${s.selected}:${group}` : undefined);
  const moveLayer = (id: string, offset: number) => s.edit(p => {
    const i = p.layers.findIndex(l => l.id === id), j = i + offset;
    if (j >= 0 && j < p.layers.length && !p.layers[i].locked) [p.layers[i], p.layers[j]] = [p.layers[j], p.layers[i]];
  });
  const removeLayer = (l: HeightLayer) => {
    if (l.locked) return;
    s.edit(p => {
      p.layers = p.layers.filter(v => v.id !== l.id);
      p.sources = p.sources.filter(source => p.layers.some(v => v.sourceId === source.id||v.sourceMix.some(m=>m.id===source.id)||v.objects.some(o=>o.sourceId===source.id)));
    });
    s.select(useMaterialStore.getState().project.layers.at(-1)?.id ?? '');
  };
  return <div className="material-studio">
    <header className="material-header">
      <div className="material-brand"><div className="material-logo"><Grid2X2 size={21} strokeWidth={1.25}/></div><div><h1>纹理工作台</h1><p>TEXTURE GENERATOR</p></div></div>
      <div className="material-project-title"><input aria-label="纹理项目名称" value={p.name} onChange={e => s.edit(p => { p.name = e.target.value.slice(0,80); }, 'name')}/><span>本地项目</span></div>
      <div className="material-header-actions">
        <button aria-label="撤销" title="撤销 ⌘Z" disabled={!s.past.length} onClick={s.undo}><Undo2 size={16}/></button>
        <button aria-label="重做" title="重做 ⇧⌘Z" disabled={!s.future.length} onClick={s.redo}><Redo2 size={16}/></button><i/>
        <button onClick={() => { s.replace({ ...newMaterial(), name: '未命名纹理', layers: [] }); s.message('已新建空白纹理，可添加图层'); }}>新建</button>
        <button onClick={() => openInput.current?.click()}><FolderOpen size={15}/>打开</button>
        <button disabled={saving} onClick={save}><Save size={15}/>{saving ? '保存中' : '保存'}</button>
        <button className="material-primary" onClick={() => setExportOpen(true)}><Download size={15}/>导出素材</button>
      </div>
      <input hidden ref={openInput} type="file" accept=".json" onChange={e => open(e.target.files?.[0])}/>
      <input hidden ref={sourceInput} aria-label="导入灰度源文件" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" onChange={e => importFile(e.target.files?.[0])}/>
    </header>
    <div className="material-workspace">
      <aside className="material-library">
        <div className="material-panel-heading"><span>程序化预设</span><span>{filteredPresets.length} / {materialPresets.length}</span></div>
        <div className="material-preset-filter"><select aria-label="纹理分类" value={category} onChange={e=>setCategory(e.target.value as keyof typeof presetGroups)}>{Object.entries(presetGroups).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
          <input aria-label="搜索纹理预设" placeholder="搜索纹理…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="material-presets">{filteredPresets.map(({entry,preview}) =>
          <button key={entry.id} className="material-preset" onClick={() => { s.replace(newMaterial(entry.id)); s.message(`已载入${entry.name.slice(3)}，可撤销回上一作品`); }}>
            <MapView maps={preview} label={`${entry.name}预设缩略图`}/><span><b>{entry.name}</b><small>{entry.subtitle}</small></span>
          </button>)}{filteredPresets.length===0&&<p className="material-no-presets">没有匹配的纹理</p>}</div>
        <div className="material-layer-heading"><span><Layers size={14}/>纹理图层</span><button aria-label="添加纹理图层" onClick={s.addLayer}><Plus size={16}/></button></div>
        <div className="material-layer-list">{[...p.layers].reverse().map(l =>
          <div key={l.id} className={`material-layer ${s.selected === l.id ? 'selected' : ''}`}>
            <button className="material-layer-name" onClick={() => s.select(l.id)}><span className="material-layer-glyph">{l.kind === 'image' ? <Upload size={13}/> : <Layers size={13}/>}</span><span>{l.name}<small>{generators[l.kind]} · {Math.round(l.opacity * 100)}%</small></span></button>
            <button aria-label={`${l.visible ? '隐藏' : '显示'} ${l.name}`} disabled={l.locked} onClick={() => s.edit(p => { p.layers.find(v => v.id === l.id)!.visible = !l.visible; })}>{l.visible ? <Eye size={13}/> : <EyeOff size={13}/>}</button>
            <button aria-label={`${l.locked ? '解锁' : '锁定'} ${l.name}`} onClick={() => s.edit(p => { p.layers.find(v => v.id === l.id)!.locked = !l.locked; })}>{l.locked ? <LockKeyhole size={13}/> : <UnlockKeyhole size={13}/>}</button>
          </div>)}</div>
        {layer && <div className="material-layer-actions">
          <button aria-label="上移图层" disabled={layer.locked || p.layers.at(-1)?.id === layer.id} onClick={() => moveLayer(layer.id, 1)}><ChevronUp size={14}/></button>
          <button aria-label="下移图层" disabled={layer.locked || p.layers[0]?.id === layer.id} onClick={() => moveLayer(layer.id, -1)}><ChevronDown size={14}/></button>
          <button aria-label="复制纹理图层" disabled={layer.locked || p.layers.length >= 8} onClick={() => {
            const l = structuredClone(layer); l.id=materialId(); l.name=`${layer.name} 副本`;
            const seeds=new Map(createParticles(layer,0).map(o=>[o.id,o.outlineSeed]));
            l.objects=l.objects.map(o=>({...o,id:materialId(),outlineSeed:o.outlineSeed??seeds.get(o.id)}));
            s.edit(p => { p.layers.push(l); }); s.select(l.id);
          }}><Copy size={14}/></button>
          <button aria-label="删除纹理图层" disabled={layer.locked} onClick={() => removeLayer(layer)}><Trash2 size={14}/></button>
        </div>}
        <div className="material-import-target"><select aria-label="导入用途" value={importTarget} onChange={e=>setImportTarget(e.target.value as typeof importTarget)}><option value="layer">新增灰度图层</option><option value="reference">当前图层输入 / 印模</option></select></div>
        <button className="material-import" disabled={importing} onClick={() => sourceInput.current?.click()}><Upload size={14}/>{importing ? '正在读取素材' : '导入灰度源'}<span>PNG / SVG</span></button>
        <a className="material-pattern-link" href="?studio=pattern">打开图形与动态工作台 ↗</a>
      </aside>
      <main className="material-center">
        <div className="material-view-toolbar">
          <div className="material-segmented"><button className={mode === 'height' ? 'active' : ''} onClick={() => setMode('height')}>黑白纹理</button>{p.export.maps !== 'height' && <button className={mode === 'normal' ? 'active' : ''} onClick={() => setMode('normal')}>法线贴图</button>}</div>
          <div className="material-tile-controls"><button className={tiled ? 'active' : ''} onClick={() => setTiled(v => !v)}>3 × 3 平铺</button>{tiled && <label><input type="checkbox" checked={boundaries} onChange={e => setBoundaries(e.target.checked)}/>边界</label>}
            {mode === 'height' && p.export.background === 'transparent' && <select aria-label="透明检查底色" value={checkBackground} onChange={e => setCheckBackground(e.target.value)}><option value="checker">棋盘格</option><option value="light">浅色底</option><option value="dark">深色底</option></select>}
          </div>
        </div>
        {recovery && <div className="material-recovery"><span>有上次编辑的恢复副本</span><button onClick={() => { try { s.replace(parseMaterial(localStorage.getItem('texture-material-recovery')!)); s.message('已恢复上次纹理'); } catch (e) { s.message(e instanceof Error ? e.message : '恢复失败'); } setRecovery(false); }}>恢复</button><button onClick={() => setRecovery(false)}>忽略</button></div>}
        <div className="material-stage">
          <div className="material-stage-meta"><span>{mode === 'height' ? 'TEXTURE / GRAYSCALE' : `NORMAL / ${p.normal.convention.toUpperCase()}`}</span><span>{isSeamless(p) ? '周期无缝' : '原图边缘未融合'} · {playing?192:512} px 预览</span></div>
          <div className={`material-flat ${mode === 'height' && p.export.background === 'transparent' ? `material-check-${checkBackground}` : ''}`}
            onPointerDown={e=>{
              if(!layer||layer.locked||layer.distribution!=='manual'||playing||tiled||layer.motion!=='none')return;
              const canvas=e.currentTarget.querySelector('canvas')!,rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
              if(x<0||x>1||y<0||y>1)return;
              const item=createParticles(layer,0).reverse().find(o=>!o.locked&&torusDistance({x,y},o)<o.radius);
              if(item){drag.current={id:item.id,dx:frac(x-item.x+.5)-.5,dy:frac(y-item.y+.5)-.5};e.currentTarget.setPointerCapture(e.pointerId);}
            }}
            onPointerMove={e=>{
              if(!drag.current||!layer||layer.locked)return;
              const rect=e.currentTarget.querySelector('canvas')!.getBoundingClientRect(),x=frac((e.clientX-rect.left)/rect.width-drag.current.dx),y=frac((e.clientY-rect.top)/rect.height-drag.current.dy);
              const id=drag.current.id;s.edit(p=>{const o=p.layers.find(l=>l.id===layer.id)?.objects.find(o=>o.id===id);if(o&&!o.locked){o.x=x;o.y=y;}},`${id}:drag`);
            }} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
            <MapView maps={maps} normal={mode === 'normal'} transparent={p.export.background === 'transparent'} pigment={p.export.pigment} repeat={tiled ? 3 : 1} boundaries={boundaries} label={mode === 'normal' ? '法线贴图预览' : '黑白纹理预览'}/></div>
          {generationError ? <div className="material-generation-error" role="alert">{generationError}</div> : busy && <span className="material-updating">更新预览…</span>}
          <div className="material-stage-caption">{tiled ? '检查单元边缘与重复节奏' : '固定种子 · 可重复生成'}<span>{mode === 'normal' ? '切线空间方向数据' : p.export.background === 'transparent' ? `${p.export.pigment==='white'?'白色柔光':'黑色纹理'} · 透明叠加` : p.export.pigment==='white' ? '黑白柔光 · 适用于滤色' : '黑白素材 · 适用于正片叠底'}</span></div>
        </div>
        <div className="material-timeline">
          <button aria-label={playing?'暂停纹理':'播放纹理'} onClick={()=>{
            if(!playing)playClock.current=performance.now()-p.timeline.phase*p.timeline.duration*1000;
            else s.edit(p=>{p.timeline.phase=frac((performance.now()-playClock.current)/1000/p.timeline.duration);},'phase');
            setPlaying(v=>!v);
          }}>{playing?'暂停':'播放'}</button>
          <input ref={phaseDisplay} aria-label="时间相位" type="range" min={0} max={.9999} step={.0001} defaultValue={p.timeline.phase} disabled={playing} onChange={e=>s.edit(p=>{p.timeline.phase=Number(e.target.value);},'phase')}/>
          <label>时长<input aria-label="循环时长" type="number" min={.25} max={30} step={.25} value={p.timeline.duration} disabled={playing} onChange={e=>{const v=Number(e.target.value);if(v>=.25&&v<=30)s.edit(p=>{p.timeline.duration=v;},'duration');}}/>秒</label>
          <label>FPS<input aria-label="序列帧率" type="number" min={1} max={60} value={p.timeline.fps} onChange={e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=1&&v<=60)s.edit(p=>{p.timeline.fps=v;},'fps');}}/></label>
        </div>
        <div className="material-map-strip">
          <button onClick={() => setMode('height')} className={mode === 'height' ? 'selected' : ''}><MapView maps={maps} label="纹理缩略图"/><span><b>黑白纹理</b><small>TEXTURE · {p.export.depth} BIT</small><p>平面叠加 / 灰度蒙版 / 高度</p></span></button>
          {p.export.maps !== 'height' ? <button onClick={() => setMode('normal')} className={mode === 'normal' ? 'selected' : ''}><MapView maps={maps} normal label="法线图缩略图"/><span><b>切线空间法线</b><small>NORMAL · {p.normal.convention === 'opengl' ? 'OPENGL +Y' : 'DIRECTX −Y'}</small><p>蓝紫色编码表面方向</p></span></button>
            : <div className="material-usage"><b>{p.export.background === 'transparent' ? '透明底叠加' : p.export.pigment==='white' ? '柔光叠加使用' : '正片叠底使用'}</b><p>{p.export.background === 'transparent' ? `${p.export.pigment==='white'?'白色柔光':'黑色纹理'}直接叠加到作品上。` : p.export.pigment==='white' ? '导入设计软件，可选择滤色或柔光混合。' : '导入设计软件，图层混合选择正片叠底。'}<br/>{p.export.pigment==='white' ? '透明白色版适合在深色作品上增加光晕。' : '白色区域保留底图，黑色区域增加纹理。'}</p></div>}
        </div>
        <footer className="material-status"><span role="status">{s.notice}</span><span>{busy ? '正在更新' : '全部在本机处理'}</span></footer>
      </main>
      <aside className="material-inspector">
        <div className="material-panel-heading"><span>纹理参数</span><button onClick={s.randomize}><Shuffle size={13}/>换种子</button></div>
        {layer ? <section>
          <div className="material-section-title"><h2>{layer.name}</h2>{layer.locked && <LockKeyhole size={14}/>}</div>
          <SelectField label="生成方式" value={layer.kind} disabled={layer.locked} onChange={v => update({ kind: v as Generator })}>
            {Object.entries(generators).filter(([k]) => k !== 'image' || !!layer.sourceId).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </SelectField>
          {layer.kind !== 'image'&&!['particles','spray','dust','sand'].includes(layer.kind) && <>
            <Field label={controls!.scale} value={layer.scale} min={1} max={64} disabled={layer.locked} onChange={v => update({ scale: v }, 'scale')}/>
            {controls?.octaves && <Field label="细节层级" value={layer.octaves} min={1} max={6} disabled={layer.locked} onChange={v => update({ octaves: v }, 'octaves')}/>}
            {controls?.detail && (layer.kind!=='algorithm'||['gaussian','salt','poisson'].includes(layer.algorithm)) && <Field label={controls.detail} value={layer.detail} min={0} max={1} step={0.01} disabled={layer.locked} onChange={v => update({ detail: v }, 'detail')}/>}
            {controls?.coverage && <Field label={controls.coverage} value={layer.coverage} min={0} max={1} step={0.01} disabled={layer.locked} onChange={v=>update({coverage:v},'coverage')}/>}
            {controls?.softness && <Field label={controls.softness} value={layer.softness} min={0} max={1} step={0.01} disabled={layer.locked} onChange={v=>update({softness:v},'softness')}/>}
            <Field label="空间扰动" value={layer.warp} min={0} max={1} step={0.01} disabled={layer.locked} onChange={v => update({ warp: v }, 'warp')}/>
            {controls?.direction && <SelectField label="纹路方向" value={layer.direction} disabled={layer.locked} onChange={v => update({ direction: v as HeightLayer['direction'] })}><option value="horizontal">横向</option><option value="vertical">纵向</option><option value="diagonal">斜向</option></SelectField>}
          </>}
          {layer.kind === 'image' && <><Toggle label="周期边缘融合" checked={layer.tileSource} disabled={layer.locked} onChange={v => update({ tileSource: v })}/><p className="material-help">融合会改变原图；关闭后不保证无缝。透明区域按中灰读取。</p></>}
          <MaterialLayerTools layer={layer}/>
          <Field label="黑白对比" value={layer.contrast} min={0} max={4} step={0.01} disabled={layer.locked} onChange={v => update({ contrast: v }, 'contrast')}/>
          <Field label="明暗偏移" value={layer.bias} min={-1} max={1} step={0.01} disabled={layer.locked} onChange={v => update({ bias: v }, 'bias')}/>
          <Toggle label="反转黑白" checked={layer.invert} disabled={layer.locked} onChange={v => update({ invert: v })}/>
          <div className="material-seed"><span>随机种子</span><input aria-label="随机种子" type="number" value={layer.seed} disabled={layer.locked} min={0} max={4294967295} onChange={e => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 0 && v <= 4294967295) update({ seed: v }, 'seed'); }}/></div>
          <div className="material-divider"/>
          <SelectField label="图层混合" value={layer.blend} disabled={layer.locked} onChange={v => update({ blend: v as HeightLayer['blend'] })}><option value="replace">替换 / 混合</option><option value="add">叠加细节</option><option value="multiply">正片叠底</option><option value="max">变亮</option></SelectField>
          <Field label="图层权重" value={layer.opacity} min={0} max={1} step={0.01} disabled={layer.locked} onChange={v => update({ opacity: v }, 'opacity')}/>
        </section> : <section><p className="material-help">选择预设或添加纹理图层开始制作。</p></section>}
        <section><h2>素材输出</h2>
          <SelectField label="背景方式" value={p.export.background} onChange={v => s.edit(p => { p.export.background = v as typeof p.export.background; })}><option value="white">不透明黑白</option><option value="transparent">透明底叠加</option></SelectField>
          {p.export.background==='transparent'&&<SelectField label="透明纹理颜色" value={p.export.pigment} onChange={v=>s.edit(p=>{p.export.pigment=v as 'black'|'white';})}><option value="black">黑色 · 加深纹理</option><option value="white">白色 · 增加柔光</option></SelectField>}
          <Toggle label="启用法线输出" checked={p.export.maps !== 'height'} onChange={v => s.edit(p => { p.export.maps = v ? 'both' : 'height'; })}/>
          <p className="material-help">黑白图可用于平面设计、蒙版或高度。透明版可保留黑色纹理或白色光晕。</p>
        </section>
        {p.export.maps !== 'height' && <section><h2>法线贴图</h2>
          <Field label="法线强度" value={p.normal.strength} min={0} max={2} step={0.01} onChange={v => s.edit(p => { p.normal.strength = v; }, 'normal')}/>
          <SelectField label="法线格式" value={p.normal.convention} onChange={v => s.edit(p => { p.normal.convention = v as typeof p.normal.convention; })}><option value="opengl">OpenGL · +Y</option><option value="directx">DirectX · −Y</option></SelectField>
          <p className="material-help">只改变方向与凹凸强度，黑白纹理保持不变。</p>
        </section>}
      </aside>
    </div>
    {exportOpen && <MaterialExportPanel onClose={() => setExportOpen(false)}/>}
  </div>;
}
