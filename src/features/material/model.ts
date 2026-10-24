import { algorithms } from './algorithms';
import type { Algorithm, Point } from './algorithms';
import { additionalPresets } from './presets';

export const particleShapes = {
  circle:'圆点', ellipse:'椭圆', blob:'有机斑点', square:'方块', polygon:'多边形', line:'短线',
  star:'星形', ring:'空心圆环', debris:'碎屑', splatter:'飞溅', leaf:'叶片', flower:'花朵', symbol:'符号', custom:'导入 SVG',
} as const;
export const distributions = {
  random:'随机', grid:'网格', stagger:'错位', cluster:'聚集', spaced:'最小间距', blue:'蓝噪均匀',
  gradient:'渐变', radial:'放射', path:'沿路径', mirror:'镜像', kaleidoscope:'万花筒', manual:'手工编排',
} as const;
export const motions = {
  none:'静止', drift:'整体漂移', wander:'随机游动', flow:'旋度流场', wave:'波浪', vortex:'涡旋',
  turbulence:'湍流', breathe:'呼吸', flicker:'闪烁', grow:'生长消散', morph:'形状变形',
  parallax:'分层视差', refresh:'雪花刷新', evolve:'循环演化',
} as const;
export type Motion = keyof typeof motions;
export type ParticleShape = keyof typeof particleShapes;
export type Distribution = keyof typeof distributions;
export type ManualObject = {
  id:string; x:number; y:number; size:number; angle:number; aspect:number; gray:number; opacity:number;
  shape:ParticleShape; sourceId:string; flipX:boolean; flipY:boolean; locked:boolean; motionLocked:boolean;
  outlineSeed?:number;
};
const extendedGenerators = {
  particles:'图形颗粒', algorithm:'基础噪声', film:'胶片颗粒', dust:'胶片灰尘', scratches:'曲线划痕',
  oldphoto:'老照片', copier:'复印墨粉', pulp:'纸浆团块', stains:'纸面污点',
  smoke:'卷曲烟气', turbulence:'湍流云纹', wood:'年轮木纹', terrain:'地形起伏', water:'叠加水波', flame:'火焰轮廓',
  spray:'喷漆', airbrush:'喷枪柔雾', bleed:'墨水渗化', drybrush:'干刷', pencil:'铅笔',
  charcoal:'炭笔', chalk:'粉笔', crayon:'蜡笔', screen:'丝网漏印', stamp:'印章斑驳', wear:'油墨磨损',
  sand:'沙粒', plaster:'石膏', stucco:'灰泥抹痕', rust:'锈蚀', frosted:'磨砂', brushed:'拉丝',
  peeling:'漆面剥落', snow:'黑白雪花', pixel:'像素颗粒', blocks:'像素块', scan:'扫描线',
  bands:'条带', glitch:'故障碎片', compression:'压缩失真风格', signal:'信号干扰',
  halftoneSquare:'方形网点', halftoneEllipse:'椭圆网点', halftoneLine:'线状半调',
  ditherRandom:'随机抖动', ditherOrdered:'有序抖动',
} as const;
export const generators = {
  noise: '多尺度噪声', ridged: '岩石脊线', cells: '细胞表面', cracks: '裂纹',
  fibers: '方向纤维', woven: '编织', waves: '波纹', spots: '随机斑点', image: '导入灰度',
  paper: '纸浆纤维', creases: '纸张褶皱', marble: '大理石脉络', halftone: '半调网点',
  hatch: '交叉排线', interference: '波谱干涉', contours: '等高线',
  glow: '柔光光斑', bokeh: '散焦光斑', ...extendedGenerators,
} as const;
export type Generator = keyof typeof generators;
export const presetGroups = {
  all:'全部', grain:'基础颗粒', fragments:'点与碎片', film:'胶片', paper:'纸张', nature:'自然连续',
  paint:'绘画印刷', surface:'材质表面', digital:'数字故障', graphic:'网点 / 波谱', pattern:'图形', light:'柔光',
} as const;
export type PresetGroup = Exclude<keyof typeof presetGroups, 'all'>;
export const generatorControls: Record<Generator, { scale: string; detail?: string; coverage?: string; softness?: string; direction?: boolean; octaves?: boolean }> = {
  ...Object.fromEntries(Object.keys(extendedGenerators).map(k=>[k,{scale:'纹理尺度',detail:'细节量',coverage:'覆盖范围',softness:'边缘柔和',direction:true}])) as Record<keyof typeof extendedGenerators,{scale:string;detail:string;coverage:string;softness:string;direction:boolean}>,
  noise: { scale:'纹理尺度', detail:'细节量', octaves:true },
  ridged: { scale:'纹理尺度', detail:'细节量', octaves:true },
  cells: { scale:'细胞数量' }, cracks: { scale:'裂块数量', detail:'裂缝宽度' },
  fibers: { scale:'纤维密度', detail:'细纤维量', direction:true },
  woven: { scale:'经纬密度' }, waves: { scale:'波纹密度', direction:true },
  spots: { scale:'颗粒分布', detail:'颗粒尺寸', coverage:'颗粒密度', softness:'边缘柔和' },
  image: { scale:'纹理尺度' },
  paper: { scale:'纸浆尺度', detail:'微粒质感', coverage:'纤维密度', softness:'纤维柔和' },
  creases: { scale:'褶皱密度', detail:'褶皱细节', softness:'褶皱柔和', octaves:true },
  marble: { scale:'脉络密度', detail:'分支扰动', softness:'脉络宽度', direction:true, octaves:true },
  halftone: { scale:'网点密度', detail:'疏密变化', coverage:'网点覆盖', softness:'网点柔和' },
  hatch: { scale:'排线密度', detail:'交叉排线', coverage:'排线宽度', softness:'排线柔和', direction:true },
  interference: { scale:'波谱频率', detail:'干涉幅度', direction:true },
  contours: { scale:'等高线密度', detail:'轮廓细节', coverage:'线条宽度', softness:'线条柔和', octaves:true },
  glow: { scale:'光斑数量', detail:'光晕层次', coverage:'光斑范围', softness:'光晕柔和' },
  bokeh: { scale:'散焦数量', detail:'光环强度', coverage:'光斑大小', softness:'散焦柔和' },
  algorithm:{scale:'采样密度',detail:'分布参数'},
  film:{scale:'胶片粒径',coverage:'颗粒强度'},oldphoto:{scale:'胶片粒径',coverage:'老化强度'},
  scratches:{scale:'划痕数量',coverage:'划痕宽度',direction:true},
  copier:{scale:'墨粉细度',detail:'着墨阈值'},
  pulp:{scale:'纸浆尺度'},stains:{scale:'污点尺度',coverage:'污点强度'},
  smoke:{scale:'烟带密度',detail:'卷曲幅度',coverage:'烟气强度',softness:'烟带柔和',direction:true},
  turbulence:{scale:'扰动尺度',detail:'卷曲幅度',softness:'细带柔和',direction:true},
  wood:{scale:'年轮密度',detail:'年轮扰动',softness:'纹路宽度'},
  terrain:{scale:'地形尺度',detail:'地形分层',coverage:'分层数量'},
  water:{scale:'叠波密度',detail:'波形扰动'},
  flame:{scale:'火焰密度',detail:'卷曲幅度',coverage:'火焰强度',softness:'火焰柔和',direction:true},
  airbrush:{scale:'喷雾微粒',coverage:'喷雾强度',softness:'喷雾范围'},
  bleed:{scale:'渗边尺度',coverage:'扩散范围'},
  drybrush:{scale:'笔触密度',detail:'笔触弯曲',coverage:'着墨覆盖',direction:true},
  pencil:{scale:'笔触密度',detail:'笔触弯曲',coverage:'着墨覆盖',direction:true},
  charcoal:{scale:'笔触密度',detail:'笔触弯曲',coverage:'着墨覆盖',direction:true},
  chalk:{scale:'笔触密度',detail:'笔触弯曲',coverage:'着墨覆盖',direction:true},
  crayon:{scale:'笔触密度',detail:'笔触弯曲',coverage:'着墨覆盖',direction:true},
  screen:{scale:'网印密度',detail:'缺损细节',coverage:'漏印强度'},
  stamp:{scale:'缺损密度',detail:'缺损边界',coverage:'磨损强度'},
  wear:{scale:'缺损密度',detail:'缺损边界',coverage:'磨损强度'},
  plaster:{scale:'细孔尺度'},stucco:{scale:'抹痕密度',detail:'抹痕起伏',direction:true},
  rust:{scale:'锈斑密度',coverage:'锈蚀覆盖'},
  frosted:{scale:'微粒密度'},brushed:{scale:'拉丝密度',coverage:'拉丝宽度',direction:true},
  peeling:{scale:'剥落尺度',coverage:'剥落覆盖',softness:'剥落边缘'},
  snow:{scale:'雪花密度'},pixel:{scale:'像素密度',coverage:'像素覆盖'},
  blocks:{scale:'块面密度',coverage:'细块比例'},
  scan:{scale:'扫描密度',coverage:'干扰强度'},
  bands:{scale:'条带密度',coverage:'条带强度',direction:true},
  glitch:{scale:'切片密度',detail:'错位幅度',coverage:'错位覆盖'},
  compression:{scale:'压缩块密度',detail:'量化等级',coverage:'失真强度'},
  signal:{scale:'干扰密度',detail:'错位幅度',coverage:'干扰强度'},
  halftoneSquare:{scale:'网点密度',coverage:'网点覆盖',softness:'网点柔和'},
  halftoneEllipse:{scale:'网点密度',coverage:'网点覆盖',softness:'网点柔和'},
  halftoneLine:{scale:'线网密度',coverage:'线网覆盖',softness:'线网柔和'},
  ditherRandom:{scale:'抖动密度'},ditherOrdered:{scale:'抖动密度'},
};
export type HeightLayer = {
  id: string; name: string; visible: boolean; locked: boolean; kind: Generator;
  seed: number; scale: number; octaves: number; detail: number; warp: number;
  direction: 'horizontal' | 'vertical' | 'diagonal';
  contrast: number; bias: number; invert: boolean; opacity: number;
  coverage: number; softness: number;
  blend: 'replace' | 'add' | 'multiply' | 'max'; sourceId: string; tileSource: boolean;
  algorithm:Algorithm; transform:'fbm'|'turbulence'|'ridged'; response:'all'|'dark'|'edge'|'alpha';
  shape:ParticleShape; distribution:Distribution; count:number; sizeMin:number; sizeMax:number;
  aspect:number; angleMin:number; angleMax:number; grayMin:number; grayMax:number; baseGray:number;
  alphaMin:number; alphaMax:number; spacing:number; centerX:number; centerY:number; sectors:number;
  path:Point[]; objects:ManualObject[]; sourceMix:{id:string;weight:number}[];
  motion:Motion; amplitude:number; cycles:number; motionDirection:number; motionLocked:boolean;
};
export type HeightSource = { id: string; name: string; original: string; mime: string; width: number; height: number };
export type MaterialProject = {
  kind: 'surface-material'; version: 1; name: string; layers: HeightLayer[]; sources: HeightSource[];
  normal: { strength: number; convention: 'opengl' | 'directx' };
  export: { size: number; depth: 8 | 16; maps: 'both' | 'height' | 'normal'; background: 'white' | 'transparent'; pigment: 'black' | 'white' };
  timeline:{duration:number;fps:number;phase:number};
};
export const materialId = () => crypto.randomUUID();
export const copyMaterial = (p: MaterialProject) => structuredClone(p);
export const heightLayer = (kind: Generator = 'noise', patch: Partial<HeightLayer> = {}): HeightLayer => ({
  id: materialId(), name: generators[kind], visible: true, locked: false, kind,
  seed: 74291, scale: 6, octaves: 4, detail: 0.52, warp: 0.25,
  direction: 'horizontal', contrast: 1.35, bias: 0, invert: false, opacity: 1,
  coverage: 0.55, softness: 0.35,
  blend: 'replace', sourceId: '', tileSource: true,
  algorithm:'value',transform:'fbm',response:'all',shape:'circle',distribution:'random',
  count:400,sizeMin:.004,sizeMax:.012,aspect:1,angleMin:0,angleMax:360,grayMin:0,grayMax:0,
  alphaMin:1,alphaMax:1,baseGray:1,spacing:.015,centerX:.5,centerY:.5,sectors:6,
  path:[{x:.1,y:.5},{x:.3,y:.2},{x:.6,y:.8},{x:.9,y:.5}],objects:[],sourceMix:[],
  motion:'none',amplitude:.12,cycles:1,motionDirection:0,motionLocked:false,...patch,
});
export const materialPresets = [
  { id: 'paper', group:'paper', name: '01 纸张颗粒', subtitle: '浅色底 · 柔和纸感', layers: () => [
    heightLayer('noise', { name: '纸面起伏', scale: 32, octaves: 5, detail: 0.72, contrast: 0.35, bias: 0.35, warp: 0.1 }),
  ] },
  { id: 'grain', group:'graphic', name: '02 颗粒斑点', subtitle: '黑色微粒 · 随机散布', layers: () => [
    heightLayer('spots', { name: '随机颗粒', scale: 55, detail: 0.4, contrast: 1, warp: 0.2 }),
  ] },
  { id: 'grunge', group:'surface', name: '03 斑驳', subtitle: '粗糙块面 · 明暗层次', layers: () => [
    heightLayer('noise', { name: '斑驳分布', scale: 8, octaves: 5, contrast: 2.6, bias: 0.1, warp: 0.75 }),
  ] },
  { id: 'stone', group:'surface', name: '04 岩石', subtitle: '粗糙脊线 · 细颗粒', layers: () => [
    heightLayer('ridged', { name: '岩石起伏', scale: 5, warp: 0.55, contrast: 1.4 }),
    heightLayer('noise', { name: '表面微粒', scale: 36, octaves: 3, opacity: 0.16, blend: 'add', warp: 0.1, seed: 991 }),
  ] },
  { id: 'concrete', group:'surface', name: '05 混凝土', subtitle: '柔和起伏 · 致密细节', layers: () => [
    heightLayer('noise', { scale: 9, octaves: 5, detail: 0.65, contrast: 1.8, warp: 0.15 }),
    heightLayer('cells', { name: '细小凹坑', scale: 35, opacity: 0.22, blend: 'add', invert: true, seed: 310 }),
  ] },
  { id: 'cracks', group:'surface', name: '06 干裂表面', subtitle: '细胞裂缝 · 表面噪声', layers: () => [
    heightLayer('cracks', { scale: 9, detail: 0.45, warp: 0.25, contrast: 1 }),
    heightLayer('noise', { name: '细节起伏', scale: 30, opacity: 0.12, blend: 'add', seed: 928 }),
  ] },
  { id: 'cells', group:'surface', name: '07 细胞', subtitle: '圆润凸起 · 周期分布', layers: () => [heightLayer('cells', { scale: 9, warp: 0.15, contrast: 1.2 })] },
  { id: 'fibers', group:'paper', name: '08 纤维', subtitle: '方向纹路 · 轻微扰动', layers: () => [heightLayer('fibers', { scale: 24, warp: 0.45, contrast: 1.2 })] },
  { id: 'woven', group:'surface', name: '09 编织', subtitle: '经纬交错 · 细密织物', layers: () => [heightLayer('woven', { scale: 14, warp: 0.04, contrast: 1.1 })] },
  { id: 'waves', group:'graphic', name: '10 波纹', subtitle: '连续波峰 · 柔和流线', layers: () => [heightLayer('waves', { scale: 7, warp: 0.4, contrast: 1.2 })] },
  { id:'xuan', group:'paper', name:'11 宣纸', subtitle:'细纸浆 · 柔和长纤维', layers:()=>[
    heightLayer('paper',{name:'宣纸纤维',scale:22,coverage:.62,softness:.64,detail:.4,contrast:.7,warp:.18}),
    heightLayer('noise',{name:'纸面微起伏',scale:48,octaves:3,contrast:.2,opacity:.16,blend:'add',seed:318}),
  ] },
  { id:'mulberry', group:'paper', name:'12 桑皮纸', subtitle:'长纤维 · 手工纸感', layers:()=>[
    heightLayer('paper',{name:'桑皮长纤维',scale:12,coverage:.85,softness:.22,detail:.28,contrast:1.15,warp:.3}),
  ] },
  { id:'cotton', group:'paper', name:'13 棉纸', subtitle:'细软纤维 · 均匀纸面', layers:()=>[
    heightLayer('paper',{name:'棉纸纤维',scale:36,coverage:.75,softness:.8,detail:.6,contrast:.45,bias:.23,warp:.1}),
  ] },
  { id:'watercolor', group:'paper', name:'14 水彩纸', subtitle:'粗压纹 · 细密凹凸', layers:()=>[
    heightLayer('noise',{name:'压纹颗粒',scale:32,octaves:3,contrast:.4,bias:.36,detail:.65,warp:.15}),
    heightLayer('cells',{name:'纸面凹坑',scale:44,contrast:.6,invert:true,opacity:.18,blend:'add',seed:842}),
  ] },
  { id:'laid', group:'paper', name:'15 帘纹纸', subtitle:'横向帘纹 · 纸浆纤维', layers:()=>[
    heightLayer('paper',{name:'纸浆底纹',scale:28,coverage:.4,contrast:.6,softness:.75}),
    heightLayer('waves',{name:'横向帘纹',scale:46,warp:0,contrast:.3,opacity:.2,blend:'multiply',seed:808}),
  ] },
  { id:'recycled', group:'paper', name:'16 再生纸', subtitle:'纸浆颗粒 · 杂点纤维', layers:()=>[
    heightLayer('paper',{name:'再生纸浆',scale:18,coverage:.75,softness:.35,detail:.8,contrast:1}),
    heightLayer('spots',{name:'杂点',scale:40,detail:.6,coverage:.5,softness:.6,opacity:.25,blend:'multiply',seed:809}),
  ] },
  { id:'kraft', group:'paper', name:'17 牛皮纸', subtitle:'粗短纤维 · 黑白纸感', layers:()=>[
    heightLayer('paper',{name:'粗纸纤维',scale:24,coverage:.75,detail:.65,softness:.3,contrast:1.2,bias:-.25}),
    heightLayer('noise',{name:'细纹起伏',scale:50,octaves:3,contrast:.5,opacity:.15,blend:'add',seed:19}),
  ] },
  { id:'parchment', group:'paper', name:'18 旧纸', subtitle:'明暗斑痕 · 纸面细节', layers:()=>[
    heightLayer('noise',{name:'旧纸斑痕',scale:4,octaves:4,contrast:.75,bias:.22,warp:.6}),
    heightLayer('paper',{name:'纸面纤维',scale:28,detail:.6,coverage:.5,opacity:.28,blend:'multiply',seed:472}),
  ] },
  { id:'crumpled', group:'paper', name:'19 褶皱纸', subtitle:'折痕起伏 · 细纸纹', layers:()=>[
    heightLayer('creases',{name:'纸张折痕',scale:5,octaves:3,detail:.35,softness:.4,contrast:1.1,warp:.75}),
    heightLayer('paper',{name:'纸面质感',scale:34,opacity:.15,blend:'multiply',seed:438}),
  ] },
  { id:'white-marble', group:'surface', name:'20 白大理石', subtitle:'浅色石底 · 深色脉络', layers:()=>[
    heightLayer('marble',{name:'大理石脉络',scale:3,octaves:4,detail:.68,softness:.22,contrast:1,direction:'diagonal',warp:.35}),
    heightLayer('noise',{name:'石底云纹',scale:6,octaves:4,contrast:.45,bias:.25,opacity:.15,blend:'multiply',seed:729}),
  ] },
  { id:'black-marble', group:'surface', name:'21 黑大理石', subtitle:'深色石底 · 白色纹路', layers:()=>[
    heightLayer('marble',{name:'白色石脉',scale:4,octaves:4,detail:.72,softness:.15,contrast:1,invert:true,direction:'diagonal',warp:.4}),
  ] },
  { id:'ink-marble', group:'surface', name:'22 水墨流纹', subtitle:'细密流线 · 大理石墨纹', layers:()=>[
    heightLayer('marble',{name:'水墨流动',scale:9,octaves:5,detail:.85,softness:.65,contrast:1.3,warp:.65}),
  ] },
  { id:'halftone', group:'graphic', name:'23 波普网点', subtitle:'整齐网点 · 黑白印刷', layers:()=>[
    heightLayer('halftone',{name:'印刷网点',scale:18,coverage:.6,detail:0,softness:.08,contrast:1,warp:0}),
  ] },
  { id:'dot-gradient', group:'graphic', name:'24 渐变网点', subtitle:'网点疏密 · 周期渐变', layers:()=>[
    heightLayer('halftone',{name:'渐变网点',scale:32,coverage:.62,detail:.9,softness:.1,contrast:1,warp:0}),
  ] },
  { id:'comic', group:'graphic', name:'25 漫画排线', subtitle:'交叉线条 · 手绘阴影', layers:()=>[
    heightLayer('hatch',{name:'漫画交叉线',scale:25,coverage:.32,detail:.7,softness:.12,contrast:1,warp:.1,direction:'diagonal'}),
  ] },
  { id:'moire', group:'graphic', name:'26 波谱干涉', subtitle:'摩尔波纹 · 视觉节奏', layers:()=>[
    heightLayer('interference',{name:'干涉波谱',scale:24,detail:.55,contrast:1.5,warp:.12,direction:'diagonal'}),
  ] },
  { id:'contours', group:'graphic', name:'27 等高线', subtitle:'流动轮廓 · 地形线条', layers:()=>[
    heightLayer('contours',{name:'地形等高线',scale:18,octaves:4,detail:.65,coverage:.22,softness:.2,contrast:1,warp:.25}),
  ] },
  { id:'soft-glow', group:'light', name:'28 柔光', subtitle:'柔和光晕 · 渐变过渡', layers:()=>[
    heightLayer('glow',{name:'柔光光晕',scale:2,coverage:.7,softness:.85,detail:.5,contrast:1.25,warp:0}),
  ] },
  { id:'bokeh', group:'light', name:'29 散焦光斑', subtitle:'圆形光斑 · 模糊光环', layers:()=>[
    heightLayer('bokeh',{name:'散焦光环',scale:6,coverage:.62,softness:.28,detail:.5,contrast:1.1,warp:0}),
  ] },
  { id:'mist', group:'light', name:'30 雾面柔纹', subtitle:'低频云雾 · 柔和明暗', layers:()=>[
    heightLayer('noise',{name:'柔雾明暗',scale:3,octaves:3,detail:.25,contrast:1.25,warp:.4}),
  ] },
  { id:'satin', group:'light', name:'31 丝绸柔纹', subtitle:'细密方向纹 · 柔和起伏', layers:()=>[
    heightLayer('fibers',{name:'丝绸细纹',scale:28,detail:.6,contrast:.55,warp:.2,direction:'diagonal'}),
    heightLayer('noise',{name:'柔和起伏',scale:3,octaves:3,contrast:.6,opacity:.45,blend:'add',seed:688}),
  ] },
  ...additionalPresets(),
] as const;
export function newMaterial(preset: string = 'paper'): MaterialProject {
  const entry = materialPresets.find(p => p.id === preset) ?? materialPresets[0];
  return {
    kind: 'surface-material', version: 1, name: `${entry.name.replace(/^\d+\s*/,'')}纹理`,
    layers: entry.layers(), sources: [], normal: { strength: 0.65, convention: 'opengl' },timeline:{duration:3,fps:24,phase:0},
    export: { size: 2048, depth: 8, maps: 'height', background: 'white', pigment:entry.group === 'light' ? 'white' : 'black' },
  };
}
export const isSeamless = (p: MaterialProject) => p.layers.filter(l => l.visible && l.opacity > 0).every(l => !l.sourceId || l.kind==='particles' || l.tileSource);
export function parseMaterial(text: string): MaterialProject {
  if (text.length > 25_000_000) throw new Error('项目超过 25 MB。');
  const p = JSON.parse(text) as MaterialProject;
  const object = (v: unknown) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('项目结构无效'); };
  const num = (v: number, min: number, max: number, integer = false) => {
    if (!Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) throw new Error('项目参数超出范围');
  };
  const choice = (v: string, options: readonly string[]) => { if (!options.includes(v)) throw new Error('项目参数类型不支持'); };
  const str = (v: string, max = 200) => { if (typeof v !== 'string' || v.length > max) throw new Error('项目文本无效'); };
  const bool = (v: boolean) => { if (typeof v !== 'boolean') throw new Error('项目开关无效'); };
  object(p);
  if (p.kind !== 'surface-material' || p.version !== 1) throw new Error('不是受支持的材质项目');
  str(p.name, 80);
  if (!Array.isArray(p.layers) || p.layers.length > 8 || !Array.isArray(p.sources) || p.sources.length > 4) throw new Error('最多 8 个高度层、4 个导入源');
  const ids = new Set<string>();
  const id = (v: string) => { if (typeof v !== 'string' || !/^[\w-]{1,100}$/.test(v) || ids.has(v)) throw new Error('项目 ID 无效或重复'); ids.add(v); };
  for (const s of p.sources) {
    object(s); id(s.id); str(s.name); num(s.width, 1, 8192, true); num(s.height, 1, 8192, true);
    choice(s.mime, ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']); str(s.original, 8_000_000);
    if (s.mime === 'image/svg+xml') {
      if (!s.original.trim().startsWith('<')) throw new Error('SVG 源无效');
    } else if (!new RegExp(`^data:${s.mime};base64,[A-Za-z0-9+/=]+$`).test(s.original)) throw new Error('仅支持内嵌的本地图像');
  }
  for (const l of p.layers) {
    object(l); id(l.id); str(l.name); choice(l.kind, Object.keys(generators));
    bool(l.visible); bool(l.locked); bool(l.invert); bool(l.tileSource);
    if (l.coverage === undefined) l.coverage = l.kind === 'spots' ? .25 + l.detail * .75 : 0.55;
    if (l.softness === undefined) l.softness = 0.35;
    num(l.coverage, 0, 1); num(l.softness, 0, 1);
    num(l.seed, 0, 2 ** 32 - 1, true); num(l.scale, 1, 64, true); num(l.octaves, 1, 6, true);
    num(l.detail, 0, 1); num(l.warp, 0, 1); num(l.contrast, 0, 4); num(l.bias, -1, 1); num(l.opacity, 0, 1);
    choice(l.direction, ['horizontal', 'vertical', 'diagonal']); choice(l.blend, ['replace', 'add', 'multiply', 'max']);
    str(l.sourceId, 100);
    if (l.sourceId && !p.sources.some(s => s.id === l.sourceId)) throw new Error('图层引用的灰度源不存在');
    if (l.kind === 'image' && !l.sourceId) throw new Error('图层引用的灰度源不存在');
    const defaults=heightLayer(l.kind);
    for(const key of ['algorithm','transform','response','shape','distribution','count','sizeMin','sizeMax','aspect','angleMin','angleMax','grayMin','grayMax','baseGray','alphaMin','alphaMax','spacing','centerX','centerY','sectors','path','objects','sourceMix','motion','amplitude','cycles','motionDirection','motionLocked'] as const)
      if(l[key]===undefined) Object.assign(l,{[key]:defaults[key]});
    choice(l.algorithm,Object.keys(algorithms));choice(l.transform,['fbm','turbulence','ridged']);choice(l.response,['all','dark','edge','alpha']);
    choice(l.shape,Object.keys(particleShapes));choice(l.distribution,Object.keys(distributions));choice(l.motion,Object.keys(motions));
    num(l.count,0,2000,true);num(l.sizeMin,.0001,.4);num(l.sizeMax,l.sizeMin,.4);num(l.aspect,.1,10);
    num(l.angleMin,-720,720);num(l.angleMax,l.angleMin,720);num(l.grayMin,0,1);num(l.grayMax,l.grayMin,1);
    num(l.baseGray,0,1);num(l.alphaMin,0,1);num(l.alphaMax,l.alphaMin,1);num(l.spacing,0,.5);num(l.centerX,0,1);num(l.centerY,0,1);num(l.sectors,2,16,true);
    num(l.amplitude,0,.5);num(l.cycles,1,8,true);num(l.motionDirection,-360,360);bool(l.motionLocked);
    if(!Array.isArray(l.path)||l.path.length<2||l.path.length>128)throw new Error('路径需要 2–128 个节点');
    for(const q of l.path){object(q);num(q.x,0,1);num(q.y,0,1);}
    if(!Array.isArray(l.objects)||l.objects.length>2000||!Array.isArray(l.sourceMix)||l.sourceMix.length>4)throw new Error('图形数量超出范围');
    for(const q of l.sourceMix){object(q);str(q.id,100);num(q.weight,0,10);if(!p.sources.some(s=>s.id===q.id))throw new Error('混排素材不存在');}
    for(const q of l.objects){
      object(q);id(q.id);num(q.x,0,1);num(q.y,0,1);num(q.size,.0001,.4);num(q.angle,-720,720);num(q.aspect,.1,10);num(q.gray,0,1);num(q.opacity,0,1);
      choice(q.shape,Object.keys(particleShapes));str(q.sourceId,100);bool(q.flipX);bool(q.flipY);bool(q.locked);bool(q.motionLocked);
      if(q.sourceId&&!p.sources.some(s=>s.id===q.sourceId))throw new Error('手工素材不存在');
      if(q.outlineSeed!==undefined)num(q.outlineSeed,0,2**32-1,true);
    }
  }
  if(p.timeline===undefined)p.timeline={duration:3,fps:24,phase:0};
  object(p.timeline);num(p.timeline.duration,.25,30);num(p.timeline.fps,1,60,true);num(p.timeline.phase,0,1);
  object(p.normal); num(p.normal.strength, 0, 2); choice(p.normal.convention, ['opengl', 'directx']);
  object(p.export); num(p.export.size, 128, 4096, true);
  if (![128, 256, 512, 1024, 2048, 4096].includes(p.export.size)) throw new Error('导出尺寸不支持');
  if (![8, 16].includes(p.export.depth)) throw new Error('高度位深不支持');
  choice(p.export.maps, ['both', 'height', 'normal']);
  choice(p.export.background, ['white', 'transparent']);
  if (p.export.pigment === undefined) p.export.pigment = 'black';
  choice(p.export.pigment, ['black', 'white']);
  return p;
}
