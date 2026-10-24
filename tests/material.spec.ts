import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '纹理工作台', exact: true })).toBeVisible();
});

test('periodic fields and their gradients remain continuous with warp, direction and mixed layers', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { newMaterial, materialPresets, heightLayer } = await import('/src/features/material/model.ts');
    const { createSampler } = await import('/src/features/material/engine.ts');
    let period = 0, gradient = 0;
    const samples = [];
    for (const preset of materialPresets) for (const direction of ['horizontal', 'vertical', 'diagonal']) {
      const p = newMaterial(preset.id);
      for (const l of p.layers) { l.warp = 0.67; l.direction = direction; }
      const field = createSampler(p), at = (u: number, v: number) => { const o = { h:0, du:0, dv:0 }; field(u,v,o); return o; };
      for (let i = 0; i < 18; i++) {
        const u = (i * 0.173 + 0.137) % 1, v = (i * 0.217 + 0.319) % 1, a = at(u,v), b = at(u+1,v-1);
        for (const k of ['h','du','dv']) period = Math.max(period, Math.abs(a[k] - b[k]));
        // Use a smaller step near clipped black/white so the stencil remains on the same smooth branch.
        const edge = Math.min(a.h,1-a.h), e = Math.max(1e-9,Math.min(1e-6,edge/(4*(1+Math.abs(a.du)+Math.abs(a.dv)))));
        const du = (at(u+e,v).h - at(u-e,v).h)/(2*e), dv = (at(u,v+e).h - at(u,v-e).h)/(2*e);
        gradient = Math.max(gradient, Math.abs(a.du-du)/(1+Math.abs(du)), Math.abs(a.dv-dv)/(1+Math.abs(dv)));
      }
      for (const t of [0.123,0.418,0.893]) for (const [a,b] of [[at(0,t),at(1,t)],[at(t,0),at(t,1)]]) {
        for (const k of ['h','du','dv']) period = Math.max(period,Math.abs(a[k]-b[k]));
      }
      samples.push(preset.id);
    }
    const pixels = new Float32Array(8*8).map((_,i) => (i%8)/7 * .6 + Math.floor(i/8)/7*.4);
    const p = newMaterial(); p.layers = [heightLayer('image',{sourceId:'source',contrast:1,warp:0})];
    const field = createSampler(p,[{id:'source',width:8,height:8,pixels}]);
    const at = (u:number,v:number) => { const o={h:0,du:0,dv:0};field(u,v,o);return o; };
    for (const t of [.125,.34,.731]) for (const [a,b] of [[at(0,t),at(1,t)],[at(t,0),at(t,1)]]) {
      for (const k of ['h','du','dv']) period=Math.max(period,Math.abs(a[k]-b[k]));
    }
    for (const blend of ['replace','add','multiply','max']) {
      p.layers = [heightLayer('noise',{contrast:.6}),heightLayer('waves',{blend,opacity:.35,contrast:.5})];
      const f=createSampler(p), sample=(u:number,v:number)=>{const o={h:0,du:0,dv:0};f(u,v,o);return o;};
      const u=.137,v=.291,e=1e-6,a=sample(u,v),du=(sample(u+e,v).h-sample(u-e,v).h)/(2*e),dv=(sample(u,v+e).h-sample(u,v-e).h)/(2*e);
      gradient=Math.max(gradient,Math.abs(a.du-du)/(1+Math.abs(du)),Math.abs(a.dv-dv)/(1+Math.abs(dv)));
    }
    return {period,gradient,count:samples.length};
  });
  expect(result.count).toBe(93); expect(result.period).toBeLessThan(1e-8); expect(result.gradient).toBeLessThan(.002);
});

test('seed reproduction, resolution independence and normal conventions preserve grayscale', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { newMaterial, parseMaterial }=await import('/src/features/material/model.ts');
    const { renderMaterial }=await import('/src/features/material/engine.ts');
    const p=newMaterial('grunge'), a=renderMaterial(p,128), b=renderMaterial(parseMaterial(JSON.stringify(p)),128), c=renderMaterial(p,256);
    let resolution=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++)resolution=Math.max(resolution,Math.abs(a.height[y*128+x]-c.height[y*2*256+x*2]));
    p.normal.strength=1.7;const strong=renderMaterial(p,128);p.normal.convention='directx';const dx=renderMaterial(p,128);
    const stable=a.height.every((v:number,i:number)=>v===b.height[i]&&v===strong.height[i]&&v===dx.height[i]);
    const flipped=strong.normal.every((v:number,i:number)=>i%4===1? v+dx.normal[i]===255:v===dx.normal[i]);
    p.layers=[];const flat=renderMaterial(p,32);
    p.layers=newMaterial('grunge').layers;p.layers[0].seed++;const changed=renderMaterial(p,128);
    return {stable,flipped,resolution,white:flat.height.every((v:number)=>v===1),flat:[...flat.normal.slice(0,4)],changed:a.height.some((v:number,i:number)=>v!==changed.height[i])};
  });
  expect(result).toEqual({stable:true,flipped:true,resolution:0,white:true,flat:[128,127,255,255],changed:true});
});

