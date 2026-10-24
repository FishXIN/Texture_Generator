import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '纹理工作台' })).toBeVisible();
});

test('saved project reproduces geometry and independent random streams preserve manual objects', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { newProject } = await import('/src/features/project/model.ts');
    const { parseProject } = await import('/src/features/project/io.ts');
    const { sanitizeSvg } = await import('/src/features/assets/svg.ts');
    const { buildScene } = await import('/src/features/texture/engine/scene.ts');
    const { useProjectStore } = await import('/src/features/project/store.ts');
    const p = newProject();
    const asset = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>', 'circle.svg');
    p.assets.push(asset);
    p.objects.push({ id: 'manual', layerId: p.layers[0].id, assetId: asset.id, x: 5, y: 120, width: 20, height: 20, rotation: 0, color: '', opacity: 1, locked: true, motionLocked: true });
    const first = await buildScene(p);
    const reopened = await buildScene(parseProject(JSON.stringify(p)));
    useProjectStore.getState().replace(p);
    useProjectStore.getState().selectLayer(p.layers[0].id);
    useProjectStore.getState().randomize('size');
    const second = await buildScene(useProjectStore.getState().project);
    const auto = (scene: any) => scene.layers[0].items.filter((i: any) => !i.manual);
    const positions = (scene: any) => auto(scene).map((i: any) => [i.x, i.y, i.rotation, i.color]);
    useProjectStore.getState().undo();
    const undo = JSON.stringify(useProjectStore.getState().project) === JSON.stringify(p);
    useProjectStore.getState().redo();
    const redo = useProjectStore.getState().project.layers[0].seeds.size !== p.layers[0].seeds.size;
    return { reproducible: JSON.stringify(first.layers) === JSON.stringify(reopened.layers), stable: JSON.stringify(positions(first)) === JSON.stringify(positions(second)),
      sizeChanged: auto(first)[0].width !== auto(second)[0].width, manual: JSON.stringify(first.layers[0].items.at(-1)) === JSON.stringify(second.layers[0].items.at(-1)), undo, redo };
  });
  expect(result).toEqual({ reproducible: true, stable: true, sizeChanged: true, manual: true, undo: true, redo: true });
});

test('periodic spacing includes adjacent tiles and all motion modes close smoothly', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { newProject } = await import('/src/features/project/model.ts');
    const { buildScene, atTime } = await import('/src/features/texture/engine/scene.ts');
    const p = newProject(); p.canvas.width = 128; p.canvas.height = 128;
    const layer = p.layers[0]; layer.count = 80; layer.minSize = 3; layer.maxSize = 3; layer.spacing = 4;
    const scene = await buildScene(p); const items = scene.layers[0].items;
    let minimum = Infinity;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const dx = Math.abs(items[i].x - items[j].x); const dy = Math.abs(items[i].y - items[j].y);
      minimum = Math.min(minimum, Math.hypot(Math.min(dx, 128 - dx), Math.min(dy, 128 - dy)));
    }
    const modes = [];
    for (const seamless of [false, true]) for (const kind of ['wander', 'drift', 'flow', 'rotate', 'breathe']) {
      p.canvas.seamless = seamless; layer.motion.enabled = true; layer.motion.kind = kind;
      const start = atTime(items[0], layer, p, 0); const end = atTime(items[0], layer, p, p.animation.duration);
      const before = atTime(items[0], layer, p, p.animation.duration - 0.0001);
      const after = atTime(items[0], layer, p, 0.0001);
      const delta = (a: number, b: number) => seamless ? Math.min(Math.abs(a - b), 128 - Math.abs(a - b)) : Math.abs(a - b);
      modes.push({ kind, seamless, closed: JSON.stringify(start) === JSON.stringify(end), jump: Math.max(delta(before.x, after.x), delta(before.y, after.y), Math.abs(before.rotation - after.rotation), Math.abs(before.width - after.width)) });
    }
    return { minimum, count: items.length, modes };
  });
  expect(result.count).toBe(80);
  expect(result.minimum).toBeGreaterThanOrEqual(8.5);
  for (const mode of result.modes) { expect(mode.closed, JSON.stringify(mode)).toBe(true); expect(mode.jump).toBeLessThan(0.05); }
});

