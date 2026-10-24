# 纹理/阵列生成器 — 实现计划

> 历史归档：这是项目初始化前的方案，保留用于追溯，不作为当前开发依据。文中 React 19、Tailwind v4、pnpm、防抖和 SVG 位图嵌入等提案与现有实现不同。当前状态见 [README](../../README.md)，架构见 [architecture.md](../architecture.md)，后续产品方向见 [product-plan.md](../product-plan.md)。

## 1. Summary（概述）

构建一款跨平台（macOS / Windows）桌面工具，基于 **Electron + Vite + React 19 + TypeScript + Tailwind CSS + shadcn/ui**，使用 **原生 HTML5 Canvas 2D** 作为渲染引擎。用户上传底图与多个元素图片，通过参数面板（密度、尺寸、旋转，以及其对应的随机度）实时生成随机铺满底图的纹理/阵列图像，并支持导出 PNG / JPEG / SVG。

交付目标：

- 可运行的开发环境（`pnpm dev`）。
- 完整的 electron-builder 打包脚本，可产出 macOS `.dmg` 与 Windows `.exe / .nsis` 安装包。
- 高内聚低耦合的模块划分，所见即所得的交互体验。

---

## 2. Current State Analysis（现状分析）

- `/Users/bytedance/Texture_Generator/` 为空目录，无任何既有代码。
- 无 `package.json`、无 Git 仓库。
- 属于全新项目，无需兼容任何历史实现。

---

## 3. 技术选型（已确认）

| 维度 | 选择 |
|---|---|
| 桌面壳 | Electron（主进程 + 预加载脚本 + 渲染进程） |
| 构建 | Vite（渲染进程）+ electron-vite 或 vite-plugin-electron |
| 前端框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS v4 |
| UI 组件 | shadcn/ui（Slider, Button, Input, Select, Tabs, Toggle, Tooltip, Dialog, DropdownMenu, Card, ScrollArea） |
| 图标 | lucide-react |
| 渲染引擎 | 原生 Canvas 2D API（自研轻量渲染器） |
| SVG 导出 | 手写 `<svg><image href=".." /></svg>` 字符串拼接 |
| 状态管理 | Zustand（轻量，适合参数 + 资产的集中管理） |
| 工具库 | clsx, tailwind-merge（`cn` helper），`use-debounce` 或自写 debounce hook |
| 打包 | electron-builder |

---

## 4. 目录结构（Proposed Layout）

