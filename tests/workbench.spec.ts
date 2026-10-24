import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';

const project=async(page:any)=>page.evaluate(async()=>{
  const {useMaterialStore}=await import('/src/features/material/store.ts');return useMaterialStore.getState().project;
});
const canvasSignature=async(page:any)=>page.getByLabel('画布预览').evaluate((c:HTMLCanvasElement)=>{
  const d=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let hash=0;
  for(let i=0;i<d.length;i+=17)hash=(Math.imul(hash,31)+d[i])|0;
  return `${c.width}x${c.height}:${hash}`;
});
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'纹理工作台',exact:true})).toBeVisible();});

test('fast live preview preserves the same texture values as the export renderer',async({page})=>{
  const result=await page.evaluate(async()=>{
    const m=await import('/src/features/material/model.ts'),e=await import('/src/features/material/engine.ts');
    let error=0;
    for(const kind of ['particles','dust','spray','smoke','marble','noise','wood','film']){
      const p=m.newMaterial();p.layers=[m.heightLayer(kind,{motion:'wave',count:150,warp:.35})];
      for(const phase of [0,.37,.9]){
        const live=e.renderMaterial(p,48,[],undefined,phase,true),full=e.renderMaterial(p,48,[],undefined,phase);
        for(let i=0;i<live.height.length;i++)error=Math.max(error,Math.abs(live.height[i]-full.height[i]));
      }
    }
    return error;
  });
  expect(result).toBe(0);
});

test('canvas updates repeatedly while a slider is held, settles exactly, and undo restores the entire gesture',async({page})=>{
  const session=await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate',{rate:2});
  await expect.poll(()=>page.getByLabel('画布预览').evaluate((c:HTMLCanvasElement)=>c.width)).toBe(512);
  await expect(page.getByLabel('随机种子')).not.toBeVisible();
  await expect(page.getByLabel('输出通道')).toHaveCount(0);
  const before=await project(page),slider=page.getByRole('slider',{name:'对比度',exact:true}),rect=(await slider.boundingBox())!;
  const canvasRect=(await page.getByLabel('画布预览').boundingBox())!;
  const signatures=new Set<string>();
  await page.mouse.move(rect.x+rect.width*.08,rect.y+rect.height/2);await page.mouse.down();
  await expect.poll(async()=>[128,192].includes(await page.getByLabel('画布预览').evaluate((c:HTMLCanvasElement)=>c.width))).toBe(true);
  let last=await canvasSignature(page);
  for(const ratio of [.15,.3,.45,.6,.75]){
    await page.mouse.move(rect.x+5+(rect.width-10)*ratio,rect.y+rect.height/2,{steps:4});
    await expect.poll(async()=>Math.abs(Number(await slider.inputValue())-ratio*4)).toBeLessThan(.15);
    await expect.poll(()=>canvasSignature(page)).not.toBe(last);
    last=await canvasSignature(page);signatures.add(last);
    expect([128,192]).toContain(await page.getByLabel('画布预览').evaluate((c:HTMLCanvasElement)=>c.width));
    const liveRect=(await page.getByLabel('画布预览').boundingBox())!;
    expect(liveRect.width).toBeCloseTo(canvasRect.width,0);expect(liveRect.height).toBeCloseTo(canvasRect.height,0);
  }
  expect(signatures.size).toBeGreaterThanOrEqual(4);
  await page.mouse.move(rect.x+rect.width-5,rect.y+rect.height/2);await page.mouse.up();
  await expect(slider).toHaveValue('4');
  await expect.poll(()=>page.getByLabel('画布预览').evaluate((c:HTMLCanvasElement)=>c.width)).toBe(512);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  expect((await project(page)).layers[0].contrast).toBe(before.layers[0].contrast);
  await slider.focus();await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue(String(before.layers[0].contrast+.01));
  await page.getByRole('button',{name:'锁定 纸面起伏',exact:true}).click();
  await expect(slider).toBeDisabled();
});