test('SVG import cleans active references, preserves source, and reports effect-only assets', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { sanitizeSvg } = await import('/src/features/assets/svg.ts');
    const { newProject } = await import('/src/features/project/model.ts');
    const { buildScene } = await import('/src/features/texture/engine/scene.ts');
    const { exportCheck } = await import('/src/features/export/studioExport.ts');
    const { exportSvgString } = await import('/src/features/export/svgExporter.ts');
    const original = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" onload="alert(1)"><script>alert(1)</script><image href="https://example.com/secret.png"/><foreignObject/><style>@import "https://example.com/style";</style><filter id="f"><feGaussianBlur stdDeviation="1"/></filter><circle r="5" filter="url(#f)"/></svg>';
    const asset = sanitizeSvg(original, 'unsafe.svg');
    const p = newProject(); p.assets.push(asset); p.layers[0].shape = 'custom'; p.layers[0].assets = [{ id: asset.id, weight: 1 }]; p.layers[0].count = 1;
    const scene = await buildScene(p);
    const errors = exportCheck(scene, { ...p.export, format: 'svg' }).errors;
    const effects = exportCheck(scene, { ...p.export, format: 'svg', svgMode: 'effects' }).errors;
    let legacyBlocked=false;
    try{exportSvgString({baseAsset:{sourceType:'svg',rawText:original,name:'unsafe.svg',width:20,height:20},elementsById:new Map(),placements:[]});}catch{legacyBlocked=true;}
    const simple={id:'s',sourceType:'svg',name:'simple.svg',width:20,height:20,rawText:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="red"><defs><clipPath id="c"><rect width="20" height="20"/></clipPath></defs><circle r="5" clip-path="url(#c)"/></svg>'};
    const legacy=exportSvgString({baseAsset:simple,elementsById:new Map([['s',simple]]),placements:[{elementId:'s',x:10,y:10,width:20,height:20,rotation:0},{elementId:'s',x:15,y:15,width:20,height:20,rotation:0}]});
    const ids=[...new DOMParser().parseFromString(legacy,'image/svg+xml').querySelectorAll('[id]')].map(e=>e.id);
    return { source: asset.original === original, clean: !/onload|<script|foreignObject|https:|@import/.test(asset.svg), pure: asset.pure, issues: asset.issues.length, blocked: errors.length > 0, effects: effects.length,legacyBlocked,legacyUnique:new Set(ids).size===ids.length };
  });
  expect(result).toMatchObject({ source: true, clean: true, pure: false, blocked: true, effects: 0,legacyBlocked:true,legacyUnique:true });
  expect(result.issues).toBeGreaterThan(3);
});

test('PNG and pure SVG match alpha, masks and edge copies without duplicate IDs', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { newProject } = await import('/src/features/project/model.ts');
    const { sanitizeSvg } = await import('/src/features/assets/svg.ts');
    const { buildScene } = await import('/src/features/texture/engine/scene.ts');
    const { drawTile, sceneImages } = await import('/src/features/texture/engine/render.ts');
    const { studioSvg } = await import('/src/features/export/studioSvg.ts');
    const p = newProject(); p.canvas.width = 128; p.canvas.height = 128; p.layers[0].count = 0; p.layers[0].opacity = 0.7;
    const a = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><linearGradient id="g"><stop stop-opacity="0.2"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="20" height="20" fill="url(#g)"/></svg>', 'gradient.svg');
    p.assets.push(a); p.objects.push({ id: 'edge', layerId: p.layers[0].id, assetId: a.id, x: 2, y: 2, width: 32, height: 32, rotation: 0, color: '#677448', opacity: 1, locked: false, motionLocked: true });
    const diffs = []; let duplicate = false; let raster = false; let alphaMax = 0;
    for (const mode of ['pure', 'optimized']) for (const mask of ['none', 'rect', 'ellipse', 'svg']) for (const outside of [false, true]) {
      const m = p.layers[0].mask; m.enabled = mask !== 'none'; m.kind = mask === 'none' ? 'rect' : mask; m.mode = outside ? 'outside' : 'inside'; m.assetId = a.id;
      m.x = -10; m.y = -10; m.width = 30; m.height = 30;
      const scene = await buildScene(p); const canvas = drawTile(scene, 0, 1, false, await sceneImages(scene));
      const text = studioSvg(scene, 0, { x: 0, y: 0, width: 128, height: 128 }, 1, false, mode);
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml'); const ids = [...doc.querySelectorAll('[id]')].map(n => n.id);
      duplicate ||= new Set(ids).size !== ids.length; raster ||= !!doc.querySelector('image,filter,text');
      const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = `data:image/svg+xml,${encodeURIComponent(text)}`; });
      const c = document.createElement('canvas'); c.width = 128; c.height = 128; c.getContext('2d')!.drawImage(image, 0, 0);
      const x = canvas.getContext('2d')!.getImageData(0, 0, 128, 128).data; const y = c.getContext('2d')!.getImageData(0, 0, 128, 128).data;
      let sum = 0; let maximum = 0;
      for (let i = 3; i < x.length; i += 4) { sum += Math.abs(x[i] - y[i]); maximum = Math.max(maximum, Math.abs(x[i] - y[i])); if (mask === 'none') alphaMax = Math.max(alphaMax, x[i]); }
      diffs.push({ mode, mask, outside, mean: sum / 16384, maximum });
    }
    return { diffs, duplicate, raster, alphaMax };
  });
  expect(result.duplicate).toBe(false); expect(result.raster).toBe(false);
  expect(result.alphaMax).toBeLessThan(180);
  for (const diff of result.diffs) expect(diff.mean, JSON.stringify(diff)).toBeLessThan(0.2);
});

