import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Download, Eye, EyeOff, ImagePlus, Layers, LockKeyhole, MoreHorizontal, Pause, Play, Plus, Redo2, Shuffle, Trash2, Undo2, UnlockKeyhole, Upload } from 'lucide-react';
import { Field, SelectField, Toggle } from '@/shared/ui/StudioFields';
import { saveBlob } from '@/features/project/io';
import { generators, generatorControls, presetGroups, heightLayer, materialId, materialPresets, newMaterial, parseMaterial } from './model';
import type { Generator, HeightLayer, HeightSource } from './model';
import { useMaterialStore } from './store';
import { decodeSource, importHeight } from './import';
import { renderMaterial } from './engine';
import { MapView } from './TexturePreview';
import { MaterialExportPanel } from './MaterialExportPanel';
import { materialFilename } from './export';
import { MaterialLayerTools } from './MaterialLayerTools';
import { createParticles } from './particles';
import { frac, torusDistance } from './algorithms';
import { useMaterialPreview } from './useMaterialPreview';
import './material.css';

function SourceThumbnail({source}:{source:HeightSource}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let active=true;
    decodeSource(source).then(s=>{
      if(!active||!ref.current||!s.rgba)return;
      const image=document.createElement('canvas');image.width=s.width;image.height=s.height;
      image.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(s.rgba),s.width,s.height),0,0);
      const ctx=ref.current.getContext('2d')!,ratio=48/Math.max(s.width,s.height),w=s.width*ratio,h=s.height*ratio;
      ctx.clearRect(0,0,48,48);ctx.drawImage(image,(48-w)/2,(48-h)/2,w,h);
    }).catch(()=>{});
    return()=>{active=false;};
  },[source.id]);
  return <canvas width={48} height={48} ref={ref} aria-label={source.name}/>;
}