function readPng(bytes: number[] | Buffer) {
  const b=Buffer.from(bytes), parts:Buffer[]=[], types:string[]=[];let size=0,depth=0,color=0;
  expect([...b.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  for(let off=8;off<b.length;) {
    const n=b.readUInt32BE(off), type=b.toString('ascii',off+4,off+8), data=b.subarray(off+8,off+8+n);
    let crc=0xffffffff;
    for(const byte of b.subarray(off+4,off+8+n)) {crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    expect((crc^0xffffffff)>>>0).toBe(b.readUInt32BE(off+8+n));
    types.push(type);
    if(type==='IHDR'){size=data.readUInt32BE(0);expect(data.readUInt32BE(4)).toBe(size);depth=data[8];color=data[9];}
    if(type==='IDAT')parts.push(data);off+=n+12;
  }
  expect(types).toEqual(['IHDR','IDAT','IEND']);
  return {size,depth,color,raw:inflateSync(Buffer.concat(parts))};
}

test('PNG exports contain actual 16-bit grayscale and clean black alpha with independent CRC/deflate checks', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const {newMaterial}=await import('/src/features/material/model.ts');
    const {renderMaterial}=await import('/src/features/material/engine.ts');
    const {encodePng}=await import('/src/features/material/png.ts');
    const maps=renderMaterial(newMaterial('stone'),128);
    return {height:[...await encodePng(maps,'height',16)],alpha:[...await encodePng(maps,'height',16,true)],alpha8:[...await encodePng(maps,'height',8,true)],normal:[...await encodePng(maps,'normal',8)],values:[...maps.height]};
  });
  const height=readPng(result.height),alpha=readPng(result.alpha),alpha8=readPng(result.alpha8),normal=readPng(result.normal);
  expect([height.depth,height.color,alpha.depth,alpha.color,alpha8.depth,alpha8.color,normal.depth,normal.color]).toEqual([16,0,16,4,8,4,8,2]);
  const levels=new Set<number>(); let mismatches=0;
  for(let y=0;y<128;y++) {
    expect(height.raw[y*257]).toBe(0);expect(alpha.raw[y*513]).toBe(0);
    for(let x=0;x<128;x++){
      const value=height.raw.readUInt16BE(y*257+1+x*2);levels.add(value);
      if(value!==Math.round(result.values[y*128+x]*65535)
        ||alpha.raw.readUInt16BE(y*513+1+x*4)!==0
        ||alpha.raw.readUInt16BE(y*513+3+x*4)!==65535-value
        ||alpha8.raw[y*257+1+x*2]!==0
        ||alpha8.raw[y*257+2+x*2]!==255-Math.round(result.values[y*128+x]*255))mismatches++;
    }
  }
  expect(mismatches).toBe(0);expect(levels.size).toBeGreaterThan(256);
});