test('fractional-scale tiled PNG has the same pixels as a direct periodic render', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { newProject } = await import('/src/features/project/model.ts');
    const { buildScene } = await import('/src/features/texture/engine/scene.ts');
    const { drawTile, sceneImages } = await import('/src/features/texture/engine/render.ts');
    const p = newProject(); p.canvas.width = 65; p.canvas.height = 67; p.layers[0].count = 150; p.layers[0].opacity = 1;
    const scene = await buildScene(p); const images = await sceneImages(scene);
    const region = { x: 0, y: 0, width: 195, height: 201 }; const scale = 1.25;
    const canvas = drawTile(scene, 0, scale, false, images, region);
    const text = (await import('/src/features/export/studioSvg.ts')).studioSvg(scene, 0, region, scale, false, 'pure');
    const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = `data:image/svg+xml,${encodeURIComponent(text)}`; });
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d')!.drawImage(image, 0, 0);
    const a = canvas.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; const b = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let seam = 0; let samples = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (Math.abs(x - 65 * scale) < 2 || Math.abs(y - 67 * scale) < 2) {
      seam += Math.abs(a[(y * c.width + x) * 4 + 3] - b[(y * c.width + x) * 4 + 3]); samples++;
    }
    return { averageSeamDifference: seam / samples };
  });
  expect(result.averageSeamDifference).toBeLessThan(10);
});

test('transparent sequence ZIP validates CRC, timing, alpha and cancellation recovery', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { newProject } = await import('/src/features/project/model.ts');
    const { buildScene } = await import('/src/features/texture/engine/scene.ts');
    const { createExport, exportCheck } = await import('/src/features/export/studioExport.ts');
    const { crc32 } = await import('/src/features/export/zip.ts');
    const p = newProject(); p.canvas.width = 64; p.canvas.height = 64; p.animation.duration = 1; p.layers[0].count = 50; p.layers[0].motion.enabled = true;
    const scene = await buildScene(p); const settings = { ...p.export, format: 'sequence', fps: 4 };
    const controller = new AbortController(); let canceled = false;
    try { await createExport(scene, settings, 0, controller.signal, (v: number) => { if (v > 0) controller.abort(); }); } catch (e) { canceled = (e as Error).name === 'AbortError'; }
    const { blob } = await createExport(scene, settings, 0, new AbortController().signal, () => {});
    const bytes = new Uint8Array(await blob.arrayBuffer()); const view = new DataView(bytes.buffer);
    const files = []; let offset = 0; let validCrc = true; const alpha = []; const signatures = [];
    while (view.getUint32(offset, true) === 0x04034b50) {
      const size = view.getUint32(offset + 18, true); const length = view.getUint16(offset + 26, true); const extra = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + length)); const start = offset + 30 + length + extra;
      const data = bytes.slice(start, start + size); validCrc &&= crc32(data) === view.getUint32(offset + 14, true);
      files.push(name);
      if (name.endsWith('.png')) {
        const bitmap = await createImageBitmap(new Blob([data])); const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
        c.getContext('2d')!.drawImage(bitmap, 0, 0); const pixels = c.getContext('2d')!.getImageData(0, 0, 64, 64).data;
        alpha.push(pixels.some((v, i) => i % 4 === 3 && v === 0) && pixels.some((v, i) => i % 4 === 3 && v > 0 && v < 255)); signatures.push(crc32(pixels)); bitmap.close();
      }
      offset = start + size;
    }
    const invalidFrames = exportCheck({ ...scene, project: { ...p, animation: { duration: 1.5 } } }, { ...settings, fps: 3 }).errors;
    return { canceled, validCrc, files, alpha, moving: new Set(signatures).size > 1, invalidFrames: invalidFrames.length > 0 };
  });
  expect(result).toMatchObject({ canceled: true, validCrc: true, moving: true, invalidFrames: true });
  expect(result.files).toEqual(['frame_0000.png', 'frame_0001.png', 'frame_0002.png', 'frame_0003.png', 'manifest.json']);
  expect(result.alpha).toEqual([true, true, true, true]);
});

