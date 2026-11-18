import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {choose} from './select';
const svgFile=(name='leaf.svg')=>({name,mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><path d="M0 16 Q32 -16 64 16 Q32 48 0 16Z" fill="#26a076"/></svg>')});
const current=(page:any)=>page.evaluate(async()=>{const {useMaterialStore}=await import('/src/features/material/store.ts');return useMaterialStore.getState().project;});
const blank=async(page:any)=>{await page.getByRole('button',{name:'项目菜单'}).click();await page.getByRole('button',{name:'新建项目',exact:true}).click();};
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'Texture Generator',exact:true})).toBeVisible();});

test('pending recovery survives new edits until restore or dismissal',async({page})=>{
  await page.evaluate(async()=>{const {newMaterial}=await import('/src/features/material/model.ts');const p=newMaterial('cracks');p.name='保留旧作品';localStorage.setItem('texture-material-recovery',JSON.stringify(p));});
  await page.reload();await expect(page.getByRole('button',{name:'恢复',exact:true})).toBeVisible();
  await page.locator('.material-preset').first().click();
  await page.waitForTimeout(1000);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('texture-material-recovery')!).name)).toBe('保留旧作品');
  await page.getByRole('button',{name:'恢复',exact:true}).click();expect((await current(page)).name).toBe('保留旧作品');
  await blank(page);await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('texture-material-recovery')!).name)).toBe('未命名纹理');
  await page.reload();await page.locator('.material-preset').first().click();await page.getByRole('button',{name:'关闭',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('texture-material-recovery')!).name)).toBe((await current(page)).name);
});

test('sources can be removed, undone and reused at capacity without breaking locks or project references',async({page})=>{
  await blank(page);await page.locator('.material-upload-actions').getByRole('button',{name:'上传元素',exact:true}).click();
  await page.getByLabel('上传素材文件').setInputFiles(Array.from({length:16},(_,i)=>svgFile(`source-${i}.svg`)));
  await expect.poll(async()=>(await current(page)).sources.length).toBe(16);
  await page.getByRole('button',{name:'锁定 上传元素',exact:true}).click();
  await page.getByRole('button',{name:'移除素材 source-0.svg',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('素材被锁定图层或图形使用，请先解锁');
  expect((await current(page)).sources).toHaveLength(16);
  await page.getByRole('button',{name:'解锁 上传元素',exact:true}).click();
  await page.getByRole('button',{name:'移除素材 source-0.svg',exact:true}).click();
  await expect.poll(async()=>(await current(page)).sources.length).toBe(15);
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await current(page)).sources).toHaveLength(16);
  await page.getByRole('button',{name:'移除素材 source-0.svg',exact:true}).click();
  await page.locator('.material-upload-actions').getByRole('button',{name:'上传元素',exact:true}).click();await page.getByLabel('上传素材文件').setInputFiles(svgFile('replacement.svg'));
  await expect.poll(async()=>(await current(page)).sources.length).toBe(16);
  const p=await current(page);
  await page.getByLabel('打开项目文件').setInputFiles({name:'custom.material.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
  expect(await current(page)).toEqual(p);
});

test('replacing backgrounds does not leak source slots and works at the layer limit',async({page})=>{
  await blank(page);
  for(let i=0;i<3;i++){
    await page.getByRole('button',{name:'上传背景',exact:true}).click();await page.getByLabel('上传素材文件').setInputFiles(svgFile(`bg-${i}.svg`));
    await expect.poll(async()=>(await current(page)).sources[0]?.name).toBe(`bg-${i}.svg`);
    expect((await current(page)).sources).toHaveLength(1);
  }
  await page.evaluate(async()=>{const {useMaterialStore}=await import('/src/features/material/store.ts');const {heightLayer}=await import('/src/features/material/model.ts');useMaterialStore.getState().edit(p=>{while(p.layers.length<16)p.layers.push(heightLayer('noise',{visible:false}));});});
  await page.getByRole('button',{name:'上传背景',exact:true}).click();await page.getByLabel('上传素材文件').setInputFiles(svgFile('at-capacity.svg'));
  await expect.poll(async()=>(await current(page)).sources[0]?.name).toBe('at-capacity.svg');
  expect((await current(page)).layers).toHaveLength(16);expect((await current(page)).sources).toHaveLength(1);
});

test('custom spacing and rotated edge bounds stay reproducible on a rectangular canvas and survive manual conversion',async({page})=>{
  await blank(page);await page.locator('.material-upload-actions').getByRole('button',{name:'上传元素',exact:true}).click();await page.getByLabel('上传素材文件').setInputFiles(svgFile());
  await expect(page.getByRole('heading',{name:'leaf',exact:true})).toBeVisible();
  await page.evaluate(async()=>{const {useMaterialStore}=await import('/src/features/material/store.ts');useMaterialStore.getState().edit(p=>{p.canvas={width:640,height:320};p.layers[0].sizeMin=.015;p.layers[0].sizeMax=.035;p.layers[0].count=30;});});
  await choose(page.getByLabel('图案边界'),'canvas');await page.getByLabel('元素间距数值',{exact:true}).fill('12');await page.getByLabel('边缘间距数值',{exact:true}).fill('24');
  const result=await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts');const {layerParticles,artworkSize}=await import('/src/features/material/artwork.ts');
    const p=useMaterialStore.getState().project,l=p.layers[0],a=layerParticles(p,l);let edge=Infinity,gap=Infinity;
    for(const [i,o] of a.entries()){
      const d=artworkSize(o,p.sources[0],640),ex=(Math.abs(o.cs)*d.width+Math.abs(o.sn)*d.height)/2,ey=(Math.abs(o.sn)*d.width+Math.abs(o.cs)*d.height)/2;
      edge=Math.min(edge,o.x*640-ex,640-o.x*640-ex,o.y*320-ey,320-o.y*320-ey);
      for(const b of a.slice(0,i)){const db=artworkSize(b,p.sources[0],640);gap=Math.min(gap,Math.hypot((o.x-b.x)*640,(o.y-b.y)*320)-Math.hypot(d.width,d.height)/2-Math.hypot(db.width,db.height)/2);}
    }
    return{edge,gap,points:a.map(o=>({x:o.x,y:o.y,size:o.size,angle:o.angle})),repeat:JSON.stringify(a)===JSON.stringify(layerParticles(p,l))};
  });
  expect(result.edge).toBeGreaterThanOrEqual(24-1e-6);expect(result.gap).toBeGreaterThanOrEqual(12-1e-6);expect(result.repeat).toBe(true);expect(result.points.length).toBeGreaterThan(10);
  await choose(page.getByLabel('排列',{exact:true}),'manual');
  expect((await current(page)).layers[0].objects.map(({x,y,size,angle}:any)=>({x,y,size,angle}))).toEqual(result.points);
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await current(page)).layers[0].distribution).toBe('random');
  const edgeObject=await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts'),{layerParticles}=await import('/src/features/material/artwork.ts');
    const p=structuredClone(useMaterialStore.getState().project),l=p.layers[0];l.objects=layerParticles(p,l).slice(0,1).map(o=>({...o,x:1,y:1}));l.distribution='manual';
    return layerParticles(p,l).map(o=>({x:o.x,y:o.y}));
  });
  expect(edgeObject).toEqual([{x:1,y:1}]);
});

