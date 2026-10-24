import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, LockKeyhole, Plus, Trash2, UnlockKeyhole, Upload } from 'lucide-react';
import { duplicateLayer, useProjectStore } from './store';
import { clone, presets, presetProject, uid } from './model';
import type { Project } from './model';
import { importSvg, svgDataUrl } from '@/features/assets/svg';
import { parseProject, saveBlob } from './io';

export function Library({onPreset,onPlace}:{onPreset:()=>void;onPlace:()=>void}) {
  const s=useProjectStore();const p=s.project;const input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);const [tab,setTab]=useState<'layers'|'presets'>('layers');
  const [saved,setSaved]=useState<{name:string;project:Project}[]>(()=>{
    try{return JSON.parse(localStorage.getItem('texture-presets')??'[]').map((entry:{name:string;project:Project})=>({...entry,project:parseProject(JSON.stringify(entry.project))}));}catch{return [];}
  });
  const place=(assetId:string)=>{
    if(p.objects.length>=2000){s.message('最多 2,000 个手工图形，请先删除部分对象。');return;}
    const layer=p.layers.find(l=>l.id===s.selectedLayer);
    if(!layer){s.message('请先添加一个图层。');return;}if(layer.locked){s.message('请先解锁当前图层。');return;}
    const asset=p.assets.find(a=>a.id===assetId)!;const id=uid();const longest=Math.max(asset.width,asset.height);
    s.edit(p=>{p.objects.push({id,layerId:layer.id,assetId,x:p.canvas.width/2,y:p.canvas.height/2,
      width:Math.max(0.2,64*asset.width/longest),height:Math.max(0.2,64*asset.height/longest),
      rotation:0,opacity:1,color:'',locked:false,motionLocked:true});});
    s.selectObject(id);onPlace();s.message('已放置 SVG，拖动画布上的图形可调整位置。');
  };
  const upload=async(files:File[])=>{
    if(busy)return;setBusy(true);
    try {
      for(const file of files) {
        if(useProjectStore.getState().project.assets.length>=32)throw new Error('最多导入 32 个 SVG 素材。');
        const asset=await importSvg(file);
        const current=useProjectStore.getState().project;
        if(new Blob([JSON.stringify({...current,assets:[...current.assets,asset]},null,2)]).size>25_000_000)throw new Error('导入后项目超过 25 MB，请先移除部分 SVG 素材。');
        s.edit(p=>{p.assets.push(asset);});
        s.message(asset.issues.length?`已导入 ${asset.name}：${asset.issues.join('；')}`:`已导入 ${asset.name}`);
      }
    }catch(e){s.message(e instanceof Error?e.message:'导入失败');}finally{setBusy(false);if(input.current)input.current.value='';}
  };
  const mutateLayer=(id:string,mutate:(p:Project)=>void)=>{
    const target=p.layers.find(l=>l.id===id);if(!target)return;s.edit(mutate);
  };
  const savePreset=()=>{
    const project=clone(p);project.objects=[];
    const next=[...saved,{name:p.name,project}].slice(-12);
    try{localStorage.setItem('texture-presets',JSON.stringify(next));setSaved(next);s.message('已保存参数预设，不包含手工摆放。');}
    catch{s.message('本地预设空间不足，请导出项目文件保存。');}
  };
  return <aside className="library">
    <div className="library-tabs"><button className={tab==='layers'?'active':''} onClick={()=>setTab('layers')}>图层与素材</button><button className={tab==='presets'?'active':''} onClick={()=>setTab('presets')}>预设</button></div>
    {tab==='presets'?<div className="preset-list">
      <p className="library-caption">从一种质感开始，再调整成自己的纹理。</p>
      {presets.map(preset=><button className="preset-button" key={preset.id} onClick={()=>{s.replace(presetProject(preset.id));onPreset();s.message(`已应用 ${preset.name}，可撤销恢复上一作品。`);}}>
        <span className={`preset-swatch swatch-${preset.id}`}/><span><strong>{preset.name}</strong><small>{preset.description}</small></span>
      </button>)}
      <button className="secondary-button wide" onClick={savePreset}><Plus size={14}/>保存当前参数为预设</button>
      {saved.length>0&&<p className="library-caption">我的预设</p>}
      {saved.map((preset,index)=><div className="saved-preset" key={index}>
        <button onClick={()=>{s.replace(clone(preset.project));onPreset();}}>{preset.name}</button>
        <button className="icon-button" title="删除预设" onClick={()=>{const next=saved.filter((_,i)=>i!==index);localStorage.setItem('texture-presets',JSON.stringify(next));setSaved(next);}}><Trash2 size={13}/></button>
      </div>)}
    </div>:<>
      <div className="panel-heading"><h2>图层</h2><button className="icon-button" title="添加图层" onClick={s.addLayer}><Plus size={16}/></button></div>
      <div className="layer-list">
        {[...p.layers].reverse().map(layer=><div key={layer.id} className={`layer-row ${s.selectedLayer===layer.id?'selected':''}`}>
          <button className="icon-button" title={layer.visible?'隐藏图层':'显示图层'} onClick={()=>mutateLayer(layer.id,p=>{p.layers.find(l=>l.id===layer.id)!.visible=!layer.visible;})}>{layer.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button>
          <button className="layer-select" onClick={()=>s.selectLayer(layer.id)}><span className="layer-dot" style={{background:layer.color}}/><span><strong>{layer.name}</strong><small>{layer.shape==='custom'?'自定义图形':`${layer.count} 个颗粒`} · {Math.round(layer.opacity*100)}%</small></span></button>
          <button className="icon-button" title={layer.locked?'解锁图层':'锁定图层'} onClick={()=>mutateLayer(layer.id,p=>{p.layers.find(l=>l.id===layer.id)!.locked=!layer.locked;})}>{layer.locked?<LockKeyhole size={13}/>:<UnlockKeyhole size={13}/>}</button>
        </div>)}
        <div className="layer-row background-row"><button className="icon-button" title="切换背景层" onClick={()=>s.edit(p=>{p.background.visible=!p.background.visible;})}>{p.background.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button><span className="layer-dot" style={{background:p.background.color}}/><span>背景层</span></div>
      </div>
      {p.layers.find(l=>l.id===s.selectedLayer)&&<div className="layer-tools">
        <input className="layer-name" aria-label="图层名称" value={p.layers.find(l=>l.id===s.selectedLayer)!.name} disabled={p.layers.find(l=>l.id===s.selectedLayer)!.locked} onChange={e=>s.updateLayer({name:e.target.value.slice(0,80)},'layer-name')}/>
        <div className="icon-row">
          <button className="icon-button" title="上移图层" disabled={p.layers.find(l=>l.id===s.selectedLayer)!.locked} onClick={()=>s.edit(p=>{const i=p.layers.findIndex(l=>l.id===s.selectedLayer);if(i<p.layers.length-1)[p.layers[i],p.layers[i+1]]=[p.layers[i+1],p.layers[i]];})}><ArrowUp size={14}/></button>
          <button className="icon-button" title="下移图层" disabled={p.layers.find(l=>l.id===s.selectedLayer)!.locked} onClick={()=>s.edit(p=>{const i=p.layers.findIndex(l=>l.id===s.selectedLayer);if(i>0)[p.layers[i],p.layers[i-1]]=[p.layers[i-1],p.layers[i]];})}><ArrowDown size={14}/></button>
          <button className="icon-button" title="复制图层" onClick={()=>duplicateLayer(s.selectedLayer)}><Copy size={14}/></button>
          <button className="icon-button" title="删除图层" disabled={p.layers.find(l=>l.id===s.selectedLayer)!.locked} onClick={()=>{const id=s.selectedLayer;s.edit(p=>{p.layers=p.layers.filter(l=>l.id!==id);p.objects=p.objects.filter(o=>o.layerId!==id);});s.selectLayer(useProjectStore.getState().project.layers.at(-1)?.id??'');}}><Trash2 size={14}/></button>
        </div>
      </div>}
      <div className="panel-heading assets-heading"><h2>SVG 素材</h2><button className="icon-button" title="导入 SVG" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/></button></div>
      <input ref={input} type="file" accept=".svg,image/svg+xml" multiple hidden onChange={e=>upload([...e.target.files??[]])}/>
      <div className="asset-list" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload([...e.dataTransfer.files]);}}>
        {!p.assets.length&&<button className="asset-drop" disabled={busy} onClick={()=>input.current?.click()}><Plus size={20}/><strong>{busy?'正在导入…':'导入自定义 SVG'}</strong><span>点击选择，或拖入文件</span></button>}
        {p.assets.map(asset=><div className="studio-asset" key={asset.id}>
          <button className="asset-preview" title={`放置 ${asset.name}`} onClick={()=>place(asset.id)}><img src={svgDataUrl(asset.svg)} alt={asset.name}/></button>
          <div className="asset-meta"><strong title={asset.name}>{asset.name}</strong><small>{asset.pure?'矢量图形':'包含复杂效果'}</small>
            <div className="asset-actions"><button onClick={()=>place(asset.id)}>放置</button>
              <button disabled={p.layers.find(l=>l.id===s.selectedLayer)?.locked||!s.selectedLayer} onClick={()=>{s.updateLayer({shape:'custom',assets:[{id:asset.id,weight:1}]});s.message('已将 SVG 设为当前层的散布元素');}}>散布</button>
              <button title="下载原始素材" onClick={()=>saveBlob(new Blob([asset.original],{type:'image/svg+xml'}),asset.name,'svg')}>原始</button>
            </div>
          </div>
          <button className="icon-button" title="移除素材" disabled={p.layers.some(l=>l.locked&&(l.assets.some(a=>a.id===asset.id)||l.mask.assetId===asset.id||p.objects.some(o=>o.assetId===asset.id&&o.layerId===l.id)))||p.objects.some(o=>o.locked&&o.assetId===asset.id)}
            onClick={()=>s.edit(p=>{p.assets=p.assets.filter(a=>a.id!==asset.id);p.objects=p.objects.filter(o=>o.assetId!==asset.id);
              for(const l of p.layers){l.assets=l.assets.filter(a=>a.id!==asset.id);if(l.mask.assetId===asset.id){l.mask.assetId='';l.mask.enabled=false;}}})}><Trash2 size={12}/></button>
          {asset.issues.length>0&&<details className="asset-issues"><summary>{asset.issues.length} 项导入说明</summary>{asset.issues.map(issue=><p key={issue}>{issue}</p>)}</details>}
        </div>)}
      </div>
      {p.assets.length>0&&<button className="text-button add-asset" disabled={busy} onClick={()=>input.current?.click()}><Plus size={13}/>{busy?'正在导入…':'继续导入 SVG'}</button>}
    </>}
    <div className="library-bottom"><span className="local-dot"/>本地创作 · 素材不上传</div>
  </aside>;
}