```
Texture_Generator/
├── .trae/documents/texture_generator_plan.md
├── electron/
│   ├── main.ts                 # 主进程：窗口、菜单、原生保存对话框 (dialog.showSaveDialog)
│   ├── preload.ts              # contextBridge 暴露 saveFile / readFileBase64 API
│   └── tsconfig.json
├── src/
│   ├── main.tsx                # React 入口
│   ├── App.tsx                 # 顶层布局（左画布 + 右参数面板）
│   ├── index.css               # Tailwind 入口 + shadcn 主题变量
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 基础组件（slider, button, input, ...）
│   │   ├── layout/
│   │   │   ├── AppShell.tsx    # 两栏主结构 + 主题切换入口
│   │   │   ├── TitleBar.tsx    # 可选：自绘标题栏（macOS traffic light 适配）
│   │   │   └── ThemeToggle.tsx
│   │   ├── canvas/
│   │   │   ├── PreviewCanvas.tsx   # Canvas 容器 + 缩放自适应 + ResizeObserver
│   │   │   └── EmptyState.tsx      # 未上传底图时的引导
│   │   ├── assets/
│   │   │   ├── BaseImageUploader.tsx   # 底图拖拽/点击上传
│   │   │   ├── ElementsUploader.tsx    # 元素批量上传
│   │   │   └── ElementThumbList.tsx    # 缩略图列表 + 删除
│   │   ├── controls/
│   │   │   ├── ControlPanel.tsx        # 参数面板容器（Tabs / 分组）
│   │   │   ├── SliderField.tsx         # 封装：label + slider + 数值输入联动
│   │   │   ├── DensityGroup.tsx
│   │   │   ├── SizeGroup.tsx           # Base Size + Size Randomness
│   │   │   ├── RotationGroup.tsx       # Base Angle + Rotation Randomness
│   │   │   └── SeedControl.tsx         # 随机种子 + 重新生成按钮
│   │   └── export/
│   │       └── ExportBar.tsx           # 格式选择 + 倍数 + 导出按钮
│   │
│   ├── store/
│   │   ├── useAssetsStore.ts   # 底图 + 元素列表（ImageBitmap 缓存）
│   │   ├── useParamsStore.ts   # 所有数值参数（防抖应用到渲染）
│   │   └── useThemeStore.ts    # 明暗主题
│   │
│   ├── renderer/
│   │   ├── types.ts            # PlacedItem、RenderParams 等类型
│   │   ├── layout.ts           # 纯函数：由 (params, seed, elements, baseSize) 生成 PlacedItem[]
│   │   ├── rng.ts              # 可复现随机数（mulberry32）
│   │   ├── canvasRenderer.ts   # 将 PlacedItem[] 绘制到 OffscreenCanvas/Canvas
│   │   └── svgExporter.ts      # 将 PlacedItem[] 序列化为 SVG 字符串
│   │
│   ├── hooks/
│   │   ├── useDebouncedValue.ts
│   │   ├── useImageBitmap.ts       # File -> ImageBitmap
│   │   └── useCanvasFit.ts         # 容器尺寸 -> 缩放比例
│   │
│   ├── lib/
│   │   ├── cn.ts                   # tailwind class merge
│   │   └── file.ts                 # dataURL <-> Blob <-> ArrayBuffer
│   │
│   └── types/
│       └── electron.d.ts           # window.electron API 类型声明
│
├── index.html
├── package.json
├── pnpm-workspace.yaml (可选)
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts                  # 集成 vite-plugin-electron & vite-plugin-electron-renderer
├── tailwind.config.ts
├── postcss.config.js
├── components.json                 # shadcn/ui 配置
├── electron-builder.yml            # 打包配置（mac dmg / win nsis）
├── .gitignore
└── README.md（仅在用户明确要求时再创建）
```

---

## 5. Proposed Changes（详细实现方案）

### 5.1 脚手架与工具链

**文件**：`package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`

- 使用 `vite-plugin-electron` + `vite-plugin-electron-renderer` 一套搭起 Electron + Vite 热重载。
- `package.json` scripts：
  - `dev`：vite 启动主/渲染进程。
  - `build`：`tsc -b && vite build`。
  - `dist`：`pnpm build && electron-builder`（生成 `.dmg` + `.exe`）。
  - `dist:mac` / `dist:win`：单平台。
- Tailwind v4 + shadcn/ui 初始化（手动写入 `components.json`，按需安装所需组件源码到 `src/components/ui/`）。
- 设置路径别名 `@/*` -> `src/*`。

### 5.2 Electron 主进程与 IPC

**文件**：`electron/main.ts`, `electron/preload.ts`, `src/types/electron.d.ts`

- `main.ts`：创建 BrowserWindow（`titleBarStyle: 'hiddenInset'` 适配 macOS），加载 vite dev server 或 `dist/index.html`。
- `preload.ts` 通过 `contextBridge.exposeInMainWorld('electron', { saveFile })`，封装：
  - `saveFile({ defaultPath, filters, data /* ArrayBuffer | string */ }) -> Promise<{ canceled, filePath }>`：主进程调用 `dialog.showSaveDialog` + `fs.writeFile`。
- 渲染进程的导出模块通过 `window.electron.saveFile` 触发系统原生保存对话框。

### 5.3 资产管理（Assets）

**文件**：`src/store/useAssetsStore.ts`, `src/components/assets/*`, `src/hooks/useImageBitmap.ts`

- State：
  - `baseImage: { bitmap: ImageBitmap, width, height, dataUrl } | null`
  - `elements: Array<{ id, name, bitmap: ImageBitmap, dataUrl, width, height }>`
- `BaseImageUploader`：
  - 支持拖拽 + 点击选择（`<input type="file" accept="image/png,image/jpeg">`）。
  - 读取后生成 `ImageBitmap`（用于 Canvas 高性能绘制）与 `dataUrl`（用于 SVG 导出嵌入）。