test('uploaded SVG exports real colored paths and editable mixed SVG retains individual PNGs with matching pixels',async({page})=>{
  test.setTimeout(90000);
  const result=await page.evaluate(async()=>{
    const m=await import('/src/features/material/model.ts'),i=await import('/src/features/material/import.ts'),w=await import('/src/features/material/workerClient.ts');
    const gradient='<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 80 40"><defs><linearGradient id="paint"><stop stop-color="#ef4d32"/><stop offset="1" stop-color="#2b70de" stop-opacity=".5"/></linearGradient></defs><rect x="10" y="20" width="80" height="40" rx="10" fill="url(#paint)"/></svg>';
    const a=(await i.importHeight(new File([gradient],'gradient.svg',{type:'image/svg+xml'}))).source;
    const c=document.createElement('canvas');c.width=24;c.height=48;const ctx=c.getContext('2d')!;ctx.fillStyle='rgba(0,180,80,.7)';ctx.fillRect(3,5,18,38);
    const blob=await new Promise<Blob>(r=>c.toBlob(b=>r(b!)));const b=(await i.importHeight(new File([blob],'leaf.png',{type:'image/png'}))).source;
    const base=m.heightLayer('particles',{role:'elements',shape:'custom',softness:0,warp:0,contrast:1,distribution:'manual'});
    const object=(id:string,x:number,y:number,sourceId:string,angle:number)=>({id,x,y,size:.15,angle,aspect:1.2,gray:0,opacity:.7,shape:'custom' as const,sourceId,flipX:true,flipY:false,locked:false,motionLocked:false});
    base.objects=[object('svg-edge',.02,.15,a.id,25),object('svg-mid',.6,.55,a.id,-30)];base.sourceId=a.id;
    const p=m.newMaterial();p.sources=[a];p.layers=[base];p.canvas={width:320,height:160};p.export.size=256;p.export.background='transparent';
    const pure=await w.materialTask<any>(p,256,true,undefined,{format:'pure'}).promise;
    const pureText=await pure.blob.text(),pureDoc=new DOMParser().parseFromString(pureText,'image/svg+xml');
    p.sources.push(b);base.objects.push(object('png-object',.45,.5,b.id,16));
    let pureRejected=false;try{await w.materialTask(p,256,true,undefined,{format:'pure'}).promise;}catch{pureRejected=true;}
    let maxMean=0;const structures=[];
    for(const bg of ['transparent','white'] as const)for(const texture of [false,true]){
      p.export.background=bg;p.layers=texture?[base,m.heightLayer('noise',{contrast:.4,warp:0,opacity:.25,blend:'multiply'})]:[base];
      const output=await w.materialTask<any>(p,256,true,undefined,{format:'editable'}).promise,text=await output.blob.text();
      const doc=new DOMParser().parseFromString(text,'image/svg+xml'),ids=[...doc.querySelectorAll('[id]')].map(n=>n.id);
      const image=new Image(),url=URL.createObjectURL(output.blob);image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const cc=canvas.getContext('2d')!;cc.drawImage(image,0,0);URL.revokeObjectURL(url);
      const actual=cc.getImageData(0,0,256,128).data,maps=await w.materialTask<any>(p,256).promise;let err=0;
      for(let k=0;k<actual.length;k+=4){const aa=actual[k+3]/255,ea=maps.composition[k+3]/255;for(let j=0;j<3;j++)err+=Math.abs(actual[k+j]*aa-maps.composition[k+j]*ea);err+=Math.abs(actual[k+3]-maps.composition[k+3]);}
      maxMean=Math.max(maxMean,err/actual.length);
      structures.push({objects:doc.querySelectorAll('[data-object-id]').length,images:doc.querySelectorAll('image').length,paths:doc.querySelectorAll('rect[fill="url(#art-instance-0_paint)"]').length,unique:new Set(ids).size===ids.length,parseError:!!doc.querySelector('parsererror')});
    }
    p.layers=[base];p.sources=[a];base.objects=base.objects.filter(o=>o.sourceId===a.id);
    const optimized=await w.materialTask<any>(p,256,true,undefined,{format:'optimized'}).promise;
    return{pureImages:pureDoc.querySelectorAll('image').length,pureObjects:pureDoc.querySelectorAll('[data-object-id]').length,pureColored:pureText.includes('#ef4d32'),pureRejected,maxMean,structures,optimized:(await optimized.blob.text()).includes('<use')};
  });
  expect(result.pureImages).toBe(0);expect(result.pureObjects).toBeGreaterThan(2);expect(result.pureColored).toBe(true);expect(result.pureRejected).toBe(true);expect(result.optimized).toBe(true);
  expect(result.maxMean).toBeLessThan(3);
  for(const s of result.structures){expect(s.objects).toBeGreaterThan(3);expect(s.images).toBeGreaterThan(0);expect(s.unique).toBe(true);expect(s.parseError).toBe(false);}
});