test('2D interface saves and reopens, cancels 4K export and retries a transparent PNG', async ({page})=>{
  await expect(page.getByLabel('黑白纹理预览')).toBeVisible();
  await expect(page.getByRole('button',{name:'3D 表面'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'3D 预览'})).toHaveCount(0);
  await page.getByRole('button',{name:/02 颗粒斑点/}).click();
  await page.getByLabel('背景方式',{exact:true}).selectOption('transparent');
  await expect(page.getByLabel('透明检查底色')).toBeVisible();
  await page.getByLabel('纹理项目名称').fill('测试黑色颗粒');
  const save=page.waitForEvent('download');await page.getByRole('button',{name:'保存',exact:true}).click();
  const saved=await save, path=await saved.path();expect(path).toBeTruthy();
  await page.getByRole('button',{name:'新建',exact:true}).click();
  await page.locator('input[type=file]').first().setInputFiles(path!);
  await expect(page.getByLabel('纹理项目名称')).toHaveValue('测试黑色颗粒');
  await page.getByRole('button',{name:'导出素材',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('素材尺寸').selectOption('4096');
  await dialog.getByRole('button',{name:'下载素材'}).click();
  await expect(dialog.getByRole('button',{name:'取消生成'})).toBeVisible();
  await dialog.getByRole('button',{name:'取消生成'}).click();
  await expect(dialog.getByText('已取消，可继续调整并重新导出。',{exact:true})).toBeVisible();
  await dialog.getByLabel('素材尺寸').selectOption('512');
  const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载素材'}).click();
  const file=await download, data=readPng(await readFile((await file.path())!));
  expect([data.size,data.depth,data.color]).toEqual([512,8,4]);
  await expect(dialog.getByRole('button',{name:'下载素材'})).toBeEnabled();
  await dialog.getByRole('button',{name:'返回编辑'}).click();
  const legacy=await page.evaluate(async()=>{const{newProject}=await import('/src/features/project/model.ts');return JSON.stringify(newProject());});
  await page.locator('input[type=file]').first().setInputFiles({name:'旧版.texture.json',mimeType:'application/json',buffer:Buffer.from(legacy)});
  await expect(page.locator('.studio')).toBeVisible();
  await expect(page.getByRole('button',{name:'播放',exact:true})).toBeVisible();
});

test('SVG imports keep originals, clean scripts/external references, and reject invalid project data', async ({page})=>{
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><script>window.hacked=true</script><image href="https://example.com/unsafe.png"/><rect width="32" height="64" fill="black"/></svg>';
  await page.getByLabel('导入灰度源文件').setInputFiles({name:'灰度源.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
  await expect(page.getByRole('heading',{name:'灰度源.svg',exact:true})).toBeVisible();
  const result=await page.evaluate(async ()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts');
    const {parseMaterial,isSeamless}=await import('/src/features/material/model.ts');
    const p=useMaterialStore.getState().project;
    const original=p.sources[0].original;
    const bad=structuredClone(p);bad.layers[0].scale=1000000;
    let rejected=false;try{parseMaterial(JSON.stringify(bad));}catch{rejected=true;}
    const bad2=structuredClone(p);bad2.sources[0].mime='image/png';bad2.sources[0].original='https://example.com/image.png';
    let external=false;try{parseMaterial(JSON.stringify(bad2));}catch{external=true;}
    return{original,rejected,external,seamless:isSeamless(p),hacked:!!window.hacked};
  });
  expect(result.original).toBe(svg);expect(result.rejected&&result.external&&result.seamless).toBe(true);expect(result.hacked).toBe(false);
  await page.getByLabel('周期边缘融合',{exact:true}).uncheck();
  await expect(page.getByText('原图边缘未融合 · 512 px 预览')).toBeVisible();
});

test('locks survive randomization and undo; paired export has grayscale and matching normal manifest',async({page})=>{
  const result=await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts');
    const {newMaterial}=await import('/src/features/material/model.ts');
    const {materialTask}=await import('/src/features/material/workerClient.ts');
    const s=useMaterialStore.getState();s.replace(newMaterial('stone'));
    s.edit((p:any)=>{p.layers[0].locked=true;});const before=structuredClone(useMaterialStore.getState().project);
    s.randomize();const after=useMaterialStore.getState().project;
    const locked=before.layers[0].seed===after.layers[0].seed,changed=before.layers[1].seed!==after.layers[1].seed;
    s.undo();const undo=JSON.stringify(useMaterialStore.getState().project)===JSON.stringify(before);
    const p=newMaterial('stone');p.export.maps='both';p.export.depth=16;
    const output=await materialTask(p,128,true).promise;
    return{locked,changed,undo,zip:[...new Uint8Array(await output.blob.arrayBuffer())]};
  });
  expect(result.locked&&result.changed&&result.undo).toBe(true);
  const b=Buffer.from(result.zip), files=new Map<string,Buffer>();
  for(let off=0;b.readUInt32LE(off)===0x04034b50;){
    const size=b.readUInt32LE(off+18),len=b.readUInt16LE(off+26),extra=b.readUInt16LE(off+28),start=off+30+len+extra;
    files.set(b.toString('utf8',off+30,off+30+len),b.subarray(start,start+size));off=start+size;
  }
  expect(files.size).toBe(3);
  for(const[name,data]of files)if(name.endsWith('.png'))readPng(data);
  const manifest=JSON.parse(files.get('manifest.json')!.toString());
  expect(manifest.seamless).toBe(true);expect(manifest.texture.bitDepth).toBe(16);expect(manifest.normal.convention).toBe('OpenGL');
});

test('new preset families produce distinct seeded images and their dedicated controls change the field',async({page})=>{
  const result=await page.evaluate(async()=>{
    const {newMaterial,materialPresets,heightLayer,parseMaterial}=await import('/src/features/material/model.ts');
    const {renderMaterial}=await import('/src/features/material/engine.ts');
    const signatures=new Set<string>(),failures:string[]=[];
    for(const entry of materialPresets){
      const p=newMaterial(entry.id),maps=renderMaterial(p,64),restored=renderMaterial(parseMaterial(JSON.stringify(p)),64);
      let sum=0,squares=0,min=1,max=0;
      for(let i=0;i<maps.height.length;i++){
        const h=maps.height[i];sum+=h;squares+=h*h;min=Math.min(min,h);max=Math.max(max,h);
        if(!Number.isFinite(h)||h!==restored.height[i])failures.push(entry.id);
      }
      if(max-min<.01)failures.push(`${entry.id}:constant`);
      signatures.add(`${sum.toFixed(6)}:${squares.toFixed(6)}`);
    }
    const controls=[
      ['paper','coverage'],['paper','softness'],['marble','detail'],['marble','softness'],
      ['halftone','coverage'],['halftone','softness'],['hatch','detail'],['contours','coverage'],
      ['glow','coverage'],['glow','softness'],['bokeh','detail'],['interference','detail'],
    ];
    for(const[kind,param]of controls){
      const p=newMaterial();p.layers=[heightLayer(kind,{contrast:1,warp:0,scale:8,[param]:.1})];
      const a=renderMaterial(p,64);p.layers[0][param]=.85;const b=renderMaterial(p,64);
      if(!a.height.some((h:number,i:number)=>Math.abs(h-b.height[i])>.005))failures.push(`${kind}:${param}`);
    }
    const old=newMaterial('grain');delete old.layers[0].coverage;delete old.layers[0].softness;delete old.export.pigment;
    const migrated=parseMaterial(JSON.stringify(old));
    const invalid=structuredClone(migrated);invalid.layers[0].softness=NaN;
    let rejected=false;try{parseMaterial(JSON.stringify(invalid));}catch{rejected=true;}
    return{count:materialPresets.length,distinct:signatures.size,failures:failures.slice(0,10),migration:[migrated.layers[0].coverage,migrated.layers[0].softness,migrated.export.pigment],rejected};
  });
  expect(result.count).toBe(31);expect(result.distinct).toBe(31);expect(result.failures).toEqual([]);
  expect(result.migration).toEqual([.55,.35,'black']);expect(result.rejected).toBe(true);
});

test('white transparent light retains straight white channels and 8/16-bit alpha',async({page})=>{
  const result=await page.evaluate(async()=>{
    const{newMaterial}=await import('/src/features/material/model.ts');const{renderMaterial}=await import('/src/features/material/engine.ts');
    const{encodePng}=await import('/src/features/material/png.ts');
    const maps=renderMaterial(newMaterial('soft-glow'),64);
    return{values:[...maps.height],eight:[...await encodePng(maps,'height',8,true,'white')],sixteen:[...await encodePng(maps,'height',16,true,'white')]};
  });
  const eight=readPng(result.eight),sixteen=readPng(result.sixteen);let bad=0;
  expect([eight.color,eight.depth,sixteen.color,sixteen.depth]).toEqual([4,8,4,16]);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    if(eight.raw[y*129+1+x*2]!==255||eight.raw[y*129+2+x*2]!==Math.round(result.values[y*64+x]*255)
      ||sixteen.raw.readUInt16BE(y*257+1+x*4)!==65535||sixteen.raw.readUInt16BE(y*257+3+x*4)!==Math.round(result.values[y*64+x]*65535))bad++;
  }
  expect(bad).toBe(0);
});