- `ElementsUploader`：同上，`multiple`，接受 `png, svg`。SVG 以 `Image` + 转 `ImageBitmap`（或 `createImageBitmap(blob)`）。
- `ElementThumbList`：网格缩略图 + hover 出现删除按钮，Tailwind 过渡动效。

### 5.4 参数面板

**文件**：`src/store/useParamsStore.ts`, `src/components/controls/*`

- 参数模型：
  ```ts
  type Params = {
    density: number;              // 1 - 2000
    baseSize: number;             // 0.1 - 3.0 （相对系数）
    sizeRandomness: number;       // 0 - 1 （0% - 100%）
    baseAngle: number;            // 0 - 360
    rotationRandomness: number;   // 0 - 180 （±度）或独立 full-random 开关
    rotationFullRandom: boolean;
    seed: number;                 // 随机种子，支持手动 reshuffle
  };
  ```
- `SliderField`：统一封装 shadcn Slider + 右侧数字输入（受控，失焦 clamp），label + unit。
- 所有参数修改 -> Zustand store 更新 -> 通过 `useDebouncedValue`（150ms）驱动 `layout.ts` 重新计算 `PlacedItem[]`，随后 `canvasRenderer` 重绘。
- "Reshuffle" 按钮：随机生成新的 seed 以在相同参数下获得新布局。

### 5.5 渲染核心（高内聚低耦合）

**文件**：`src/renderer/*`

- `rng.ts`：`mulberry32(seed)` 返回可复现的 `() => number`。
- `layout.ts`（**纯函数，无副作用，无 DOM 依赖，可单测**）：
  - 输入：`{ canvasWidth, canvasHeight, elements, params }`。
  - 策略：
    - 数量 `N = params.density`。
    - 位置：在画布矩形内均匀随机（未来可扩展为泊松盘/网格抖动，但 MVP 用均匀随机）。
    - 元素抽取：对每个位置 `rng` 选一个元素。
    - 尺寸：`baseSize * element.width * (1 + (rng()*2-1) * sizeRandomness)`。
    - 角度：`rotationFullRandom ? rng()*360 : baseAngle + (rng()*2-1) * rotationRandomness`。
  - 输出：`PlacedItem[] = { elementId, x, y, scale, rotation }`。
- `canvasRenderer.ts`：
  - `render(ctx, baseBitmap, elementsMap, placements)`：先画底图（`drawImage(bitmap, 0, 0)`），再依序 `translate + rotate + scale + drawImage`。
  - 离屏渲染：导出高清图时使用 `OffscreenCanvas`（或新建 `<canvas>`）按目标分辨率渲染，避免预览缩放损失。
- `svgExporter.ts`：
  - 构造 `<svg width=baseW height=baseH xmlns>`：
    - 第一层：`<image href="${baseDataUrl}" width height />`
    - 对每个 PlacedItem：`<g transform="translate rotate scale"><image href="${elementDataUrl}" ... /></g>`。
  - 返回字符串。

### 5.6 预览画布

**文件**：`src/components/canvas/PreviewCanvas.tsx`, `src/hooks/useCanvasFit.ts`

- 使用 `ResizeObserver` 监听容器尺寸，计算 `scale = min(containerW/baseW, containerH/baseH)`（带 padding），Canvas 的 CSS 尺寸 = 容器尺寸并保持比例，内部 `width/height` = 底图原始分辨率 * devicePixelRatio，保证清晰。
- 绘制流水线：
  1. 参数/资产变化 -> debounced -> `layout()` 计算 placements。
  2. `canvasRenderer.render()` 绘制。
- 加载态（空资产时展示 `EmptyState`）。

### 5.7 导出模块

**文件**：`src/components/export/ExportBar.tsx`

- UI：Select（PNG / JPEG / SVG）+ Select（1x / 2x / 3x，仅对位图有效）+ 导出按钮。
- 流程：
  - PNG / JPEG：新建离屏 Canvas（底图尺寸 × 倍数），在该 Canvas 上按相同 `placements` 但缩放后的几何参数重绘（避免使用预览 Canvas 的低分辨率版本），`canvas.toBlob` -> `arrayBuffer` -> `window.electron.saveFile`。
  - SVG：`svgExporter.toSvgString()` -> `window.electron.saveFile`（UTF-8 文本）。