test('editable SVG is downloadable through the UI and canceled texture jobs can be retried',async({page})=>{
  await blank(page);await page.locator('.material-upload-actions').getByRole('button',{name:'上传元素',exact:true}).click();await page.getByLabel('上传素材文件').setInputFiles(svgFile());
  await expect(page.getByRole('heading',{name:'leaf',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'导出',exact:true}).click();await choose(page.getByLabel('导出格式'),'editable');await choose(page.getByLabel('素材尺寸'),'128');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载素材',exact:true}).click();const file=await download;
  expect(await readFile((await file.path())!,'utf8')).toContain('data-object-id');
  const canceled=await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts'),{heightLayer}=await import('/src/features/material/model.ts'),{materialTask}=await import('/src/features/material/workerClient.ts');
    const p=structuredClone(useMaterialStore.getState().project);p.layers.push(heightLayer('noise'));const task=materialTask(p,8192,true,undefined,{format:'editable'});task.cancel();
    let aborted=false;try{await task.promise;}catch(e){aborted=(e as Error).name==='AbortError';}
    const retry=await materialTask<any>(p,128,true,undefined,{format:'editable'}).promise;
    return{aborted,hasImage:(await retry.blob.text()).includes('<image')};
  });
  expect(canceled).toEqual({aborted:true,hasImage:true});
});
