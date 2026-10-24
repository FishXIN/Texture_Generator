# 架构与目录约定

本文描述当前代码，不将规划功能当作既有模块。

## 模块职责

| 目录 | 职责 | 主要入口 |
| --- | --- | --- |
| `electron/` | 窗口生命周期、预加载桥接、原生文件保存 | `main.ts`、`preload.ts` |
| `src/app/` | React 启动、界面组装、全局样式 | `main.tsx`、`App.tsx`、`styles.css` |
| `src/features/assets/` | 导入文件、解码素材、缓存位图、素材状态与界面 | `loader.ts`、`store.ts`、`types.ts` |
| `src/features/texture/` | 参数状态、随机布局、Canvas 绘制与预览 | `store.ts`、`engine/`、`components/` |
| `src/features/export/` | 格式选择、位图导出流程、SVG 序列化 | `components/ExportBar.tsx`、`svgExporter.ts` |
| `src/shared/` | 基础 UI、通用计算、浏览器下载、主题与桌面类型 | `ui/`、`lib/`、`theme/`、`types/` |
| `docs/` | 产品与工程文档；旧方案单独归档 | `product-plan.md`、`roadmap.md` |
| `.github/` | 构建、发布与协作模板 | `workflows/` |

同一功能的界面、类型和状态放在一起。不要把所有新逻辑重新堆入 `App.tsx`，也不要为尚未实现的功能创建空目录。

## 当前数据流

1. 素材界面将 `File` 传给 assets store。
2. loader 读取 data URL；SVG 额外保留原始文本，并解码为 `ImageBitmap`。
3. texture store 提供参数；`generateLayout` 根据画布、素材与种子输出 `PlacedItem[]`。
4. 预览和位图导出共享 `renderScene`，使用同一排列数据。
5. SVG 出口根据排列组合源 SVG 的图形结构。
6. 桌面端通过 preload 调用主进程保存；浏览器端使用下载工具。

## 依赖边界

- `app` 负责组装 features 与 shared。
- `assets` 使用自己的类型与 shared，不依赖 texture 或 export。
- `texture` 可以使用素材类型与 shared，不调用 export 或 Electron IPC。
- `export` 使用素材、排列与绘制能力，不修改纹理分布。
- `shared` 不导入 features 或 app。
- `electron` 不直接访问 React store；通过明确的 IPC 消息交换数据。

跨模块使用 `@/` 路径，模块内优先使用相对路径。不增加只用于转发导出的目录或文件。

## 当前引擎约定

`generateLayout` 没有 DOM 依赖；运行时只读取素材的标识与尺寸。随机数来自 `mulberry32(seed)`。固定画布、素材顺序、参数和种子时，排列稳定。

间距使用包围圆检测，是保守的避让近似；目标数量最多 2000，非负间距时每个对象最多尝试 60 次，所以实际数量可能更少。边缘范围没有按旋转后的轮廓精确计算。当前算法不具备周期边界。

`renderScene` 先绘制底图，再顺序绘制元素。预览适配尺寸只改变显示，不改变排列数据；位图出口按倍率重新绘制。

SVG 出口保留源图形内容，但尚未进行导入清理、ID 重命名或字体 / 滤镜 / 内嵌位图检查。全 SVG 输入仅是可导出条件，不是纯矢量认证。

## 后续扩展位置

先定义可序列化的项目数据，再扩展图层、手工对象、保存与撤销。不能直接将 `ImageBitmap` 当作项目存储数据。

新的颗粒生成、分布与周期边界逻辑放入纹理引擎；输出逻辑对象，由预览和导出共用。边缘副本应是同一对象的派生显示，避免重复计数和加深。

运动由静态对象及时间计算，不在每一帧重抽种子。导出模块负责尺寸、范围、格式、逐帧输出和取消，不能静默改换格式或重新生成布局。

这些是实现约束，尚未代表已完成能力。具体范围见[迭代路线](roadmap.md)。