- 主进程收到请求后 `dialog.showSaveDialog` 带默认文件名与扩展名过滤，再 `fs.writeFile`。

### 5.8 主题与样式

**文件**：`src/components/layout/ThemeToggle.tsx`, `src/index.css`, `src/store/useThemeStore.ts`

- shadcn 风格 CSS 变量定义 light / dark，在 `<html>` 上切换 `class="dark"`。
- 字体：默认 system UI，字号遵循用户记忆偏好（正文 14px，强调 15px，辅助 12px）。
- 组件动效：Slider 拖动平滑，按钮 hover 过渡 150ms，导出按钮点击轻微 scale-95。

### 5.9 打包（electron-builder）

**文件**：`electron-builder.yml`

- `appId: com.texturegenerator.app`
- `mac.target: dmg`（universal：`arm64 + x64`，不做签名公证，README 提示用户首次打开需右键"打开"）。
- `win.target: nsis`（x64）。
- `files`: `dist/**`, `dist-electron/**`, `package.json`。
- scripts：`dist:mac`, `dist:win`, `dist`（都构建）。

---

## 6. Assumptions & Decisions（关键假设与决策）

1. **无账号体系、无云端同步**：纯本地工具，不涉及网络。
2. **分布策略 MVP**：均匀随机 + 随机抽取元素；不做物理避免重叠（性能与体验平衡）。密度范围 `1 - 2000`，超过 2000 时提示可能卡顿。
3. **元素尺寸基准**：以元素图片原始像素 × `baseSize` 为基准，再叠加随机缩放；保证"所见即所得"。
4. **SVG 导出**：使用 `<image>` 内嵌 base64 dataURL（栅格元素保真），符合用户需求"将底图和元素保留为 `<image>` 标签嵌套组合"。
5. **种子可控**：暴露 seed + Reshuffle 按钮，让用户能复现或重置随机结果。
6. **性能**：用 `ImageBitmap` + 单次 Canvas 绘制；debounce 150ms；离屏渲染用于导出。
7. **打包不签名**：仅完成可分发文件产出，不涉及 Apple 公证 / Windows code signing。
8. **不主动创建 README.md**（遵循 system instructions）；如需文档用户会显式要求。

---

## 7. Verification（验证步骤）

1. `pnpm install && pnpm dev` 正常启动，Electron 窗口显示两栏布局。
2. 上传一张底图 + 3 个元素 PNG：画布立即显示底图。
3. 调整密度滑块：150ms 防抖后元素数量实时变化。
4. 调整 Base Size / Size Randomness / Base Angle / Rotation Randomness：画面实时更新，效果符合预期。
5. 点击 Reshuffle：相同参数下生成新的随机分布。
6. 删除某元素：画布中该元素消失。
7. 切换明暗主题：UI 平滑过渡。
8. 导出 PNG @2x：文件尺寸为底图 × 2，像素清晰，透明度保留（若底图为透明 PNG）。
9. 导出 JPEG：白底，高清。
10. 导出 SVG：在浏览器中打开可正确渲染，结构为 `<svg><image base/><g><image element/></g>...</svg>`。
11. `pnpm dist:mac` 产出 `.dmg`；`pnpm dist:win` 产出 `.exe`。在对应系统上可安装运行。

---

## 8. 执行顺序（Implementation Order）

1. 初始化仓库 + Electron/Vite/React/TS 脚手架。
2. 接入 Tailwind + shadcn/ui，完成 AppShell 两栏布局 + 主题切换。
3. 实现 Zustand stores（assets, params, theme）。
4. 实现 Asset 上传（底图 + 元素 + 缩略图列表）。
5. 实现 renderer 纯函数层（rng / layout / canvasRenderer / svgExporter），并本地冒烟。
6. 实现 PreviewCanvas + 尺寸自适应。
7. 实现 ControlPanel + SliderField + 各参数分组 + 防抖联动。
8. 实现 Electron IPC saveFile + 导出模块（PNG/JPEG/SVG + 倍数）。
9. 细节打磨：空状态、动效、暗色主题、字号规范。
10. 配置 electron-builder，产出 macOS dmg / Windows exe。