test('background and colored alpha elements share the canvas with textures and survive presets, saving and exports',async({page})=>{
  const background=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=320;c.height=160;
    const ctx=c.getContext('2d')!;ctx.fillStyle='#ea5533';ctx.fillRect(0,0,320,160);return c.toDataURL().split(',')[1];
  });
  await page.getByRole('button',{name:'上传背景',exact:true}).click();
  await page.getByLabel('上传素材文件').setInputFiles({name:'底图.png',mimeType:'image/png',buffer:Buffer.from(background,'base64')});
  await expect(page.getByRole('heading',{name:'背景',exact:true})).toBeVisible();
  expect((await project(page)).canvas).toEqual({width:320,height:160});
  await page.getByRole('button',{name:'上传元素',exact:true}).click();
  await page.getByLabel('上传素材文件').setInputFiles([
    {name:'蓝色.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#1266ed" opacity=".7"/></svg>')},
    {name:'绿色.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="4" width="24" height="24" fill="#22a755"/></svg>')},
  ]);
  await expect(page.getByRole('heading',{name:'上传元素',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'纹理库'}).click();
  await page.getByLabel('搜索纹理预设').fill('宣纸');await page.getByRole('button',{name:/11 宣纸/}).click();
  const combined=await project(page);
  expect(combined.sources).toHaveLength(3);expect(combined.layers.filter((l:any)=>l.role!=='texture')).toHaveLength(2);
  expect(combined.layers.some((l:any)=>l.kind==='paper')).toBe(true);
  const pixels=await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts'),{materialTask}=await import('/src/features/material/workerClient.ts');
    const p=structuredClone(useMaterialStore.getState().project);
    p.layers=p.layers.filter(l=>l.role!=='texture');p.export.background='transparent';
    const m=await materialTask(p,128).promise;
    let colored=0;for(let i=0;i<m.composition.length;i+=4)if(m.composition[i]>m.composition[i+2]+50)colored++;
    p.export.scope='material';const a=await materialTask(p,128).promise;
    let blue=0,transparent=0,partial=0;for(let i=0;i<a.composition.length;i+=4){
      if(a.composition[i+2]>a.composition[i]+80)blue++;
      if(a.composition[i+3]===0)transparent++;if(a.composition[i+3]>0&&a.composition[i+3]<255)partial++;
    }
    return{width:m.width,height:m.pixelHeight,colored,blue,transparent,partial};
  });
  expect(pixels.width).toBe(128);expect(pixels.height).toBe(64);expect(pixels.colored).toBeGreaterThan(1000);
  expect(pixels.blue).toBeGreaterThan(10);expect(pixels.transparent).toBeGreaterThan(1000);expect(pixels.partial).toBeGreaterThan(10);
  await page.getByRole('button',{name:'项目菜单'}).click();
  const savedPromise=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目'}).click();const saved=await savedPromise;
  await page.getByRole('button',{name:'项目菜单'}).click();await page.getByRole('button',{name:'新建项目'}).click();
  await page.getByLabel('打开项目文件').setInputFiles((await saved.path())!);
  await expect.poll(async()=>(await project(page)).sources.length).toBe(3);
  expect((await project(page)).sources).toEqual(combined.sources);
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('灰度位深')).toHaveCount(0);
  await dialog.getByLabel('导出内容').selectOption('material');await dialog.getByLabel('素材尺寸').selectOption('128');
  await dialog.getByLabel('画布底色').selectOption('transparent');
  const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载素材'}).click();
  const file=await downloadPromise,b=await readFile((await file.path())!);
  expect(b.readUInt32BE(16)).toBe(128);expect(b.readUInt32BE(20)).toBe(64);expect([b[24],b[25]]).toEqual([8,6]);
  const parts:Buffer[]=[];for(let off=8;off<b.length;){const n=b.readUInt32BE(off);if(b.toString('ascii',off+4,off+8)==='IDAT')parts.push(b.subarray(off+8,off+8+n));off+=n+12;}
  const raw=inflateSync(Buffer.concat(parts));expect(raw.length).toBe((128*4+1)*64);
  await dialog.getByLabel('导出格式').selectOption('pure');await expect(dialog.getByRole('button',{name:'下载素材'})).toBeDisabled();
  await dialog.getByLabel('导出格式').selectOption('effect');await expect(dialog.getByRole('button',{name:'下载素材'})).toBeEnabled();
});
