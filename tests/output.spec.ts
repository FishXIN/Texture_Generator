import {test,expect} from '@playwright/test';
import {choose} from './select';
import {readFile} from 'node:fs/promises';
import {createInflate,inflateSync} from 'node:zlib';

const current=async(page:any)=>page.evaluate(async()=>{
  const {useMaterialStore}=await import('/src/features/material/store.ts');return useMaterialStore.getState().project;
});
function png(bytes:Buffer) {
  expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  const parts:Buffer[]=[];
  for(let off=8;off<bytes.length;){
    const n=bytes.readUInt32BE(off),type=bytes.toString('ascii',off+4,off+8);
    let crc=0xffffffff;
    for(const byte of bytes.subarray(off+4,off+8+n)){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    expect((crc^0xffffffff)>>>0).toBe(bytes.readUInt32BE(off+8+n));
    if(type==='IDAT')parts.push(bytes.subarray(off+8,off+8+n));
    off+=n+12;
  }
  return{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),depth:bytes[24],color:bytes[25],compressed:Buffer.concat(parts)};
}
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByLabel('画布预览')).toBeVisible();});

test('shared popups support keyboard selection, outside dismissal and both export dialog types',async({page})=>{
  const category=page.getByRole('combobox',{name:'纹理分类'});
  await category.focus();await category.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option',{name:'全部',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option',{name:'基础颗粒',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(category).toHaveAttribute('data-value','grain');
  await expect(category).toBeFocused();
  await category.click();await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);await expect(category).toBeFocused();
  await category.click();await page.mouse.click(32,32);
  await expect(page.getByRole('listbox')).toHaveCount(0);

  await page.getByRole('button',{name:'导出',exact:true}).click();
  const dialog=page.getByRole('dialog'),format=dialog.getByLabel('导出格式');
  await format.click();await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();await expect(format).toBeFocused();
  await choose(dialog.getByLabel('贴图类型'),'normal');
  await dialog.getByRole('button',{name:'关闭导出'}).click();
  await page.goto('/?studio=pattern');
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const legacy=page.getByRole('dialog');
  await choose(legacy.getByRole('combobox',{name:'文件格式'}),'sequence');
  await expect(legacy.getByRole('combobox',{name:'文件格式'})).toHaveAttribute('data-value','sequence');
  await legacy.getByRole('combobox',{name:'文件格式'}).click();await page.keyboard.press('Escape');
  await expect(legacy).toBeVisible();
});

