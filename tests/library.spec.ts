import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');});

test('algorithms use distinct math, seeded statistics, periodic values and derivatives',async({page})=>{
  const result=await page.evaluate(async()=>{
    const a=await import('/src/features/material/algorithms.ts');
    let period=0,gradient=0;const signatures=new Set<string>();
    for(const kind of Object.keys(a.algorithms)){
      const field=a.algorithmField(kind,8,919,.6),at=(u:number,v:number)=>{const o=a.scratch();field(u,v,o);return o;};
      let sum=0;
      for(let i=0;i<24;i++){
        const u=.137+i*.0371,v=.291+i*.0197,p=at(u,v),q=at(u+1,v-1);
        for(const k of ['h','du','dv'])period=Math.max(period,Math.abs(p[k]-q[k]));
        sum+=p.h;
        if(!['uniform','gaussian','salt','poisson','blue'].includes(kind)){
          const e=1e-6,du=(at(u+e,v).h-at(u-e,v).h)/(2*e),dv=(at(u,v+e).h-at(u,v-e).h)/(2*e);
          gradient=Math.max(gradient,Math.abs(du-p.du)/(1+Math.abs(du)),Math.abs(dv-p.dv)/(1+Math.abs(dv)));
        }
      }
      signatures.add(sum.toFixed(8));
    }
    const rng=a.random(77);let gsum=0,g2=0,psum=0,p2=0;
    for(let i=0;i<20000;i++){const g=a.gaussian(rng),p=a.poisson(6,rng);gsum+=g;g2+=g*g;psum+=p;p2+=p*p;}
    return{period,gradient,distinct:signatures.size,mean:gsum/20000,variance:g2/20000-(gsum/20000)**2,pmean:psum/20000,pvariance:p2/20000-(psum/20000)**2};
  });
  expect(result.period).toBeLessThan(1e-6);expect(result.gradient).toBeLessThan(.002);expect(result.distinct).toBe(10);
  expect(Math.abs(result.mean)).toBeLessThan(.03);expect(result.variance).toBeGreaterThan(.95);expect(result.variance).toBeLessThan(1.05);
  expect(Math.abs(result.pmean-6)).toBeLessThan(.1);expect(Math.abs(result.pvariance-6)).toBeLessThan(.3);
});

test('blue-noise suppresses low frequencies and path/spaced/symmetry layouts keep their geometry',async({page})=>{
  const result=await page.evaluate(async()=>{
    const a=await import('/src/features/material/algorithms.ts'),m=await import('/src/features/material/model.ts'),p=await import('/src/features/material/particles.ts');
    const blue=a.bluePoints(256,177),rng=a.random(177),uniform=Array.from({length:256},()=>({x:rng(),y:rng()}));
    const power=(points:any[])=>{
      let sum=0,count=0;
      for(let x=-3;x<=3;x++)for(let y=-3;y<=3;y++){
        if(!x&&!y)continue;let re=0,im=0;for(const p of points){const t=2*Math.PI*(p.x*x+p.y*y);re+=Math.cos(t);im+=Math.sin(t);}
        sum+=(re*re+im*im)/points.length;count++;
      }return sum/count;
    };
    const spaced=p.createParticles(m.heightLayer('particles',{count:200,distribution:'spaced',spacing:.06,sizeMax:.01,sizeMin:.005,softness:0}));
    const path=p.pathPositions([{x:0,y:0},{x:.5,y:0},{x:.5,y:.5}],11),distances=path.slice(1).map((v:any,i:number)=>Math.hypot(v.x-path[i].x,v.y-path[i].y));
    const mirror=p.createParticles(m.heightLayer('particles',{count:16,distribution:'mirror',shape:'leaf'}));
    const kaleido=p.createParticles(m.heightLayer('particles',{count:24,distribution:'kaleidoscope',sectors:6,sizeMin:.01,sizeMax:.01}));
    const radii=kaleido.slice(0,6).map((q:any)=>Math.hypot(q.x-.5,q.y-.5));
    return{bluePower:power(blue),randomPower:power(uniform),minimum:p.minimumParticleDistance(spaced),actual:spaced.length,pathError:Math.max(...distances.map((v:number)=>Math.abs(v-.1))),flips:mirror.filter((q:any)=>q.flipX||q.flipY).length,radiusError:Math.max(...radii)-Math.min(...radii)};
  });
  expect(result.bluePower).toBeLessThan(result.randomPower*.3);expect(result.minimum).toBeGreaterThanOrEqual(.06-1e-9);
  expect(result.actual).toBeGreaterThan(100);expect(result.pathError).toBeLessThan(1e-9);expect(result.flips).toBe(12);expect(result.radiusError).toBeLessThan(1e-9);
});

