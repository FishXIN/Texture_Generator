# 架构与目录约定

本文对应 0.3.0。默认入口为黑白纹理素材工作台；既有图形 / 动态入口为 `?studio=pattern`。两种项目模型独立，原有底图阵列保留在图形工作台内。

## 模块职责

| 目录 | 职责 | 主要入口 |
| --- | --- | --- |
| `electron/` | 窗口、预加载桥接、系统保存 | `main.ts`、`preload.ts` |
| `src/app/` | 入口路由、旧工作台组装与全局样式 | `App.tsx`、`PatternStudio.tsx`、`styles.css` |
| `features/material/` | 周期黑白场、梯度、可选法线、Worker、导入、真 8/16 位 PNG 与二维界面 | `engine.ts`、`model.ts`、`worker.ts`、`png.ts`、`MaterialStudio.tsx` |
| `features/project/` | 可序列化作品、历史、参数预设、图层、素材列表、参数界面 | `model.ts`、`store.ts`、`io.ts`、`Library.tsx`、`Inspector.tsx` |
| `features/assets/svg.ts` | SVG 清理、源文件保留、样式内联、ID 隔离、改色与解码缓存 | `sanitizeSvg`、`assetSvg`、`assetImage` |
| `features/texture/engine/` | 确定性图形、周期避让、蒙版采样、运动与渲染 | `scene.ts`、`render.ts`、`rng.ts` |
| `features/texture/components/` | 编辑画布与原有底图阵列界面 | `StudioCanvas.tsx`、`LegacyEditor.tsx` |
| `features/export/` | 导出区域、检查、PNG/JPEG、三种 SVG、逐帧 ZIP | `studioExport.ts`、`studioSvg.ts`、`zip.ts` |
| `shared/` | 公共 UI、旧版工具与桌面类型 | `ui/StudioFields.tsx`、`types/` |
| `tests/` | 真实 Chromium 中的引擎性质、独立文件验证与 UI 验收 | `material.spec.ts`、`studio.spec.ts` |

同一功能的界面、类型和状态放在一起，不创建规划功能的空目录。跨模块使用 `@/`，模块内优先使用相对路径。

## 黑白纹理数据流

```mermaid
flowchart LR
  Parameters[预设 / 图层 / 种子] --> Project[MaterialProject]
  Import[本地灰度源 / SVG 清理] --> Project
  Project --> History[保存 / 撤销 / 恢复]
  Project --> Worker[Worker 周期灰度与解析梯度]
  Worker --> Preview[二维纹理 / 透明 / 平铺检查]
  Worker --> PNG[灰度或黑色 Alpha PNG]
  Worker --> Normal[可选 RGB 法线 PNG]
  PNG --> ZIP[配套 ZIP 与 manifest]
  Normal --> ZIP
```

项目使用 `kind: surface-material` 与 `.material.json`，保存最多 20 步历史。8 个图层、4 个源；逐项验证类型、范围、唯一 ID 和引用。解码源最长边上限 1024 px，保留原始嵌入数据。SVG 在实际解码前重新清理；禁止远程位图 URL。

引擎按归一化 UV 采样。整数周期 value noise、quintic 插值、周期 feature points、整数方向波向量和周期 domain warp 保持四边连续。所有图层运算也变换解析梯度，因此法线对应最终灰度。预览和不同导出尺寸在同一 UV 得到相同值。

预览与正式导出使用独立 Worker；更新参数或取消终止对应 Worker，返回的旧任务不会覆盖新图。Worker 内完成 PNG 编码和 ZIP 打包。灰度 PNG 为 type 0；透明黑色为 type 4，gray=0、alpha=1−height；法线 type 2。16 位从浮点场大端写入，zlib 与 CRC32 遵循 PNG 格式，不经过 Canvas 降至 8 位。

法线默认关闭。OpenGL / DirectX 仅绿色通道相反，强度不改变灰度。二维 Canvas 是 8 位预览；棋盘格等背景只由 CSS 提供。没有 WebGL 或 Three.js 依赖。细节和文件边界见 [material-studio.md](material-studio.md)。

## 图形与动态作品数据流