test('ratio and resolution shortcuts preserve orientation, undo, custom dimensions and 8K project reload',async({page})=>{
  await page.getByLabel('画布尺寸',{exact:true}).click();
  await choose(page.getByLabel('画布比例'),'16:9');
  expect((await current(page)).canvas).toEqual({width:2048,height:1152});
  await choose(page.getByLabel('画布清晰度'),'8192');
  const landscape=await current(page);
  expect(landscape.canvas).toEqual({width:8192,height:4608});expect(landscape.export.size).toBe(8192);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  expect((await current(page)).canvas).toEqual({width:2048,height:1152});
  expect((await current(page)).export.size).toBe(2048);
  await choose(page.getByLabel('画布比例'),'9:16');
  await choose(page.getByLabel('画布清晰度'),'4096');
  expect((await current(page)).canvas).toEqual({width:2304,height:4096});
  await page.getByLabel('画布宽度').fill('2102');
  await expect(page.getByLabel('画布比例')).toHaveAttribute('data-value','custom');
  await page.getByLabel('画布高度').fill('8192');
  await choose(page.getByLabel('画布清晰度'),'8192');
  const saved=await current(page);
  await page.getByLabel('打开项目文件').setInputFiles({name:'8k.material.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  expect((await current(page)).canvas).toEqual(saved.canvas);expect((await current(page)).export.size).toBe(8192);
  await page.getByRole('button',{name:'导出',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('素材尺寸')).toHaveAttribute('data-value','8192');
});

test('real 8192 square export preserves 16-bit alpha and streams all PNG scanlines',async({page})=>{
  test.setTimeout(90000);
  const expected=await page.evaluate(async()=>{
    const {newMaterial,heightLayer}=await import('/src/features/material/model.ts');
    const {useMaterialStore}=await import('/src/features/material/store.ts');
    const {createSampler}=await import('/src/features/material/engine.ts');
    const p=newMaterial();p.layers=[heightLayer('waves',{scale:8,warp:0,contrast:1,bias:0})];
    p.canvas={width:8192,height:8192};p.export={...p.export,size:8192,depth:16,background:'transparent',pigment:'black',maps:'height'};
    useMaterialStore.getState().replace(p);
    const field=createSampler(p),sample={h:0,du:0,dv:0};
    return [0,151,733,1371].map(x=>{field(x/8192,0,sample);return{x,alpha:65535-Math.round(Math.fround(sample.h)*65535)};});
  });
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const dialog=page.getByRole('dialog'),download=page.waitForEvent('download',{timeout:80000});
  await dialog.getByRole('button',{name:'下载素材'}).click();
  const data=png(await readFile((await (await download).path())!));
  expect([data.width,data.height,data.depth,data.color]).toEqual([8192,8192,16,4]);
  const first=Buffer.alloc(8192*4+1),inflater=createInflate();let length=0;
  inflater.end(data.compressed);
  for await(const chunk of inflater){if(length<first.length)chunk.copy(first,length,0,Math.min(chunk.length,first.length-length));length+=chunk.length;}
  expect(length).toBe((8192*4+1)*8192);expect(first[0]).toBe(0);
  for(const sample of expected){expect(first.readUInt16BE(1+sample.x*4)).toBe(0);expect(first.readUInt16BE(3+sample.x*4)).toBe(sample.alpha);}
  expect(new Set(expected.map(s=>s.alpha)).size).toBeGreaterThan(1);
});

test('direct normal selection exports 8K RGB normals and paired ZIP with matching DirectX channels',async({page})=>{
  test.setTimeout(60000);
  await page.evaluate(async()=>{
    const {newMaterial,heightLayer}=await import('/src/features/material/model.ts');
    const {useMaterialStore}=await import('/src/features/material/store.ts');
    const p=newMaterial();p.layers=[heightLayer('waves',{scale:4,warp:0})];p.canvas={width:8192,height:128};p.export.size=8192;
    useMaterialStore.getState().replace(p);
  });
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await choose(dialog.getByLabel('贴图类型'),'normal');
  await expect(dialog.getByLabel('贴图类型')).toBeVisible();await expect(dialog.getByLabel('画布底色')).toHaveCount(0);
  let download=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载素材'}).click();
  const gl=png(await readFile((await (await download).path())!)),glPixels=inflateSync(gl.compressed);
  expect([gl.width,gl.height,gl.depth,gl.color]).toEqual([8192,128,8,2]);
  await dialog.getByText('高级设置',{exact:true}).click();await choose(dialog.getByLabel('法线格式'),'directx');
  await choose(dialog.getByLabel('贴图类型'),'both');
  download=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载素材'}).click();
  const bytes=await readFile((await (await download).path())!),files=new Map<string,Buffer>();
  for(let off=0;bytes.readUInt32LE(off)===0x04034b50;){
    const size=bytes.readUInt32LE(off+18),n=bytes.readUInt16LE(off+26),extra=bytes.readUInt16LE(off+28),start=off+30+n+extra;
    files.set(bytes.toString('utf8',off+30,off+30+n),bytes.subarray(start,start+size));off=start+size;
  }
  expect(files.size).toBe(3);
  const manifest=JSON.parse(files.get('manifest.json')!.toString());
  expect([manifest.width,manifest.height,manifest.normal.convention]).toEqual([8192,128,'DirectX']);
  const dx=png([...files].find(([name])=>name.includes('_Normal_'))![1]),dxPixels=inflateSync(dx.compressed);
  const gray=png([...files].find(([name])=>name.endsWith('.png')&&!name.includes('_Normal_'))![1]);
  expect([gray.width,gray.height,gray.color]).toEqual([8192,128,0]);
  for(let y=0;y<128;y++)for(let x=0;x<8192;x+=127){
    const k=y*(8192*3+1)+1+x*3;
    expect(dxPixels[k]).toBe(glPixels[k]);expect(dxPixels[k+1]+glPixels[k+1]).toBe(255);expect(dxPixels[k+2]).toBe(glPixels[k+2]);
  }
});
