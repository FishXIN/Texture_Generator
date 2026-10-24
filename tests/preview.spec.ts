import {test,expect} from '@playwright/test';
import {choose} from './select';

const canvasInfo=async(page:any)=>page.getByLabel('画布预览').evaluate((c:HTMLCanvasElement)=>{
  const d=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  let hash=0,colored=0,opaque=true;
  for(let i=0;i<d.length;i++){
    hash=(Math.imul(hash,31)+d[i])|0;
    if(i%4===0&&d[i]!==d[i+2])colored++;
    if(i%4===3&&d[i]!==255)opaque=false;
  }
  return{signature:`${c.width}x${c.height}:${hash}`,colored,opaque};
});
const expectedSignature=async(page:any,normal:boolean)=>page.evaluate(async(normal:boolean)=>{
  const {useMaterialStore}=await import('/src/features/material/store.ts');
  const {renderMaterial}=await import('/src/features/material/engine.ts');
  const {mapCanvas}=await import('/src/features/material/TexturePreview.tsx');
  const p=useMaterialStore.getState().project,maps=renderMaterial(p,512);
  const c=mapCanvas(maps,normal,p.export.background==='transparent',p.export.pigment);
  const d=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let hash=0;
  for(const v of d)hash=(Math.imul(hash,31)+v)|0;
  return`${c.width}x${c.height}:${hash}`;
},normal);
const projectState=async(page:any)=>page.evaluate(async()=>{
  const {useMaterialStore}=await import('/src/features/material/store.ts');
  const s=useMaterialStore.getState();
  return{project:s.project,revision:s.revision,past:s.past.length,future:s.future.length};
});

test('grayscale/normal preview preserves settings, matches export pixels and updates during dragging and rapid switches',async({page})=>{
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Texture Generator',exact:true})).toBeVisible();
  await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts');
    const {newMaterial,heightLayer}=await import('/src/features/material/model.ts');
    const p=newMaterial();p.canvas={width:640,height:320};
    p.layers=[heightLayer('noise',{scale:5,contrast:.65,warp:.1})];
    p.export.background='transparent';p.export.maps='height';p.export.depth=16;
    useMaterialStore.getState().replace(p);
  });
  const gray=page.getByRole('button',{name:'黑白稿',exact:true}),normal=page.getByRole('button',{name:'法线贴图',exact:true});
  await expect(gray).toHaveAttribute('aria-pressed','true');
  const firstGray=await expectedSignature(page,false);
  await expect.poll(async()=>(await canvasInfo(page)).signature).toBe(firstGray);
  await choose(page.getByLabel('透明检查底色'),'dark');
  const before=await projectState(page);
  await normal.click();
  await expect(normal).toHaveAttribute('aria-pressed','true');
  await expect(gray).toHaveAttribute('aria-pressed','false');
  await expect(page.getByLabel('透明检查底色')).toHaveCount(0);
  let normalSignature=await expectedSignature(page,true);
  await expect.poll(async()=>(await canvasInfo(page)).signature).toBe(normalSignature);
  expect((await canvasInfo(page)).opaque).toBe(true);
  expect((await canvasInfo(page)).colored).toBeGreaterThan(1000);
  expect(await projectState(page)).toEqual(before);

  const slider=page.getByRole('slider',{name:'对比度',exact:true}),rect=(await slider.boundingBox())!;
  await page.mouse.move(rect.x+5+(rect.width-10)*.15,rect.y+rect.height/2);await page.mouse.down();
  await expect.poll(async()=>[128,192].includes(await page.getByLabel('画布预览').evaluate((c:HTMLCanvasElement)=>c.width))).toBe(true);
  let last=(await canvasInfo(page)).signature;
  for(const ratio of [.3,.45,.6]){
    await page.mouse.move(rect.x+5+(rect.width-10)*ratio,rect.y+rect.height/2,{steps:4});
    await expect.poll(async()=>(await canvasInfo(page)).signature).not.toBe(last);
    last=(await canvasInfo(page)).signature;
  }
  await page.mouse.up();
  normalSignature=await expectedSignature(page,true);
  await expect.poll(async()=>(await canvasInfo(page)).signature).toBe(normalSignature);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(slider).toHaveValue('0.65');
  await expect.poll(async()=>(await canvasInfo(page)).signature).toBe(await expectedSignature(page,true));
  await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts');
    useMaterialStore.getState().edit(p=>{p.normal.convention='directx';p.normal.strength=1.7;});
  });
  normalSignature=await expectedSignature(page,true);
  await expect.poll(async()=>(await canvasInfo(page)).signature).toBe(normalSignature);
  const afterEdit=await projectState(page);
  await gray.click();await normal.click();await gray.click();
  await expect.poll(async()=>(await canvasInfo(page)).signature).toBe(firstGray);
  await expect(page.getByLabel('透明检查底色')).toHaveAttribute('data-value','dark');
  expect(await projectState(page)).toEqual(afterEdit);
  await normal.click();
  await expect.poll(async()=>(await canvasInfo(page)).signature).toBe(normalSignature);
  await page.getByRole('button',{name:'平铺预览',exact:true}).click();
  await expect.poll(async()=>(await canvasInfo(page)).signature).not.toBe(normalSignature);
  expect((await canvasInfo(page)).opaque).toBe(true);
  expect(await projectState(page)).toEqual(afterEdit);
});