test('SVG styles retain cascade and gradients retain alpha when recolored', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const {sanitizeSvg,assetSvg,assetImage}=await import('/src/features/assets/svg.ts');
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><style>.a {fill: red} rect {fill: blue} .a {stroke: green} #box {fill: yellow !important}</style><rect id="box" class="a" width="20" height="20" style="fill: black"/></svg>';
    const asset=sanitizeSvg(svg,'styles.svg');
    const node=new DOMParser().parseFromString(asset.svg,'image/svg+xml').querySelector('rect')!;
    const style=document.createElement('span').style;style.cssText=node.getAttribute('style')!;
    const colored=assetSvg(asset,'test','#677448');
    const tall=sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 300"><rect width="1" height="300"/></svg>','tall.svg');
    const image=await assetImage(tall);
    let rejected=false;try{sanitizeSvg('<svg viewBox="0 0 1 10000"/>','too-tall.svg');}catch{rejected=true;}
    return {fill:style.getPropertyValue('fill'),priority:style.getPropertyPriority('fill'),stroke:style.getPropertyValue('stroke'),
      scoped:!colored.includes('<style'),rejected,largest:Math.max(image.width,image.height)};
  });
  expect(result).toEqual({fill:'yellow',priority:'important',stroke:'green',scoped:true,rejected:true,largest:256});
});

test('missing assets and invalid projects fail clearly while scene complexity stays bounded', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const {newProject,newLayer}=await import('/src/features/project/model.ts');
    const {parseProject}=await import('/src/features/project/io.ts');
    const {buildScene}=await import('/src/features/texture/engine/scene.ts');
    const {exportCheck}=await import('/src/features/export/studioExport.ts');
    const {useProjectStore,duplicateLayer}=await import('/src/features/project/store.ts');
    const p=newProject();p.layers[0].mask.enabled=true;p.layers[0].mask.kind='svg';
    const errors=exportCheck(await buildScene(p),p.export).errors;
    let bad=false;try{parseProject(JSON.stringify(p));}catch{bad=true;}
    p.layers[0].mask.enabled=false;p.layers=Array.from({length:4},()=>{const l=newLayer();l.count=5000;return l;});
    useProjectStore.getState().replace(p);useProjectStore.getState().addLayer();
    const next=useProjectStore.getState().project;duplicateLayer(p.layers[0].id);
    const valid=parseProject(JSON.stringify(useProjectStore.getState().project));
    const scene=await buildScene(valid);
    return {errors:errors.length,bad,newCount:next.layers.at(-1)!.count,total:scene.count,layers:valid.layers.length};
  });
  expect(result).toMatchObject({bad:true,newCount:0,total:20000,layers:5});
  expect(result.errors).toBeGreaterThan(0);
});

