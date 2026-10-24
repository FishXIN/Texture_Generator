import { Copy, LockKeyhole, Shuffle, Trash2, UnlockKeyhole } from 'lucide-react';
import { Field, SelectField, Toggle } from '@/shared/ui/StudioFields';
import { useProjectStore } from './store';
import { uid } from './model';
import type { Layer, RandomPart } from './model';

export function Inspector({advanced,onAdvanced}:{advanced:boolean;onAdvanced:(v:boolean)=>void}) {
  const s=useProjectStore(); const p=s.project;const layer=p.layers.find(l=>l.id===s.selectedLayer);
  const object=p.objects.find(o=>o.id===s.selectedObject);
  const update=(patch:Partial<Layer>,group?:string)=>s.updateLayer(patch,group);
  const resize=(dimension:'width'|'height',value:number)=>s.edit(p=>{
    const ratio=value/p.canvas[dimension];
    for(const layer of p.layers) {
      if(dimension==='width'){layer.mask.x*=ratio;layer.mask.width*=ratio;}
      else {layer.mask.y*=ratio;layer.mask.height*=ratio;}
    }
    p.canvas[dimension]=value;const r=p.export.selection;
    r.x=Math.min(r.x,p.canvas.width-1);r.y=Math.min(r.y,p.canvas.height-1);
    r.width=Math.min(r.width,p.canvas.width-r.x);r.height=Math.min(r.height,p.canvas.height-r.y);
  },`canvas-${dimension}`);
  return <aside className="inspector">
    <div className="panel-heading"><h2>参数</h2><button className={advanced?'text-button active':'text-button'} onClick={()=>onAdvanced(!advanced)}>{advanced?'精细模式':'快速模式'}</button></div>
    <section className="inspector-section">
      <h3>画布</h3><div className="dimension-fields">
        <label>宽 <input aria-label="画布宽度" type="number" min="64" max="4096" value={p.canvas.width} onChange={e=>{const v=Number(e.target.value);if(v>=64&&v<=4096)resize('width',Math.round(v));}}/></label>
        <span>×</span><label>高 <input aria-label="画布高度" type="number" min="64" max="4096" value={p.canvas.height} onChange={e=>{const v=Number(e.target.value);if(v>=64&&v<=4096)resize('height',Math.round(v));}}/></label>
      </div>
      <Toggle label="无缝平铺" checked={p.canvas.seamless} onChange={v=>s.edit(p=>{p.canvas.seamless=v;})}/>
      <Toggle label="显示背景层" checked={p.background.visible} onChange={v=>s.edit(p=>{p.background.visible=v;})}/>
      <label className="color-field">背景颜色<input aria-label="背景颜色" type="color" value={p.background.color} onChange={e=>s.edit(p=>{p.background.color=e.target.value;},'background-color')}/><span>{p.background.color}</span></label>
    </section>
    {object&&<section className="inspector-section">
      <div className="section-heading"><h3>手工图形</h3><div className="icon-row">
        <button className="icon-button" title="复制图形" onClick={()=>{if(p.objects.length>=2000)return;s.edit(p=>{p.objects.push({...object,id:uid(),x:object.x+16,y:object.y+16,locked:false});});}}><Copy size={14}/></button>
        <button className="icon-button" title="删除图形" disabled={object.locked||layer?.locked} onClick={()=>{s.edit(p=>{p.objects=p.objects.filter(o=>o.id!==object.id);});s.selectObject(null);}}><Trash2 size={14}/></button>
      </div></div>
      <Toggle label="锁定图形" checked={object.locked} onChange={v=>s.edit(p=>{const o=p.objects.find(o=>o.id===object.id);if(o)o.locked=v;})} disabled={layer?.locked}/>
      <Toggle label="锁定运动" checked={object.motionLocked} onChange={v=>s.edit(p=>{const o=p.objects.find(o=>o.id===object.id);if(o)o.motionLocked=v;})} disabled={object.locked||layer?.locked}/>
      <div className="object-fields">
        {(['x','y','width','height','rotation','opacity'] as const).map(key=><Field key={key}
          label={{x:'位置 X',y:'位置 Y',width:'图形宽度',height:'图形高度',rotation:'图形旋转',opacity:'图形透明度'}[key]}
          value={object[key]} min={key==='rotation'?-360:key==='width'||key==='height'?0.2:0}
          max={key==='x'?p.canvas.width:key==='y'?p.canvas.height:key==='rotation'?360:key==='opacity'?1:2048}
          step={key==='opacity'?0.01:1} disabled={object.locked||layer?.locked}
          onChange={v=>s.edit(p=>{const o=p.objects.find(o=>o.id===object.id);if(o)o[key]=v;},`object-${object.id}-${key}`)}/>)}
      </div>
      <label className="color-field">图形颜色<input aria-label="图形颜色" type="color" value={object.color||'#33382b'} disabled={object.locked||layer?.locked}
        onChange={e=>s.edit(p=>{const o=p.objects.find(o=>o.id===object.id);if(o)o.color=e.target.value;},'object-color')}/><button className="text-button" disabled={object.locked||layer?.locked} onClick={()=>s.edit(p=>{const o=p.objects.find(o=>o.id===object.id);if(o)o.color='';})}>原色</button></label>
    </section>}
    {layer?<>
      <section className="inspector-section">
        <div className="section-heading"><h3>{layer.name}</h3>{layer.locked&&<LockKeyhole size={14}/>}</div>
        <fieldset disabled={layer.locked}>
          <SelectField label="基本图形" value={layer.shape} onChange={v=>update({shape:v as Layer['shape']})}>
            <option value="circle">圆点</option><option value="ellipse">椭圆</option><option value="line">短线</option><option value="chip">碎片</option><option value="custom">自定义 SVG</option>
          </SelectField>
          <Field label="颗粒密度" value={layer.count} min={0} max={Math.min(5000,20000-p.layers.filter(l=>l.id!==layer.id).reduce((sum,l)=>sum+l.count,0))}
            onChange={v=>update({count:v},'count')} unit="个"/>
          <Field label="最小尺寸" value={layer.minSize} min={0.2} max={512} step={0.2}
            onChange={v=>update({minSize:v,maxSize:Math.max(v,layer.maxSize)},'minSize')} unit="px"/>
          <Field label="最大尺寸" value={layer.maxSize} min={layer.minSize} max={512} step={0.2} onChange={v=>update({maxSize:v},'maxSize')} unit="px"/>
          <Field label="图层透明度" value={layer.opacity} min={0} max={1} step={0.01} onChange={v=>update({opacity:v},'opacity')}/>
          <label className="color-field">颗粒颜色<input aria-label="颗粒颜色" type="color" value={layer.color} onChange={e=>update({color:e.target.value},'layer-color')}/><span>{layer.color}</span></label>
          <SelectField label="排列方式" value={layer.distribution} onChange={v=>update({distribution:v as Layer['distribution']})}>
            <option value="random">随机散布</option><option value="grid">网格排列</option><option value="stagger">错位排列</option><option value="cluster">聚集排列</option>
          </SelectField>
          <Field label="随机旋转" value={layer.rotationRange} min={0} max={180} onChange={v=>update({rotationRange:v},'rotationRange')} unit="°"/>
          {layer.shape==='custom'&&<>
            <p className="field-hint">在左侧素材中选择用于散布的 SVG，比例为 0 时不参与生成。</p>
            {p.assets.map(a=><label className="weight-field" key={a.id}><span>{a.name}</span><input aria-label={`${a.name}出现比例`} type="number" min="0" max="100" value={layer.assets.find(x=>x.id===a.id)?.weight??0}
              onChange={e=>{const value=Math.max(0,Math.min(100,Number(e.target.value)));update({assets:[...layer.assets.filter(x=>x.id!==a.id),{id:a.id,weight:value}]});}}/></label>)}
          </>}
          {advanced&&<>
            <Field label="基础角度" value={layer.rotation} min={-360} max={360} onChange={v=>update({rotation:v},'rotation')} unit="°"/>
            <Field label="最小间距" value={layer.spacing} min={0} max={100} onChange={v=>update({spacing:v},'spacing')} unit="px"/>
            <Field label="排列扰动" value={layer.jitter} min={0} max={1} step={0.01} onChange={v=>update({jitter:v},'jitter')}/>
            <Field label="聚集程度" value={layer.cluster} min={0} max={1} step={0.01} onChange={v=>update({cluster:v},'cluster')}/>
            <Field label="疏密渐变" value={layer.gradient} min={-1} max={1} step={0.01} onChange={v=>update({gradient:v},'gradient')}/>
            <Field label="分布方向" value={layer.direction} min={-360} max={360} onChange={v=>update({direction:v},'direction')} unit="°"/>
            <SelectField label="混合模式" value={layer.blend} onChange={v=>update({blend:v as Layer['blend']})}>
              <option value="normal">正常</option><option value="multiply">正片叠底</option><option value="screen">滤色</option><option value="overlay">叠加</option><option value="color-burn">颜色加深</option>
            </SelectField>
          </>}
        </fieldset>
      </section>
      <section className="inspector-section">
        <div className="section-heading"><h3>随机与锁定</h3><button className="text-button" disabled={layer.locked} onClick={()=>s.randomize()}><Shuffle size={13}/>换一个</button></div>
        {(['position','size','rotation','color'] as RandomPart[]).map(part=><div className="seed-row" key={part}>
          <span>{{position:'分布',size:'尺寸',rotation:'角度',color:'颜色'}[part]}</span>
          <input aria-label={`${part}种子`} type="number" min="0" max={2**32-1} value={layer.seeds[part]} disabled={layer.locked}
            onChange={e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=0&&v<2**32)update({seeds:{...layer.seeds,[part]:v}});}}/>
          <button className="icon-button" aria-label={`锁定${part}参数`} aria-pressed={layer.locks[part]} disabled={layer.locked}
            onClick={()=>update({locks:{...layer.locks,[part]:!layer.locks[part]}})}>{layer.locks[part]?<LockKeyhole size={13}/>:<UnlockKeyhole size={13}/>}</button>
          <button className="icon-button" title={`随机${part}`} disabled={layer.locked||layer.locks[part]} onClick={()=>s.randomize(part)}><Shuffle size={13}/></button>
        </div>)}
      </section>
      {advanced&&<section className="inspector-section">
        <h3>蒙版与避让</h3><Toggle label="启用蒙版" checked={layer.mask.enabled} onChange={v=>update({mask:{...layer.mask,enabled:v}})} disabled={layer.locked}/>
        {layer.mask.enabled&&<fieldset disabled={layer.locked}>
          <SelectField label="蒙版形状" value={layer.mask.kind} onChange={v=>update({mask:{...layer.mask,kind:v as Layer['mask']['kind'],assetId:layer.mask.assetId||p.assets[0]?.id||''}})}>
            <option value="rect">矩形</option><option value="ellipse">圆形 / 椭圆</option><option value="svg">SVG 轮廓</option>
          </SelectField>
          <SelectField label="生成范围" value={layer.mask.mode} onChange={v=>update({mask:{...layer.mask,mode:v as 'inside'|'outside'}})}>
            <option value="inside">仅在蒙版内</option><option value="outside">避开蒙版</option>
          </SelectField>
          {layer.mask.kind==='svg'&&<SelectField label="轮廓素材" value={layer.mask.assetId} onChange={v=>update({mask:{...layer.mask,assetId:v}})}><option value="">选择 SVG</option>{p.assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</SelectField>}
          {(['x','y','width','height'] as const).map(key=><Field key={key} label={{x:'蒙版 X',y:'蒙版 Y',width:'蒙版宽度',height:'蒙版高度'}[key]}
            value={layer.mask[key]} min={key==='width'||key==='height'?1:0} max={key==='x'||key==='width'?p.canvas.width:p.canvas.height}
            onChange={v=>update({mask:{...layer.mask,[key]:v}},`mask-${key}`)} unit="px"/>)}
        </fieldset>}
      </section>}
      <section className="inspector-section">
        <h3>循环运动</h3><Toggle label="启用运动" checked={layer.motion.enabled} onChange={v=>update({motion:{...layer.motion,enabled:v}})} disabled={layer.locked}/>
        {layer.motion.enabled&&<fieldset disabled={layer.locked}>
          <SelectField label="运动方式" value={layer.motion.kind} onChange={v=>update({motion:{...layer.motion,kind:v as Layer['motion']['kind']}})}>
            <option value="wander">局部游动</option><option value="drift">整体漂移</option><option value="flow">方向流动</option><option value="rotate">缓慢旋转</option><option value="breathe">轻微呼吸</option>
          </SelectField>
          <Field label="运动幅度" value={layer.motion.amplitude} min={0} max={256} onChange={v=>update({motion:{...layer.motion,amplitude:v}},'amplitude')}/>
          <Field label="运动方向" value={layer.motion.direction} min={-360} max={360} onChange={v=>update({motion:{...layer.motion,direction:v}},'motion-direction')} unit="°"/>
          <Field label="循环次数" value={layer.motion.cycles} min={1} max={10} onChange={v=>update({motion:{...layer.motion,cycles:v}},'cycles')}/>
          {p.canvas.seamless&&['drift','flow'].includes(layer.motion.kind)&&<p className="field-hint">平铺漂移按整数个单元循环，方向吸附为 8 个方向；速度由时长和次数控制。</p>}
        </fieldset>}
        <Field label="循环时长" value={p.animation.duration} min={1} max={30} step={0.5} onChange={v=>s.edit(p=>{p.animation.duration=v;},'duration')} unit="秒"/>
      </section>
    </>:<p className="empty-hint">添加或选择一个图层，开始生成纹理。</p>}
  </aside>;
}