export function MaterialStudio({onOpenPattern}:{onOpenPattern:(text:string)=>void}) {
  const s=useMaterialStore(),p=s.project,layer=p.layers.find(l=>l.id===s.selected);
  const [category,setCategory]=useState<keyof typeof presetGroups>('all'),[search,setSearch]=useState('');
  const [library,setLibrary]=useState<'textures'|'assets'>('textures');
  const [exportOpen,setExportOpen]=useState(false),[menu,setMenu]=useState(false),[saving,setSaving]=useState(false),[importing,setImporting]=useState(false);
  const [recovery,setRecovery]=useState(false),[tiled,setTiled]=useState(false),[checkBackground,setCheckBackground]=useState('checker');
  const [playing,setPlaying]=useState(false),clock=useRef(0);
  const {maps,error}=useMaterialPreview(playing,clock);
  const openInput=useRef<HTMLInputElement>(null),sourceInput=useRef<HTMLInputElement>(null);
  const importTarget=useRef<'background'|'elements'|'reference'>('elements');
  const drag=useRef<{id:string;dx:number;dy:number}|null>(null);
  const previews=useMemo(()=>materialPresets.map(entry=>renderMaterial(newMaterial(entry.id),48)),[]);
  const filtered=materialPresets.map((entry,i)=>({entry,preview:previews[i]})).filter(({entry})=>
    (category==='all'||entry.group===category)&&`${entry.name}${entry.subtitle}`.includes(search.trim()));
  const controls=layer?generatorControls[layer.kind]:null;
  const asset=layer?.role!=='texture',discrete=layer&&['particles','spray','dust','sand'].includes(layer.kind);
  const animated=p.layers.some(l=>l.visible&&l.motion!=='none'&&!l.motionLocked);
  const update=(patch:Partial<HeightLayer>,group?:string)=>s.updateLayer(patch,group?`${s.selected}:${group}`:undefined);
  useEffect(()=>{
    try{setRecovery(!!localStorage.getItem('texture-material-recovery'));}catch{}
    if(window.electron?.platform==='darwin')document.documentElement.dataset.desktop='mac';
  },[]);
  useEffect(()=>{
    if(!s.revision)return;
    const timer=setTimeout(()=>{try{localStorage.setItem('texture-material-recovery',JSON.stringify(p));}catch{s.message('请保存项目，恢复空间已满');}},700);
    return()=>clearTimeout(timer);
  },[p,s.revision]);
  useEffect(()=>{
    if(!s.notice)return;
    const timer=setTimeout(()=>s.message(''),4500);return()=>clearTimeout(timer);
  },[s.notice]);
  const save=async()=>{
    if(saving)return;setSaving(true);
    try{
      const current=useMaterialStore.getState().project,blob=new Blob([JSON.stringify(current,null,2)],{type:'application/json'});
      if(blob.size>25_000_000)throw new Error('项目超过 25 MB，请减少素材');
      const result=await saveBlob(blob,`${materialFilename(current)}.material.json`,'json');
      s.message(result.canceled?'已取消保存':'项目已保存');
    }catch(e){s.message((e as Error).message);}finally{setSaving(false);}
  };
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(exportOpen||['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName)||!(e.metaKey||e.ctrlKey))return;
      if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?s.redo():s.undo();}
      else if(e.key.toLowerCase()==='s'){e.preventDefault();void save();}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[exportOpen,saving]);
  const open=async(file?:File)=>{
    if(!file)return;
    try{
      if(file.size>25_000_000)throw new Error('项目超过 25 MB');
      const text=await file.text();
      if(JSON.parse(text).kind==='surface-material')s.replace(parseMaterial(text));else onOpenPattern(text);
      s.message('项目已打开');
    }catch(e){s.message((e as Error).message);}
    finally{if(openInput.current)openInput.current.value='';}
  };
  const chooseUpload=(target:typeof importTarget.current)=>{importTarget.current=target;if(sourceInput.current){sourceInput.current.multiple=target==='elements';sourceInput.current.click();}};
  const importFiles=async(files:File[])=>{
    if(!files.length||importing)return;
    const target=importTarget.current;setImporting(true);
    try{
      const incoming=await Promise.all(files.map(importHeight)),current=useMaterialStore.getState().project;
      if(current.sources.length+incoming.length>16||current.layers.length>=16&&target!=='reference')throw new Error('最多 16 个素材、16 个图层');
      if(JSON.stringify(current).length+incoming.reduce((n,v)=>n+v.source.original.length,0)>24_000_000)throw new Error('导入后项目超过 25 MB');
      const source=incoming[0].source;
      const l=target==='background'?heightLayer('image',{role:'background',name:'背景',sourceId:source.id,contrast:1,warp:0,tileSource:false}):
        heightLayer('particles',{role:'elements',name:incoming.length>1?'上传元素':source.name.replace(/\.[^.]+$/,''),sourceId:source.id,shape:'custom',
          sourceMix:incoming.map(v=>({id:v.source.id,weight:1})),count:60,sizeMin:.025,sizeMax:.06,contrast:1,softness:0,warp:0});
      s.edit(p=>{
        p.sources.push(...incoming.map(v=>v.source));
        if(target==='background'){
          const old=p.layers.find(v=>v.role==='background'&&!v.locked);
          if(old){l.id=old.id;p.layers[p.layers.indexOf(old)]=l;}else p.layers.unshift(l);
          p.canvas={width:source.width,height:source.height};
        }else if(target==='elements')p.layers.push(l);
        else{
          const selected=p.layers.find(v=>v.id===s.selected);
          if(!selected||selected.locked)throw new Error('请先选择未锁定的图层');
          selected.sourceId=source.id;if(selected.kind==='particles')selected.shape='custom';
        }
      });
      if(target!=='reference')s.select(l.id);
      setLibrary('assets');s.message(incoming.flatMap(v=>v.warnings).join('；')||'素材已添加');
    }catch(e){s.message((e as Error).message);}
    finally{setImporting(false);if(sourceInput.current)sourceInput.current.value='';}
  };
  const applyPreset=(id:string,add=false)=>{
    const preset=newMaterial(id),current=useMaterialStore.getState().project;
    const replaced=!add&&layer?.role==='texture'&&!layer.locked?layer.id:'';
    const remaining=current.layers.length-(replaced?1:0);
    if(remaining+preset.layers.length>16){s.message('最多 16 个图层');return;}
    s.edit(p=>{
      const index=replaced?p.layers.findIndex(l=>l.id===replaced):p.layers.length;
      const aboveArtwork=p.layers.slice(0,index).some(l=>l.role!=='texture');
      const layers=preset.layers.map((l,i)=>({...l,blend:i===0&&aboveArtwork?'multiply' as const:l.blend}));
      p.layers.splice(index,replaced?1:0,...layers);
      if(!p.sources.length)p.export.pigment=preset.export.pigment;
    });s.select(preset.layers[0].id);
  };
  const remove=(l:HeightLayer)=>{
    if(l.locked)return;s.edit(p=>{p.layers=p.layers.filter(v=>v.id!==l.id);});
    s.select(useMaterialStore.getState().project.layers.at(-1)?.id??'');
  };
  const move=(offset:number)=>{
    if(!layer||layer.locked)return;s.edit(p=>{
      const i=p.layers.findIndex(l=>l.id===layer.id),j=i+offset;
      if(j>=0&&j<p.layers.length)[p.layers[i],p.layers[j]]=[p.layers[j],p.layers[i]];
    });
  };
  return <div className="material-studio">
    <header className="material-header">
      <h1>纹理工作台</h1>
      <input className="material-project-title" aria-label="纹理项目名称" value={p.name} onChange={e=>s.edit(p=>{p.name=e.target.value.slice(0,80);},'name')}/>
      <div className="material-header-actions">
        <button aria-label="撤销" title="撤销 ⌘Z" disabled={!s.past.length} onClick={s.undo}><Undo2 size={16}/></button>
        <button aria-label="重做" title="重做 ⇧⌘Z" disabled={!s.future.length} onClick={s.redo}><Redo2 size={16}/></button>
        <div className="material-menu">
          <button aria-label="项目菜单" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><MoreHorizontal size={19}/></button>
          {menu&&<div onClick={()=>setMenu(false)}>
            <button onClick={()=>{s.replace({...newMaterial(),name:'未命名纹理',layers:[]});}}>新建项目</button>
            <button onClick={()=>openInput.current?.click()}>打开项目</button>
            <button disabled={saving} onClick={save}>保存项目</button>
            <a href="?studio=pattern">打开旧版项目</a>
          </div>}
        </div>
        <button className="material-primary" onClick={()=>setExportOpen(true)}><Download size={15}/>导出</button>
      </div>
      <input hidden ref={openInput} aria-label="打开项目文件" type="file" accept=".json" onChange={e=>open(e.target.files?.[0])}/>
      <input hidden ref={sourceInput} aria-label="上传素材文件" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" onChange={e=>void importFiles([...e.target.files??[]])}/>
    </header>
    <div className="material-workspace">
      <aside className="material-library">
        <div className="material-upload-actions">
          <button disabled={importing} onClick={()=>chooseUpload('background')}><ImagePlus size={15}/>上传背景</button>
          <button disabled={importing} onClick={()=>chooseUpload('elements')}><Upload size={15}/>上传元素</button>
        </div>
        <div className="material-library-tabs" role="tablist" aria-label="素材库">
          <button role="tab" aria-selected={library==='textures'} onClick={()=>setLibrary('textures')}>纹理库</button>
          <button role="tab" aria-selected={library==='assets'} onClick={()=>setLibrary('assets')}>我的素材</button>
        </div>
        {library==='textures'?<>
          <div className="material-preset-filter"><input aria-label="搜索纹理预设" placeholder="搜索纹理" value={search} onChange={e=>setSearch(e.target.value)}/>
            <select aria-label="纹理分类" value={category} onChange={e=>setCategory(e.target.value as keyof typeof presetGroups)}>{Object.entries(presetGroups).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>
          <div className="material-presets">{filtered.map(({entry,preview})=><button key={entry.id} className="material-preset" title={`${entry.subtitle} · Shift 点击叠加`} onClick={e=>applyPreset(entry.id,e.shiftKey)}>
            <MapView maps={preview} label={`${entry.name}预设缩略图`}/><span>{entry.name.replace(/^\d+\s*/,'')}</span>
          </button>)}{!filtered.length&&<p className="material-help">没有匹配的纹理</p>}</div>
        </>:<div className="material-assets">
          {!p.sources.length&&<p className="material-help">上传图片或 SVG，和纹理一起使用。</p>}
          {p.sources.map(source=><button key={source.id} className="material-source" title="添加到画布" onClick={()=>{
            if(p.layers.length>=16){s.message('最多 16 个图层');return;}
            const l=heightLayer('particles',{role:'elements',name:source.name.replace(/\.[^.]+$/,''),sourceId:source.id,shape:'custom',count:40,sizeMin:.025,sizeMax:.06,contrast:1,warp:0});
            s.edit(p=>p.layers.push(l));s.select(l.id);
          }}><SourceThumbnail source={source}/><span>{source.name}</span><Plus size={13}/></button>)}
        </div>}
        <div className="material-layer-heading"><span>图层</span><button aria-label="添加纹理图层" onClick={s.addLayer}><Plus size={16}/></button></div>
        <div className="material-layer-list">{[...p.layers].reverse().map(l=><div key={l.id} className={`material-layer ${s.selected===l.id?'selected':''}`}>
          <button className="material-layer-name" onClick={()=>s.select(l.id)}>{l.role==='background'?<ImagePlus size={14}/>:l.role==='elements'?<Upload size={14}/>:<Layers size={14}/>}<span>{l.name}</span></button>
          <button aria-label={`${l.visible?'隐藏':'显示'} ${l.name}`} disabled={l.locked} onClick={()=>s.edit(p=>{p.layers.find(v=>v.id===l.id)!.visible=!l.visible;})}>{l.visible?<Eye size={13}/>:<EyeOff size={13}/>}</button>
          <button aria-label={`${l.locked?'解锁':'锁定'} ${l.name}`} onClick={()=>s.edit(p=>{p.layers.find(v=>v.id===l.id)!.locked=!l.locked;})}>{l.locked?<LockKeyhole size={13}/>:<UnlockKeyhole size={13}/>}</button>
        </div>)}</div>
        {layer&&<div className="material-layer-actions">
          <button aria-label="上移图层" disabled={layer.locked||p.layers.at(-1)?.id===layer.id} onClick={()=>move(1)}><ChevronUp size={14}/></button>
          <button aria-label="下移图层" disabled={layer.locked||p.layers[0]?.id===layer.id} onClick={()=>move(-1)}><ChevronDown size={14}/></button>
          <button aria-label="复制纹理图层" disabled={layer.locked||p.layers.length>=16} onClick={()=>{
            const l=structuredClone(layer);l.id=materialId();l.name=`${layer.name} 副本`;
            const seeds=new Map(createParticles(layer,0).map(o=>[o.id,o.outlineSeed]));
            l.objects=l.objects.map(o=>({...o,id:materialId(),outlineSeed:o.outlineSeed??seeds.get(o.id)}));
            s.edit(p=>p.layers.push(l));s.select(l.id);
          }}><Copy size={14}/></button>
          <button aria-label="删除纹理图层" disabled={layer.locked} onClick={()=>remove(layer)}><Trash2 size={14}/></button>
        </div>}
      </aside>
      <main className="material-center">
        <div className="material-view-toolbar">
          <details className="material-canvas-size"><summary>{p.canvas.width} × {p.canvas.height}<ChevronDown size={12}/></summary><div>
            {(['width','height'] as const).map(key=><label key={key}>{key==='width'?'宽':'高'}<input aria-label={`画布${key==='width'?'宽度':'高度'}`} type="number" min={1} max={8192} value={p.canvas[key]} onChange={e=>{
              const v=Number(e.target.value);if(Number.isInteger(v)&&v>=1&&v<=8192)s.edit(p=>{p.canvas[key]=v;},`canvas:${key}`);
            }}/></label>)}
          </div></details>
          <div className="material-tile-controls"><button className={tiled?'active':''} aria-pressed={tiled} onClick={()=>setTiled(v=>!v)}>平铺预览</button>
            {p.export.background==='transparent'&&<select aria-label="透明检查底色" value={checkBackground} onChange={e=>setCheckBackground(e.target.value)}><option value="checker">棋盘格</option><option value="light">白底</option><option value="dark">黑底</option></select>}
          </div>
        </div>
        {recovery&&<div className="material-recovery"><span>继续上次编辑？</span><button onClick={()=>{try{s.replace(parseMaterial(localStorage.getItem('texture-material-recovery')!));}catch(e){s.message((e as Error).message);}setRecovery(false);}}>恢复</button><button onClick={()=>setRecovery(false)}>关闭</button></div>}
        <div className="material-stage">
          <div className={`material-flat material-check-${checkBackground}`} onPointerDown={e=>{
            if(!layer||layer.locked||layer.distribution!=='manual'||playing||tiled||layer.motion!=='none')return;
            const rect=e.currentTarget.querySelector('canvas')!.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
            if(x<0||x>1||y<0||y>1)return;
            const item=createParticles(layer,0).reverse().find(o=>!o.locked&&torusDistance({x,y},o)<o.radius);
            if(item){drag.current={id:item.id,dx:frac(x-item.x+.5)-.5,dy:frac(y-item.y+.5)-.5};e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new Event('texture-range-start'));}
          }} onPointerMove={e=>{
            if(!drag.current||!layer||layer.locked)return;
            const rect=e.currentTarget.querySelector('canvas')!.getBoundingClientRect(),x=frac((e.clientX-rect.left)/rect.width-drag.current.dx),y=frac((e.clientY-rect.top)/rect.height-drag.current.dy),id=drag.current.id;
            s.edit(p=>{const o=p.layers.find(l=>l.id===layer.id)?.objects.find(o=>o.id===id);if(o&&!o.locked){o.x=x;o.y=y;}},`${id}:drag`);
          }} onPointerUp={()=>{if(drag.current)window.dispatchEvent(new Event('texture-range-end'));drag.current=null;}} onPointerCancel={()=>{if(drag.current)window.dispatchEvent(new Event('texture-range-end'));drag.current=null;}}>
            <MapView maps={maps} transparent={p.export.background==='transparent'} pigment={p.export.pigment} repeat={tiled?3:1} label="画布预览"/>
          </div>
          {!p.layers.length&&<div className="material-empty">选一个纹理，或上传自己的素材</div>}
          {error&&<div className="material-generation-error" role="alert">{error}</div>}
        </div>
        {animated&&<div className="material-timeline">
          <button aria-label={playing?'暂停纹理':'播放纹理'} onClick={()=>{
            if(!playing)clock.current=performance.now()-p.timeline.phase*p.timeline.duration*1000;
            else s.edit(p=>{p.timeline.phase=frac((performance.now()-clock.current)/1000/p.timeline.duration);},'phase');
            setPlaying(v=>!v);
          }}>{playing?<Pause size={14}/>:<Play size={14}/>}</button>
          <input aria-label="时间相位" type="range" min={0} max={.9999} step={.0001} value={p.timeline.phase} disabled={playing} onChange={e=>s.edit(p=>{p.timeline.phase=Number(e.target.value);},'phase')}/>
          <label><input aria-label="循环时长" type="number" min={.25} max={30} step={.25} value={p.timeline.duration} onChange={e=>{const v=Number(e.target.value);if(v>=.25&&v<=30)s.edit(p=>{p.timeline.duration=v;},'duration');}}/>秒循环</label>
        </div>}
        {s.notice&&<div className="material-notice" role="status">{s.notice}</div>}
      </main>
      <aside className="material-inspector">
        <div className="material-panel-heading"><span>调整</span>{layer&&layer.role!=='background'&&<button disabled={layer.locked} onClick={()=>update({seed:crypto.getRandomValues(new Uint32Array(1))[0]})}><Shuffle size={13}/>换一组</button>}</div>
        {layer?<section key={layer.id}>
          <h2>{layer.name}{layer.locked&&<LockKeyhole size={13}/>}</h2>
          {layer.role==='background'?<SelectField label="图片适配" value={layer.fit} disabled={layer.locked} onChange={v=>update({fit:v as HeightLayer['fit']})}><option value="fill">填满</option><option value="fit">完整显示</option><option value="tile">重复平铺</option></SelectField>:
            discrete?<><Field label="数量" value={layer.count} min={0} max={2000} disabled={layer.locked||layer.distribution==='manual'} onChange={v=>update({count:v},'count')}/>
              <Field label="大小" value={layer.sizeMax*100} min={.1} max={20} step={.1} unit="%" disabled={layer.locked} onChange={v=>update({sizeMin:v/100*.5,sizeMax:v/100,
                ...(layer.distribution==='manual'?{objects:layer.objects.map(o=>({...o,size:Math.max(.0001,Math.min(.4,o.size*v/100/layer.sizeMax))}))}:{})},'size')}/>
              <SelectField label="排列" value={layer.distribution} disabled={layer.locked} onChange={v=>{
                if(v==='manual'&&layer.distribution!=='manual')update({distribution:'manual',objects:createParticles(layer,0).map(o=>({...o,id:materialId()}))});
                else update({distribution:v as HeightLayer['distribution']});
              }}><option value="random">随机</option><option value="grid">网格</option><option value="stagger">错位</option><option value="cluster">聚集</option><option value="spaced">均匀疏散</option><option value="manual">手工</option>{!['random','grid','stagger','cluster','spaced','manual'].includes(layer.distribution)&&<option value={layer.distribution}>{({blue:'均匀',gradient:'渐变',radial:'放射',path:'路径',mirror:'镜像',kaleidoscope:'万花筒'} as Record<string,string>)[layer.distribution]}</option>}</SelectField>
            </>:<>
              {layer.kind!=='image'&&<Field label="尺度" value={layer.scale} min={1} max={64} disabled={layer.locked} onChange={v=>update({scale:v},'scale')}/>}
              {controls?.coverage&&<Field label="密度" value={layer.coverage*100} min={0} max={100} unit="%" disabled={layer.locked} onChange={v=>update({coverage:v/100},'coverage')}/>}
              <Field label="对比度" value={layer.contrast} min={0} max={4} step={.01} disabled={layer.locked} onChange={v=>update({contrast:v},'contrast')}/>
              <Field label="亮度" value={layer.bias} min={-1} max={1} step={.01} disabled={layer.locked} onChange={v=>update({bias:v},'bias')}/>
            </>}
          <Field label="不透明度" value={layer.opacity*100} min={0} max={100} unit="%" disabled={layer.locked} onChange={v=>update({opacity:v/100},'opacity')}/>
          <SelectField label="混合" value={layer.blend} disabled={layer.locked} onChange={v=>update({blend:v as HeightLayer['blend']})}><option value="replace">正常</option><option value="multiply">正片叠底</option><option value="add">叠加</option><option value="max">变亮</option></SelectField>
          <details className="material-advanced"><summary>更多调整</summary>
            {!asset&&<><SelectField label="纹理类型" value={layer.kind} disabled={layer.locked} onChange={v=>update({kind:v as Generator})}>{Object.entries(generators).filter(([k])=>k!=='image'||layer.sourceId).map(([id,name])=><option key={id} value={id}>{name}</option>)}</SelectField>
              {controls?.detail&&<Field label="细节" value={layer.detail} min={0} max={1} step={.01} disabled={layer.locked} onChange={v=>update({detail:v},'detail')}/>}
              {controls?.softness&&<Field label="柔和度" value={layer.softness} min={0} max={1} step={.01} disabled={layer.locked} onChange={v=>update({softness:v},'softness')}/>}
              <Field label="扰动" value={layer.warp} min={0} max={1} step={.01} disabled={layer.locked} onChange={v=>update({warp:v},'warp')}/>
              {controls?.octaves&&<Field label="细节层级" value={layer.octaves} min={1} max={6} disabled={layer.locked} onChange={v=>update({octaves:v},'octaves')}/>}
              {controls?.direction&&<SelectField label="方向" value={layer.direction} disabled={layer.locked} onChange={v=>update({direction:v as HeightLayer['direction']})}><option value="horizontal">横向</option><option value="vertical">纵向</option><option value="diagonal">斜向</option></SelectField>}
              <Toggle label="反转黑白" checked={layer.invert} disabled={layer.locked} onChange={v=>update({invert:v})}/>
            </>}
            {layer.role!=='background'&&<MaterialLayerTools layer={layer}/>}
            {layer.role!=='background'&&<label className="material-seed">随机种子<input aria-label="随机种子" type="number" min={0} max={4294967295} value={layer.seed} disabled={layer.locked} onChange={e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=0&&v<=4294967295)update({seed:v},'seed');}}/></label>}
            {layer.kind==='image'&&layer.role==='texture'&&<Toggle label="边缘融合" checked={layer.tileSource} disabled={layer.locked} onChange={v=>update({tileSource:v})}/>}
            {layer.role==='texture'&&<button className="material-reference" disabled={importing||layer.locked} onClick={()=>chooseUpload('reference')}><Upload size={13}/>上传蒙版或图形</button>}
          </details>
        </section>:<section><p className="material-help">选择图层后调整</p></section>}
        <section>
          <SelectField label="画布底色" value={p.export.background} onChange={v=>s.edit(p=>{p.export.background=v as typeof p.export.background;})}><option value="white">白色</option><option value="transparent">透明</option></SelectField>
          {p.export.background==='transparent'&&<SelectField label="纹理颜色" value={p.export.pigment} onChange={v=>s.edit(p=>{p.export.pigment=v as 'black'|'white';})}><option value="black">黑色</option><option value="white">白色</option></SelectField>}
        </section>
      </aside>
    </div>
    {exportOpen&&<MaterialExportPanel onClose={()=>setExportOpen(false)}/>}
  </div>;
}