test('layer blending and selection exports agree between Canvas and SVG', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const {newProject,newLayer}=await import('/src/features/project/model.ts');
    const {buildScene}=await import('/src/features/texture/engine/scene.ts');
    const {drawTile,sceneImages}=await import('/src/features/texture/engine/render.ts');
    const {studioSvg}=await import('/src/features/export/studioSvg.ts');
    const p=newProject();p.canvas.width=64;p.canvas.height=64;p.layers[0].count=10;p.layers[0].minSize=30;p.layers[0].maxSize=30;
    const l=newLayer();l.count=10;l.minSize=30;l.maxSize=30;l.color='#bb644e';p.layers.push(l);
    const results=[];const region={x:8,y:9,width:40,height:40};
    for(const blend of ['normal','multiply','screen','overlay','color-burn']) {
      l.blend=blend;const scene=await buildScene(p);const canvas=drawTile(scene,0,1,true,await sceneImages(scene),region);
      const text=studioSvg(scene,0,region,1,true,'pure');const image=new Image();
      await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=reject;image.src=`data:image/svg+xml,${encodeURIComponent(text)}`;});
      const c=document.createElement('canvas');c.width=40;c.height=40;c.getContext('2d')!.drawImage(image,0,0);
      const a=canvas.getContext('2d')!.getImageData(0,0,40,40).data;const b=c.getContext('2d')!.getImageData(0,0,40,40).data;
      let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);results.push({blend,mean:sum/a.length});
    }
    return results;
  });
  for(const diff of result)expect(diff.mean,JSON.stringify(diff)).toBeLessThan(3);
});

test('UI supports SVG placement, drag, locks, undo, project download and reopen', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.locator('.library input[type=file]').setInputFiles({ name: 'symbol.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 0L40 40H0Z" fill="#b7684d"/></svg>') });
  await expect(page.getByText('symbol.svg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '放置', exact: true }).click();
  await expect(page.getByRole('heading', { name: '手工图形' })).toBeVisible();
  const canvas = page.getByLabel('纹理画布'); const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 5 }); await page.mouse.up();
  const before = await page.evaluate(async () => (await import('/src/features/project/store.ts')).useProjectStore.getState().project.objects[0]);
  expect(before.x).toBeGreaterThan(256);
  await page.getByRole('button', { name: '换一个', exact: true }).click();
  const after = await page.evaluate(async () => (await import('/src/features/project/store.ts')).useProjectStore.getState().project.objects[0]);
  expect(after).toEqual(before);
  await page.getByRole('checkbox', { name: '锁定图形', exact: true }).check();
  await expect(page.getByRole('spinbutton', { name: '位置 X数值', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await canvas.click({ position: { x: box.width * before.x / 512, y: box.height * before.y / 512 } });
  await expect(page.getByRole('checkbox', { name: '锁定图形', exact: true })).not.toBeChecked();
  await page.getByLabel('项目名称').fill('验收纹理');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '保存', exact: true }).click();
  const download = await downloadPromise; const path = testInfo.outputPath('saved.texture.json'); await download.saveAs(path);
  const saved = JSON.parse(await readFile(path, 'utf8')); expect(saved.objects[0].x).toBe(before.x);
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.locator('.studio-header input[type=file]').setInputFiles(path);
  await expect(page.getByLabel('项目名称')).toHaveValue('验收纹理');
  await page.getByRole('button', { name: '整面预览', exact: true }).click();
  await expect(page.getByText('3 × 3 整面预览')).toBeVisible();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const pngDownload = page.waitForEvent('download'); await page.getByRole('button', { name: '导出并保存' }).click();
  expect((await pngDownload).suggestedFilename()).toBe('验收纹理_unit.png');
  await expect(page.getByText('导出完成', { exact: true })).toBeVisible();
  await page.getByRole('combobox',{name:'文件格式'}).selectOption('sequence');
  await page.getByRole('spinbutton',{name:'帧率数值',exact:true}).fill('4');
  const zipDownload=page.waitForEvent('download');await page.getByRole('button',{name:'导出并保存'}).click();
  const zipPath=testInfo.outputPath('sequence.zip');await (await zipDownload).saveAs(zipPath);
  expect(execFileSync('unzip',['-t',zipPath],{encoding:'utf8'})).toContain('No errors detected');
  await page.getByRole('button', { name: '返回编辑', exact: true }).click();
  expect(errors).toEqual([]);
});