test('all monochrome presets are reproducible, nonconstant and reachable from the shared engine',async({page})=>{
  test.setTimeout(120000);
  const result=await page.evaluate(async()=>{
    const m=await import('/src/features/material/model.ts'),e=await import('/src/features/material/engine.ts');
    const failures:string[]=[],signatures=new Set<string>();
    let periodic=0;
    for(const preset of m.materialPresets){
      const p=m.newMaterial(preset.id),sample=e.createSampler(p),restored=e.createSampler(m.parseMaterial(JSON.stringify(p))),values:number[]=[];
      for(let i=0;i<128;i++){
        const u=(i*.61803398875)%1,v=(i*.41421356237+.131)%1,a={h:0,du:0,dv:0},b={...a};sample(u,v,a);restored(u,v,b);
        if(!Number.isFinite(a.h)||!Number.isFinite(a.du)||a.h!==b.h)failures.push(preset.id);
        sample(u+1,v-1,b);
        for(const key of ['h','du','dv'] as const)periodic=Math.max(periodic,Math.abs(a[key]-b[key])/(1+Math.abs(a[key])));
        values.push(a.h);
      }
      if(Math.max(...values)-Math.min(...values)<.001)failures.push(`${preset.id}:constant`);
      signatures.add(values.map(v=>v.toFixed(6)).join(','));
    }
    return{count:m.materialPresets.length,groups:new Set(m.materialPresets.map((p:any)=>p.group)).size,failures,distinct:signatures.size,periodic};
  });
  expect(result.count).toBeGreaterThan(110);expect(result.groups).toBe(11);expect(result.failures).toEqual([]);expect(result.distinct).toBe(result.count);
  expect(result.periodic).toBeLessThan(1e-5);
});

test('every motion closes in time and space; curl flow has zero divergence and moves points along a varying field',async({page})=>{
  const result=await page.evaluate(async()=>{
    const m=await import('/src/features/material/model.ts'),e=await import('/src/features/material/engine.ts'),a=await import('/src/features/material/animation.ts');
    let period=0,time=0;const unchanged:string[]=[];
    for(const motion of Object.keys(m.motions).filter(k=>k!=='none')){
      for(const kind of ['particles','noise','snow']){
        const p=m.newMaterial();p.layers=[m.heightLayer(kind,{motion,amplitude:.2,scale:6,count:200,sizeMin:.02,sizeMax:.04,softness:.3,contrast:1,warp:.2})];
        const fields=[e.createSampler(p,[],0),e.createSampler(p,[],1),e.createSampler(p,[],.31)];
        let changed=false;
        for(let i=0;i<24;i++){
          const u=(.137+i*.113)%1,v=(.291+i*.173)%1,at=(f:any,x:number,y:number)=>{const o={h:0,du:0,dv:0};f(x,y,o);return o;};
          const x=at(fields[0],u,v),y=at(fields[1],u,v),z=at(fields[2],u,v),repeat=at(fields[2],u+1,v-1);
          time=Math.max(time,Math.abs(x.h-y.h));period=Math.max(period,Math.abs(z.h-repeat.h));
          if(Math.abs(x.h-z.h)>.001)changed=true;
        }
        if(!changed&&kind==='particles'&&motion!=='refresh')unchanged.push(motion);
      }
    }
    const x=.173,y=.319,d=1e-5,vx1=a.curlVelocity(x+d,y,9),vx0=a.curlVelocity(x-d,y,9),vy1=a.curlVelocity(x,y+d,9),vy0=a.curlVelocity(x,y-d,9);
    const divergence=(vx1.x-vx0.x+vy1.y-vy0.y)/(2*d),one=a.flowMap(.1,.2,.2,9),two=a.flowMap(.4,.5,.2,9);
    return{time,period,unchanged,divergence,different:Math.hypot((one.x-.1)-(two.x-.4),(one.y-.2)-(two.y-.5))};
  });
  expect(result.time).toBeLessThan(1e-8);expect(result.period).toBeLessThan(1e-8);expect(result.unchanged).toEqual([]);
  expect(Math.abs(result.divergence)).toBeLessThan(1e-6);expect(result.different).toBeGreaterThan(.01);
});

