# Texture Generator · 纹理生成器

面向设计师的本地纹理与图形编排工具。导入素材，控制疏密、尺寸和旋转，用随机种子复现排列，再导出到设计工作流。

[下载安装包](https://github.com/FishXIN/Texture_Generator/releases/latest) · [使用与能力边界](#当前能力) · [产品策划](docs/product-plan.md) · [迭代路线](docs/roadmap.md) · [开发指南](docs/development.md) · [English](#english)

## 项目定位

让纹理从一次性的随机结果，变成可控制、可复用的设计素材。

当前 `0.1.5` 版本提供底图与元素素材的随机编排、实时预览和静态导出。后续将围绕**参数化纹理、自定义图形编排、可靠导出**扩展无缝平铺、图层和循环动态纹理。

适合制作包装与品牌图案、视觉设计中的素材阵列，以及背景纹理探索。当前没有内置颗粒生成器，也不保证排列结果能够无缝重复。

## 当前能力

| 功能 | 当前支持 |
| --- | --- |
| 素材导入 | 一张底图、多个元素；PNG、JPEG、WebP、SVG；点击或拖拽导入 |
| 自动编排 | 随机散布；控制元素间距和边缘间距 |
| 参数控制 | 目标数量、基础尺寸、尺寸随机度、基础角度、旋转随机度、完全随机旋转 |
| 随机复现 | 相同画布、素材顺序、参数与种子生成相同排列；支持更换种子 |
| 预览 | 参数即时更新；画布按容器适配；浅色与深色界面 |
| 静态导出 | PNG、JPEG，支持 1× / 2× / 3× 尺寸 |
| SVG 导出 | 底图和全部元素均为 SVG 时，组合源 SVG 图形结构 |
| 本地文件 | Electron 系统保存对话框；浏览器运行时回退为下载 |

**导出需要注意：**

- **PNG** 保留场景已有透明度，但总会绘制底图；不透明底图不会自动变成透明。当前没有独立的背景开关或透明度参数。
- **JPEG** 使用白色背景，不保留透明通道。
- **SVG** 保留图形结构，不会先把整个场景转成一张位图。源 SVG 自身仍可能包含位图、字体或滤镜；目前没有纯矢量检查和完整兼容性检查，不能仅凭 `.svg` 后缀保证纯矢量。
- 导出范围为整个底图画布。位图按所选倍率重新绘制；放大原有位图不会增加其原始细节。
- “密度”目前表示目标实例数。间距和画布限制可能让实际生成数量低于目标，结果以界面统计为准。

多图层、自由摆放、无缝平铺、蒙版、连续噪点、动画、PNG 序列、项目保存和撤销重做均为**规划功能**，尚未实现。详见[迭代路线](docs/roadmap.md)。

## 使用

1. 导入底图，确定画布尺寸。
2. 批量导入元素素材。
3. 调整密度、尺寸、旋转和间距，查看实时排列。
4. 保留满意的随机种子；需要新排列时点击“重排”。
5. 选择 PNG、JPEG 或符合条件的 SVG，保存到本地。

安装包在 [GitHub Releases](https://github.com/FishXIN/Texture_Generator/releases) 下载。当前发布流程覆盖 macOS 和 Windows；不同版本的可用架构以实际附件为准。发布说明见[安装包与发布](docs/releases.md)。

## 本地开发

推荐 Node.js 20 LTS 或 22 LTS、npm 10+。

```bash
git clone https://github.com/FishXIN/Texture_Generator.git
cd Texture_Generator
npm ci
npm run dev
```

```bash
npm run typecheck   # 类型检查
npm run build       # 编译前端与 Electron
npm run preview     # 浏览器预览编译后的前端
npm run dist        # 当前平台安装包
```

macOS / Windows 打包分别使用 `npm run dist:mac` / `npm run dist:win`。安装包输出到 `release/`，不提交到 Git。启动、证书问题和构建约定见[开发指南](docs/development.md)。

## 目录

```text
Texture_Generator/
├── electron/                 # 桌面窗口、预加载、原生文件保存
├── src/
│   ├── app/                  # 应用入口、界面组装、全局样式
│   ├── features/
│   │   ├── assets/           # 素材导入、解码、类型、状态与界面
│   │   ├── texture/          # 参数、随机排列、Canvas 渲染与预览
│   │   └── export/           # 导出面板、SVG 序列化、格式类型
│   └── shared/               # 基础 UI、主题、通用工具与桌面类型
├── docs/                     # 产品策划、路线、架构与开发说明
├── .github/                  # 构建检查、发布流程与协作模板
├── electron-builder.yml      # 安装包配置
└── package.json
```

模块职责和扩展位置见[架构说明](docs/architecture.md)。只为已有能力建立目录，规划中的功能在实现时再增加模块。

## 参与改进

欢迎通过 [Issues](https://github.com/FishXIN/Texture_Generator/issues) 提交实际设计场景、导入异常或导出问题。请附上复现步骤、系统和版本；素材仅在可以公开时附带。

提交代码前阅读[贡献说明](CONTRIBUTING.md)，并运行类型检查与构建。[变更记录](CHANGELOG.md)区分已发布版本与尚未发布的改动。

## English

Texture Generator is a local-first desktop tool for designers to arrange imported SVG and raster assets into reproducible texture layouts.

The current **0.1.5** release supports:

- A base image and multiple element assets: PNG, JPEG, WebP and SVG.
- Seeded random placement with size, rotation, spacing and edge-margin controls.
- Immediate Canvas preview and light / dark interface themes.
- PNG and JPEG export at 1×, 2× or 3×.
- SVG composition when all imported assets are SVG, preserving their source graphic structure.
- Native file saving in Electron and download fallback in a browser.

PNG preserves existing scene transparency, but always includes the base image. JPEG uses a white background. SVG inputs may contain embedded images, fonts or filters, so the current exporter **does not certify pure-vector output or full compatibility**. Export covers the entire base-image canvas; spacing constraints may produce fewer elements than the requested count.

Built-in noise generation, layers, manual placement, seamless tiling, masks, animation, PNG sequences, project persistence and undo / redo are planned capabilities. They are not available in the current release.

Use `npm ci` followed by `npm run dev` for development. Run `npm run typecheck` and `npm run build` before submitting changes. Installers are available on [GitHub Releases](https://github.com/FishXIN/Texture_Generator/releases/latest).

See the [roadmap](docs/roadmap.md), [architecture](docs/architecture.md) and [development guide](docs/development.md) for the current direction and implementation boundaries. Product planning documents are currently in Chinese.

## License

[MIT](LICENSE)