test('category and search find paper/marble/pop/light presets and soft glow downloads as white alpha',async({page})=>{
  await page.getByLabel('纹理分类').selectOption('paper');
  await page.getByLabel('搜索纹理预设').fill('宣纸');
  await expect(page.locator('.material-preset')).toHaveCount(1);
  await page.getByRole('button',{name:/11 宣纸/}).click();
  await expect(page.getByLabel('纤维密度',{exact:true})).toBeVisible();
  await page.getByLabel('搜索纹理预设').fill('大理石');
  await expect(page.getByText('没有匹配的纹理',{exact:true})).toBeVisible();
  await page.getByLabel('纹理分类').selectOption('surface');
  await expect(page.locator('.material-preset')).toHaveCount(3);
  await page.getByRole('button',{name:/20 白大理石/}).click();
  await expect(page.getByLabel('脉络宽度',{exact:true})).toBeVisible();
  await page.getByLabel('搜索纹理预设').fill('');
  await page.getByLabel('纹理分类').selectOption('graphic');
  await page.getByRole('button',{name:/23 波普网点/}).click();
  await expect(page.getByLabel('网点覆盖',{exact:true})).toBeVisible();
  await page.getByLabel('纹理分类').selectOption('light');
  await page.getByRole('button',{name:/28 柔光/}).click();
  await expect(page.getByLabel('光晕柔和',{exact:true})).toBeVisible();
  await page.getByLabel('背景方式',{exact:true}).selectOption('transparent');
  await expect(page.getByLabel('透明纹理颜色')).toHaveValue('white');
  await page.getByLabel('透明检查底色').selectOption('dark');
  await page.getByRole('button',{name:'导出素材',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('素材尺寸').selectOption('128');
  const downloaded=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载素材'}).click();
  const file=await downloaded,data=readPng(await readFile((await file.path())!));
  expect(file.suggestedFilename()).toContain('White_Alpha');expect(data.color).toBe(4);
});