test('input alpha and dark luminance drive actual stamp damage and image halftones',async({page})=>{
  const result=await page.evaluate(async()=>{
    const m=await import('/src/features/material/model.ts'),e=await import('/src/features/material/engine.ts');
    const pixels=new Float32Array(64).fill(0),alpha=new Float32Array(64).map((_,i)=>i%8<4?1:0),s={id:'source',width:8,height:8,pixels,gray:pixels,alpha};
    const values:any={};
    for(const kind of ['stamp','wear','halftone','halftoneSquare','halftoneEllipse','halftoneLine','copier','film']){
      const p=m.newMaterial();p.layers=[m.heightLayer(kind,{sourceId:'source',tileSource:false,contrast:1,warp:0,coverage:kind==='film'?.8:0,response:'dark',scale:8})];
      const f=e.createSampler(p,[s]),at=(u:number,v:number)=>{const o={h:0,du:0,dv:0};f(u,v,o);return o.h;};
      values[kind]=[at(.1875,.1875),at(.8125,.1875)];
    }
    return values;
  });
  for(const kind of ['stamp','wear']){expect(result[kind][0]).toBeLessThan(.1);expect(result[kind][1]).toBe(1);}
  expect(result.copier[0]).toBeLessThan(.4);expect(result.copier[1]).toBe(1);
  for(const kind of ['halftone','halftoneSquare','halftoneEllipse','halftoneLine']){expect(result[kind][0]).toBeLessThan(.1);expect(result[kind][1]).toBe(1);}
  expect(result.film[1]).toBe(1);expect(result.film[0]).toBeLessThan(1);
});

test('real SVG structure, optimized reuse, transparent masks and sequence frame phases agree with their contracts',async({page})=>{
  const result=await page.evaluate(async()=>{
    const m=await import('/src/features/material/model.ts'),v=await import('/src/features/material/vector.ts'),w=await import('/src/features/material/workerClient.ts');
    const p=m.newMaterial('repeat');p.export.size=128;
    const pure=v.materialSvg(p),optimized=v.materialSvg(p,'optimized');
    p.export.background='transparent';const transparent=v.materialSvg(p);
    const mixed=m.newMaterial('smoke');let rejected=false;try{v.materialSvg(mixed);}catch{rejected=true;}
    p.layers[0].motion='wave';p.timeline.duration=1;p.timeline.fps=4;
    const sequence=await w.materialTask(p,128,true,undefined,{format:'sequence'}).promise;
    const effect=await w.materialTask(mixed,128,true,undefined,{format:'effect'}).promise;
    p.export.maps='normal';mixed.export.maps='normal';
    let normalVector=false,normalEffect=false;
    try{v.materialSvg(p);}catch{normalVector=true;}
    try{await w.materialTask(mixed,128,true,undefined,{format:'effect'}).promise;}catch{normalEffect=true;}
    return{pure,optimized,transparent,rejected,normalVector,normalEffect,zip:[...new Uint8Array(await sequence.blob.arrayBuffer())],effect:await effect.blob.text()};
  });
  expect(result.pure).not.toMatch(/<image|<filter/);expect(result.optimized).toContain('<use');expect(result.transparent).toContain('<mask');expect(result.transparent).not.toContain('<filter');
  expect(result.rejected).toBe(true);expect(result.effect).toContain('embedded raster');expect(result.effect).toContain('data:image/png;base64,');
  expect(result.normalVector).toBe(true);expect(result.normalEffect).toBe(true);
  const b=Buffer.from(result.zip),files=new Map<string,Buffer>();
  for(let off=0;b.readUInt32LE(off)===0x04034b50;){const size=b.readUInt32LE(off+18),len=b.readUInt16LE(off+26),extra=b.readUInt16LE(off+28),start=off+30+len+extra;files.set(b.toString('utf8',off+30,off+30+len),b.subarray(start,start+size));off=start+size;}
  const manifest=JSON.parse(files.get('manifest.json')!.toString());expect(manifest.frames).toBe(4);expect(manifest.duration).toBe(1);
  expect(files.size).toBe(5);const frames=[...files].filter(([name])=>name.endsWith('.png'));expect(frames[0][1].equals(frames[1][1])).toBe(false);
});

