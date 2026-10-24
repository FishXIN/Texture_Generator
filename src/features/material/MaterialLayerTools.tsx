import { Field, SelectField, Toggle } from '@/shared/ui/StudioFields';
import { algorithms } from './algorithms';
import { createParticles } from './particles';
import { materialId, distributions, motions, particleShapes } from './model';
import type { HeightLayer, ManualObject } from './model';
import { useMaterialStore } from './store';
import { sampleSvgPath } from './import';

export function MaterialLayerTools({layer:l}:{layer:HeightLayer}) {
  const s=useMaterialStore(),p=s.project,disabled=l.locked;
  const update=(patch:Partial<HeightLayer>,group='')=>s.updateLayer(patch,group?`${l.id}:${group}`:undefined);
  const setObject=(id:string,patch:Partial<ManualObject>)=>{
    if(disabled)return;s.edit(p=>{const object=p.layers.find(v=>v.id===l.id)?.objects.find(o=>o.id===id);if(object&&!object.locked)Object.assign(object,patch);},`${id}:object`);
  };
  const particle=l.kind==='particles';
  const discrete=particle||['spray','dust','sand'].includes(l.kind);
  const usesInput=['film','oldphoto','copier','spray','airbrush','bleed','drybrush','pencil','charcoal','chalk','crayon','screen','stamp','wear','halftone','halftoneSquare','halftoneEllipse','halftoneLine','ditherRandom','ditherOrdered','glitch','compression','signal','particles'].includes(l.kind);
  return <>
    {discrete&&<details><summary>图形与分布</summary>
      {particle&&<SelectField label="图形形状" value={l.shape} disabled={disabled} onChange={v=>update({shape:v as HeightLayer['shape']})}>{Object.entries(particleShapes).map(([id,name])=><option key={id} value={id}>{name}</option>)}</SelectField>}
      {l.kind!=='spray'&&<SelectField label="分布方式" value={l.distribution} disabled={disabled} onChange={v=>update({distribution:v as HeightLayer['distribution']})}>{Object.entries(distributions).map(([id,name])=><option key={id} value={id}>{name}</option>)}</SelectField>}
      <Field label="图形数量" value={l.count} min={0} max={2000} disabled={disabled||l.distribution==='manual'} onChange={v=>update({count:v},'count')}/>
      <Field label="最小尺寸" value={l.sizeMin} min={.0001} max={.15} step={.0001} disabled={disabled} onChange={v=>update({sizeMin:v,sizeMax:Math.max(v,l.sizeMax)},'sizeMin')}/>
      <Field label="最大尺寸" value={l.sizeMax} min={.0001} max={.15} step={.0001} disabled={disabled} onChange={v=>update({sizeMax:v,sizeMin:Math.min(v,l.sizeMin)},'sizeMax')}/>
      <Field label="长宽比例" value={l.aspect} min={.1} max={5} step={.1} disabled={disabled} onChange={v=>update({aspect:v},'aspect')}/>
      <Field label="最小角度" value={l.angleMin} min={-180} max={360} disabled={disabled} onChange={v=>update({angleMin:v,angleMax:Math.max(v,l.angleMax)},'angleMin')}/>
      <Field label="最大角度" value={l.angleMax} min={-180} max={360} disabled={disabled} onChange={v=>update({angleMax:v,angleMin:Math.min(v,l.angleMin)},'angleMax')}/>
      <Field label="底层明度" value={l.baseGray} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({baseGray:v},'baseGray')}/>
      <Field label="最暗颗粒" value={l.grayMin} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({grayMin:v,grayMax:Math.max(v,l.grayMax)},'grayMin')}/>
      <Field label="最亮颗粒" value={l.grayMax} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({grayMax:v,grayMin:Math.min(v,l.grayMin)},'grayMax')}/>
      <Field label="最小透明度" value={l.alphaMin} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({alphaMin:v,alphaMax:Math.max(v,l.alphaMax)},'alphaMin')}/>
      <Field label="最大透明度" value={l.alphaMax} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({alphaMax:v,alphaMin:Math.min(v,l.alphaMin)},'alphaMax')}/>
      <Field label="图形边缘柔和" value={l.softness} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({softness:v},'softness')}/>
      {l.kind==='spray'&&<Field label="喷涂范围" value={l.coverage} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({coverage:v},'coverage')}/>}
      {l.distribution==='spaced'&&<Field label="中心最小间距" value={l.spacing} min={0} max={.2} step={.001} disabled={disabled} onChange={v=>update({spacing:v},'spacing')}/>}
      {(l.distribution==='radial'||l.distribution==='kaleidoscope')&&<>
        <Field label="中心 X" value={l.centerX} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({centerX:v},'centerX')}/>
        <Field label="中心 Y" value={l.centerY} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({centerY:v},'centerY')}/>
        {l.distribution==='kaleidoscope'&&<Field label="对称扇区" value={l.sectors} min={2} max={16} disabled={disabled} onChange={v=>update({sectors:v},'sectors')}/>}
      </>}
      {l.distribution==='path'&&<div className="material-path">
        {l.path.map((point,i)=><div className="material-point" key={i}><span>{i+1}</span>
          {(['x','y'] as const).map(key=><input key={key} aria-label={`路径 ${i+1} ${key.toUpperCase()}`} type="number" min={0} max={1} step={.01} value={point[key]} disabled={disabled} onChange={e=>{const value=Number(e.target.value);if(value>=0&&value<=1){const path=structuredClone(l.path);path[i][key]=value;update({path},'path');}}}/>)}
          <button disabled={disabled||l.path.length<=2} onClick={()=>update({path:l.path.filter((_,j)=>j!==i)})}>×</button></div>)}
        <button disabled={disabled||l.path.length>=128} onClick={()=>update({path:[...l.path,{x:.5,y:.5}]})}>添加路径节点</button>
        <SelectField label="读取 SVG 轮廓" value="" disabled={disabled} onChange={id=>{try{update({path:sampleSvgPath(p.sources.find(s=>s.id===id)!)});}catch(e){s.message((e as Error).message);}}}><option value="">选择已导入 SVG</option>{p.sources.filter(s=>s.mime==='image/svg+xml').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</SelectField>
      </div>}
      {particle&&<><button disabled={disabled} onClick={()=>{
        const objects=createParticles(l,0).map(({x,y,size,angle,aspect,gray,opacity,shape,sourceId,flipX,flipY,locked,motionLocked,outlineSeed})=>({id:materialId(),x,y,size,angle,aspect,gray,opacity,shape,sourceId,flipX,flipY,locked,motionLocked,outlineSeed}));
        update({distribution:'manual',objects});s.message('已转为手工图形，可在单元预览里拖动');
      }}>将当前分布转为手工对象</button>
      {l.distribution==='manual'&&<>
        <button disabled={disabled||l.objects.length>=2000} onClick={()=>update({objects:[...l.objects,{id:materialId(),x:.5,y:.5,size:l.sizeMax,angle:0,aspect:l.aspect,gray:l.grayMin,opacity:l.alphaMax,shape:l.shape,sourceId:l.sourceId,flipX:false,flipY:false,locked:false,motionLocked:false}]})}>添加手工图形</button>
        <p className="material-help">停止播放、关闭 3×3 后可直接拖动图形；跨边缘自动同步。</p>
        {l.objects.map((o,i)=><details key={o.id}><summary>图形 {i+1}{o.locked?' · 已锁定':''}</summary>
          <Field label={`图形 ${i+1} X`} value={o.x} min={0} max={1} step={.001} disabled={disabled||o.locked} onChange={v=>setObject(o.id,{x:v})}/>
          <Field label={`图形 ${i+1} Y`} value={o.y} min={0} max={1} step={.001} disabled={disabled||o.locked} onChange={v=>setObject(o.id,{y:v})}/>
          <Field label={`图形 ${i+1} 尺寸`} value={o.size} min={.001} max={.2} step={.001} disabled={disabled||o.locked} onChange={v=>setObject(o.id,{size:v})}/>
          <Field label={`图形 ${i+1} 角度`} value={o.angle} min={-180} max={360} disabled={disabled||o.locked} onChange={v=>setObject(o.id,{angle:v})}/>
          <Toggle label={`图形 ${i+1} 镜像`} checked={o.flipX} disabled={disabled||o.locked} onChange={v=>setObject(o.id,{flipX:v})}/>
          <Toggle label={`图形 ${i+1} 固定运动`} checked={o.motionLocked} disabled={disabled||o.locked} onChange={v=>setObject(o.id,{motionLocked:v})}/>
          <Toggle label={`图形 ${i+1} 锁定`} checked={o.locked} disabled={disabled} onChange={v=>s.edit(p=>{p.layers.find(a=>a.id===l.id)!.objects.find(a=>a.id===o.id)!.locked=v;})}/>
          <button disabled={disabled||o.locked} onClick={()=>update({objects:l.objects.filter(a=>a.id!==o.id)})}>删除图形</button>
        </details>)}
      </>}</>}
    </details>}
    {l.kind==='halftoneEllipse'&&<Field label="网点长宽比" value={l.aspect} min={.25} max={4} step={.05} disabled={disabled} onChange={v=>update({aspect:v},'aspect')}/>}
    {(l.kind==='airbrush'||l.kind==='spray'||l.motion==='vortex')&&<>
      <Field label="效果中心 X" value={l.centerX} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({centerX:v},'centerX')}/>
      <Field label="效果中心 Y" value={l.centerY} min={0} max={1} step={.01} disabled={disabled} onChange={v=>update({centerY:v},'centerY')}/>
    </>}
    {usesInput&&<details><summary>输入图 / 蒙版</summary>
      <SelectField label={particle?'图形素材':'输入灰度 / Alpha'} value={l.sourceId} disabled={disabled} onChange={v=>update({sourceId:v,...(particle&&v?{shape:'custom' as const}:{})})}><option value="">使用程序化默认</option>{p.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</SelectField>
      {!particle&&<><SelectField label="亮度响应" value={l.response} disabled={disabled} onChange={v=>update({response:v as HeightLayer['response']})}><option value="all">全画面</option><option value="dark">暗部</option><option value="edge">边缘</option><option value="alpha">Alpha 覆盖</option></SelectField><Toggle label="输入周期边缘融合" checked={l.tileSource} disabled={disabled} onChange={v=>update({tileSource:v})}/></>}
      {particle&&p.sources.length>1&&<>{p.sources.map(source=><Field key={source.id} label={`${source.name} 比例`} value={l.sourceMix.find(m=>m.id===source.id)?.weight??0} min={0} max={10} step={.1} disabled={disabled} onChange={v=>update({shape:'custom',sourceMix:[...l.sourceMix.filter(m=>m.id!==source.id),{id:source.id,weight:v}]},'mix')}/>)}</>}
    </details>}
    {['noise','ridged','algorithm','creases','marble','contours','turbulence','smoke','terrain'].includes(l.kind)&&<details><summary>高级算法</summary>
      <SelectField label="底层算法" value={l.algorithm} disabled={disabled} onChange={v=>update({algorithm:v as HeightLayer['algorithm']})}>{Object.entries(algorithms).map(([id,name])=><option key={id} value={id}>{name}</option>)}</SelectField>
      {['noise','ridged','creases','marble','contours'].includes(l.kind)&&<SelectField label="噪声组合" value={l.transform} disabled={disabled} onChange={v=>update({transform:v as HeightLayer['transform']})}><option value="fbm">fBm 多尺度</option><option value="turbulence">绝对值扰动</option><option value="ridged">脊线变换</option></SelectField>}
    </details>}
    <details><summary>图层运动</summary>
      <SelectField label="运动方式" value={l.motion} disabled={disabled} onChange={v=>update({motion:v as HeightLayer['motion']})}>{Object.entries(motions).map(([id,name])=><option key={id} value={id}>{name}</option>)}</SelectField>
      {l.motion!=='none'&&<>
        <Field label="运动幅度" value={l.amplitude} min={0} max={.5} step={.01} disabled={disabled} onChange={v=>update({amplitude:v},'amplitude')}/>
        <Field label="循环次数" value={l.cycles} min={1} max={8} disabled={disabled} onChange={v=>update({cycles:v},'cycles')}/>
        <Field label="运动方向" value={l.motionDirection} min={-180} max={180} disabled={disabled} onChange={v=>update({motionDirection:v},'motionDirection')}/>
        <Toggle label="固定此层运动" checked={l.motionLocked} disabled={disabled} onChange={v=>update({motionLocked:v})}/>
      </>}
    </details>
  </>;
}
