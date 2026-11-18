const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
async function findApp(){
  const release=path.resolve('release');
  if(process.platform==='win32')return path.join(release,'win-unpacked','Texture Generator.exe');
  for(const dir of await fs.readdir(release))if(dir.startsWith('mac')){
    const executable=path.join(release,dir,'Texture Generator.app','Contents','MacOS','Texture Generator');
    try{await fs.access(executable);return executable;}catch{}
  }
  throw new Error('No packaged desktop application found');
}
(async()=>{
  const executable=process.argv[2]||await findApp(),profile=await fs.mkdtemp(path.join(os.tmpdir(),'texture-desktop-'));
  const output=path.resolve('release',`smoke-${process.platform}-${process.arch}`);await fs.mkdir(output,{recursive:true});
  let app;
  try{
    app=await electron.launch({executablePath:executable,args:[`--user-data-dir=${profile}`],timeout:60000});
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await expect(page.getByRole('heading',{name:'Texture Generator',exact:true})).toBeVisible({timeout:30000});
    await expect.poll(()=>page.getByLabel('画布预览').evaluate(c=>c.width),{timeout:30000}).toBe(512);
    await page.getByRole('button',{name:'项目菜单'}).click();await page.getByRole('button',{name:'新建项目',exact:true}).click();
    await page.getByRole('button',{name:'上传元素',exact:true}).click();
    await page.getByLabel('上传素材文件').setInputFiles({name:'desktop-leaf.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><path d="M0 16 Q32 -16 64 16 Q32 48 0 16Z" fill="#29966e"/></svg>')});
    await expect(page.getByRole('heading',{name:'desktop-leaf',exact:true})).toBeVisible();await page.getByLabel('数量数值',{exact:true}).fill('8');
    const choose=async(label,value)=>{await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('listbox').locator(`[data-value="${value}"]`).click();};
    await choose('图案边界','canvas');await page.getByLabel('边缘间距数值',{exact:true}).fill('32');
    const svgPath=path.join(output,'custom-editable.svg');
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},svgPath);
    await page.getByRole('button',{name:'导出',exact:true}).click();await choose('导出格式','editable');await choose('素材尺寸','128');
    await page.getByRole('button',{name:'下载素材',exact:true}).click();
    await expect.poll(async()=>{try{return(await fs.readFile(svgPath,'utf8')).includes('data-object-id');}catch{return false;}}).toBe(true);
    const svg=await fs.readFile(svgPath,'utf8');if(svg.includes('<image')||!svg.includes('<path'))throw new Error('Custom SVG was flattened');
    const pngPath=path.join(output,'custom.png');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},pngPath);
    await choose('导出格式','png');await page.getByRole('button',{name:'下载素材',exact:true}).click();
    await expect.poll(async()=>{try{return(await fs.stat(pngPath)).size;}catch{return 0;}}).toBeGreaterThan(30);
    const png=await fs.readFile(pngPath);if(png.readUInt32BE(16)!==128||png.readUInt32BE(20)!==128)throw new Error('Wrong PNG dimensions');
    await page.getByRole('button',{name:'关闭导出'}).click();
    const projectPath=path.join(output,'custom.material.json');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},projectPath);
    await page.getByRole('button',{name:'项目菜单'}).click();await page.getByRole('button',{name:'保存项目',exact:true}).click();
    await expect.poll(async()=>{try{return JSON.parse(await fs.readFile(projectPath,'utf8')).sources.length;}catch{return 0;}}).toBe(1);
    await page.getByRole('button',{name:'项目菜单'}).click();await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByLabel('打开项目文件').setInputFiles(projectPath);
    await expect(page.getByRole('heading',{name:'desktop-leaf',exact:true})).toBeVisible();
    await page.screenshot({path:path.join(output,'workbench.png')});if(errors.length)throw new Error(errors.join('\n'));
    const version=await app.evaluate(({app})=>app.getVersion());
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({version,platform:process.platform,arch:process.arch,passed:true,checks:['packaged startup','file URL worker preview','custom SVG upload','editable SVG native IPC save','PNG native IPC save','project save and reopen']},null,2));
    console.log(`Desktop smoke passed: ${version} ${process.platform} ${process.arch}`);
  }finally{if(app)await app.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:500});}
})().catch(error=>{console.error(error);process.exitCode=1;});