test('pure SVG pixels match grayscale and clean alpha, including imported SVG and periodic edge copies',async({page})=>{
  test.setTimeout(120000);
  const result=await page.evaluate(async()=>{
    const m=await import('/src/features/material/model.ts'),e=await import('/src/features/material/engine.ts'),v=await import('/src/features/material/vector.ts'),i=await import('/src/features/material/import.ts');
    const source=(await i.importHeight(new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 100 80"><path d="M10 20 L110 20 L80 100 Z" fill="#333"/><circle cx="35" cy="40" r="10" fill="white" opacity=".4"/></svg>'],'input.svg',{type:'image/svg+xml'}))).source;
    const decoded=await i.decodeSource(source),p=m.newMaterial();p.sources=[source];p.export.size=128;
    p.layers=[m.heightLayer('particles',{softness:0,contrast:1,warp:0,distribution:'manual',objects:[
      {id:'edge-object',x:.02,y:.2,size:.11,angle:27,aspect:1.5,gray:.2,opacity:.65,shape:'ring',sourceId:'',flipX:false,flipY:false,locked:false,motionLocked:false},
      {id:'svg-object',x:.7,y:.65,size:.2,angle:-15,aspect:1.2,gray:0,opacity:.8,shape:'custom',sourceId:source.id,flipX:true,flipY:false,locked:false,motionLocked:false},
      {id:'large-object',x:.3,y:.45,size:.2,angle:32,aspect:8,gray:.35,opacity:.3,shape:'square',sourceId:'',flipX:false,flipY:false,locked:false,motionLocked:false},
    ]})];
    let maxMean=0;const bad:string[]=[];
    for(const layout of ['manual','refresh']){
      if(layout==='refresh'){
        p.layers=[m.heightLayer('particles',{softness:0,contrast:1,warp:0,count:12,sizeMin:.07,sizeMax:.1,aspect:1.3,alphaMin:.4,alphaMax:.8,motion:'refresh'})];
        p.timeline.phase=.31;
      }
      for(const bg of ['white','transparent'])for(const pigment of ['black','white']){
        p.export.background=bg;p.export.pigment=pigment;
        const field=e.createSampler(p,[decoded]),svg=v.materialSvg(p,'optimized'),image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();
        const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,128,128).data;
        let error=0;
        for(let y=0;y<128;y++)for(let x=0;x<128;x++){
          // SVG antialiases area coverage; independently integrate the field
          // inside each pixel instead of treating an edge as one binary sample.
          let height=0;const o={h:0,du:0,dv:0};
          for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){field((x+(sx+.5)/4)/128,(y+(sy+.5)/4)/128,o);height+=o.h/16;}
          const k=(y*128+x)*4,expected=bg==='white'?height*255:(pigment==='white'?height:1-height)*255;
          const actual=bg==='white'?pixels[k]:pixels[k+3];error+=Math.abs(expected-actual);
          if(bg==='transparent'&&pixels[k+3]>20&&pixels[k]!== (pigment==='white'?255:0))bad.push(`${bg}:${pigment}`);
        }
        maxMean=Math.max(maxMean,error/(128*128));
      }
    }
    return{maxMean,bad:bad.slice(0,5)};
  });
  expect(result.maxMean).toBeLessThan(1.5);expect(result.bad).toEqual([]);
});