```mermaid
flowchart LR
  Import[SVG 本地导入] --> Clean[清理与兼容说明]
  Clean --> Project[Project JSON]
  Parameters[参数 / 图层 / 手工摆放] --> Project
  Project --> History[撤销重做 / 项目保存]
  Project --> Scene[buildScene 确定性静态场景]
  Scene --> Time[atTime 周期运动]
  Time --> Canvas[Canvas 编辑预览 / PNG / JPEG]
  Time --> SVG[SVG 图形结构]
  Time --> ZIP[透明 PNG 序列 ZIP]
```

`Project` 保存画布、独立背景、图层、导入素材原文、手工对象、随机种子、运动和导出配置。DOM、图片解码缓存与预览状态不写入项目文件。重新打开时验证结构、范围与引用，并重新清理素材，不能直接信任文件中的 `pure` 或已清理 SVG 字段。

Zustand store 保存最多 40 步历史。连续参数输入在短时间内按分组合并；新作品与预设切换也可以撤销。浏览器恢复副本为尽力保存，空间不足时提示下载项目文件。

## 场景与运动约定

- 分布、尺寸、角度和颜色使用独立的 `mulberry32` 种子。自动图形与手工对象分别存储，随机操作只改变未锁定种子。
- 图形数量、尺寸与画布都有限制。自定义 SVG 以最长边匹配颗粒尺寸，防止长宽比造成意外巨幅图形。
- 间距使用网格桶与周期距离，按最大尺寸保守避让；尝试上限会使实际数量低于目标。网格 / 错位布局中的不合格单元不进行额外补点。
- 蒙版先以 256 × 256 Alpha 采样选择生成位置，渲染时再按蒙版轮廓裁切。细于采样网格的轮廓可能影响生成密度。
- `atTime` 只根据静态对象与时间计算运动，周期为 `[0, duration)`。平铺漂移按整数个单元运动，其余模式使用周期三角函数；锁定运动的手工对象保持原位。
- `copies` 派生区域内的周期副本；副本不增加逻辑对象数量。画布拖动修改原始对象，边缘副本随之同步。
- 整面 PNG 与无缝 SVG 按完整区域直接绘制，不先缩放已栅格化的单元再拼接，避免分数倍率带来的中间接缝。

## 渲染与导出

Canvas 和 SVG 共用场景、运动、图形路径与周期副本计算。预览分辨率最多 4 MP，不改变逻辑场景；导出按所选尺寸绘制。自定义 SVG 在位图出口中按需要解码到最高 4096 px 的最长边，纯 SVG 出口保留矢量。

图层先独立绘制，再应用蒙版、透明度和混合。背景层与预览衬底独立；导出是否带背景由导出面板决定。JPEG 总会绘制画布背景颜色。

SVG 用 DOMParser 清理后序列化，内部 ID 与引用按实例隔离。简单 CSS 规则按优先级、声明顺序与 `!important` 内联；复杂选择器、字体、滤镜与位图有明确说明。改色保留渐变引用和透明度。优化模式通过 `defs/use` 复用图形；纯矢量和优化模式均拒绝含位图、字体或滤镜的已用素材。

PNG 序列采样首帧到循环结束前一帧，不重复结束帧。时长乘帧率必须为整数；ZIP 采用 store 模式与 CRC32，包含 PNG 和 `manifest.json`。取消信号在每帧、编码前后与打包前检查；不会更换格式或修改当前分布。

桌面保存通过明确的 IPC 参数传输文件内容，浏览器使用 Blob 下载。序列暂在内存累积，超过 256 MB 会停止并提示调整；云端渲染不在本版范围内。

## 旧版阵列

`LegacyEditor` 沿用原 `assets/store.ts`、`texture/store.ts`、`generateLayout`、`renderScene` 与旧导出模块。旧 SVG 出口也进行清理与实例 ID 隔离；发现安全或效果兼容问题时，提示到工作台检查并使用相应出口。底图和位图素材的使用规则保持独立；新工作台的项目保存和循环序列不自动适用于该入口。

连续黑白纹理使用独立材质引擎。后续路径排列与透明视频应分别扩展对应引擎和出口，不能绕过作品模型或静默降级。验收范围见 [development.md](development.md)。