test('unified UI edits paths, manual placement, imported alpha, animation and vector export with save/undo',async({page})=>{
  await page.getByLabel('纹理分类').selectOption('pattern');
  await page.getByRole('button',{name:/119 手工编排/}).click();
  await page.getByText('更多调整',{exact:true}).click();
  await page.getByText('图形与分布',{exact:true}).click();
  await expect(page.getByLabel('分布方式')).toHaveValue('manual');
  const canvas=page.getByLabel('画布预览'),rect=(await canvas.boundingBox())!;
  await expect.poll(()=>canvas.evaluate((c:HTMLCanvasElement)=>c.width)).toBe(512);
  const before=await page.evaluate(async()=>{const {useMaterialStore}=await import('/src/features/material/store.ts');return useMaterialStore.getState().project.layers[0].objects[0];});
  await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.25);await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.33,rect.y+rect.height*.38,{steps:5});await page.mouse.up();
  const after=await page.evaluate(async()=>{const {useMaterialStore}=await import('/src/features/material/store.ts');return useMaterialStore.getState().project.layers[0].objects[0];});
  expect(after.x-before.x).toBeCloseTo(.13,2);expect(after.y-before.y).toBeCloseTo(.13,2);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  const undo=await page.evaluate(async()=>{const {useMaterialStore}=await import('/src/features/material/store.ts');return useMaterialStore.getState().project.layers[0].objects[0];});
  expect(undo.x).toBe(before.x);
  await page.getByRole('button',{name:'复制纹理图层',exact:true}).click();
  const copied=await page.evaluate(async()=>{
    const {useMaterialStore}=await import('/src/features/material/store.ts'),m=await import('/src/features/material/model.ts'),g=await import('/src/features/material/particles.ts');
    const p=m.parseMaterial(JSON.stringify(useMaterialStore.getState().project)),a=g.createParticles(p.layers[0]),b=g.createParticles(p.layers[1]);
    return{count:p.layers.length,newIds:a.every((o:any,i:number)=>o.id!==b[i].id),sameOutlines:a.every((o:any,i:number)=>JSON.stringify(o.outline)===JSON.stringify(b[i].outline))};
  });
  expect(copied).toEqual({count:2,newIds:true,sameOutlines:true});
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await page.getByText('更多调整',{exact:true}).click();
  await page.getByText('图层运动',{exact:true}).click();await page.getByLabel('运动方式').selectOption('flow');
  await page.getByRole('button',{name:'播放纹理'}).click();await expect(page.getByRole('button',{name:'暂停纹理'})).toBeVisible();
  await page.getByRole('button',{name:'暂停纹理'}).click();await page.getByLabel('运动方式').selectOption('none');
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByText('高级设置',{exact:true}).click();await dialog.getByLabel('输出通道').selectOption('normal');
  await dialog.getByLabel('导出格式').selectOption('optimized');
  await expect(dialog.getByLabel('输出通道')).toHaveCount(0);await expect(dialog.getByLabel('灰度位深')).toHaveCount(0);
  const downloaded=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载素材'}).click();
  expect((await downloaded).suggestedFilename()).toContain('optimized.svg');await dialog.getByRole('button',{name:'返回编辑'}).click();
  await page.getByText('图形与分布',{exact:true}).click();
  await page.getByLabel('分布方式').selectOption('path');await expect(page.getByLabel('路径 1 X')).toBeVisible();
  await page.getByLabel('路径 1 X').fill('0.15');await expect(page.getByLabel('路径 1 X')).toHaveValue('0.15');
  const path=await page.evaluate(async()=>{const {useMaterialStore}=await import('/src/features/material/store.ts');return useMaterialStore.getState().project.layers[0].path[0].x;});expect(path).toBe(.15);
});
