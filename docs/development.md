# 开发指南

## 环境与启动

推荐 Node.js 20 LTS 或 22 LTS、npm 10+。依赖版本以 `package-lock.json` 为准。

```bash
npm ci
npm run dev
```

开发命令启动 Vite 并打开 Electron。默认端口为 5173，占用时自动切换；以终端输出的地址为准。Electron 主进程收到实际开发服务地址。

只在浏览器开发时（不启动 Electron）：

```bash
npm run dev:web
```

默认链接为 `http://127.0.0.1:5173`。查看编译结果使用 `npm run build` 和 `npm run preview`。浏览器使用文件下载，Electron 使用系统保存对话框。首版针对桌面创作，未针对手机布局做适配。

默认打开黑白纹理素材工作台；`http://127.0.0.1:5173/?studio=pattern` 为原图形 / 动态入口。两种入口使用同一服务地址，旧 `.texture.json` 在默认入口打开时自动转到对应工作台。

## 检查与构建

```bash
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

- `typecheck` 检查 TypeScript 项目。
- `build` 执行类型检查，编译前端到 `dist/`、主进程和 preload 到 `dist-electron/`。
- `.tsbuild/` 为 TypeScript 构建缓存。
- `test` 在 Chromium 中运行 `tests/workbench.spec.ts`、`tests/library.spec.ts`、`tests/material.spec.ts`、`tests/output.spec.ts` 与 `tests/studio.spec.ts`，自动启动仅浏览器的开发服务。CI 在主分支推送和 Pull Request 时运行浏览器验收、类型检查与构建。
- 已有 Chromium 可通过 `TEXTURE_TEST_BROWSER=/absolute/path/to/chrome npm test` 指定；路径只用于本地，不写入仓库。运行测试前退出占用 5173 的旧服务，以免热更新产生多个不同版本的状态模块。

修改代码路径后，同时检查 `index.html`、导入路径、`components.json` 与文档。当前 shadcn 配置使用 `tailwind.config.js`、`src/app/styles.css` 和 `src/shared/ui/`。

## 功能验证

自动验收包括：

共 34 项真实浏览器场景。统一工作台新增实时预览与正式导出数值一致性、拖动时持续更新 / 精确松手 / 一次撤销 / 键盘 / 锁定，以及原色背景与透明元素、预设保留素材、画布比例、保存重开和 RGBA 导出检查。其中完整纹理库的 8 项覆盖 119 个预设的种子复现、项目迁移、非恒定结果与分类可达；10 种算法的独立统计、周期值与梯度；蓝噪低频抑制、间距 / 路径 / 对称几何；13 种运动的空间 / 时间周期及 curl 流场散度；输入亮度 / Alpha；纯 / 优化 SVG 的结构与灰度 / Alpha 像素对照；动态序列及手工编排 UI。

输出相关的 4 项覆盖常用比例 / 清晰度 / 自定义尺寸与 8K 项目重开；实际 8192 × 8192 的 16 位透明 PNG 扫描行、CRC 与像素；8K RGB 法线和 DirectX 配套 ZIP；统一弹窗的键盘选择、外部关闭、焦点恢复与原生 / 自定义导出弹窗内的选择。

黑白工作台的另外 9 项检查周期灰度与解析梯度（含方向、扰动、图层混合及导入边缘）、有限差分梯度对照、种子与分辨率一致、法线强度 / 方向、独立 PNG CRC / zlib / 真 16 位 / 黑白 Alpha、专门参数有效性、旧项目迁移、分类搜索、二维 UI 保存重开、4K 取消后重试与 SVG 安全导入。原有图形 / 动态的 10 项如下：

1. 保存重开复现场景；只随机尺寸时位置、角度、颜色和手工对象保持不变；撤销重做恢复参数。
2. 周期距离检查相邻单元间距；五种运动在普通 / 无缝画布的循环边界连续。
3. SVG 脚本、外部资源与复杂效果检查；源文件保留；CSS 优先级和 ID 隔离。
4. Canvas 与纯 / 优化 SVG 在透明蒙版、边缘副本、选区与混合模式中的像素对照。
5. 非整数像素倍率下整面绘制；20,000 颗粒的生成和数量限制；缺失素材与无效项目提示。
6. 序列 PNG Alpha、不同帧内容、时长 / 帧率约束、取消后重试与 ZIP 校验。
7. 界面导入、拖动、锁定、撤销、项目下载重开及 PNG / PNG 序列下载；系统 `unzip` 独立验证生成的 ZIP。

另外人工检查 1080 × 700、1440 × 900 等桌面窗口、预览缩放与滚动、恢复副本、预设、背景切换，以及 Electron 的系统保存和取消。旧版「底图阵列」仍单独检查底图、位图导入、随机排列与原有出口。

像素比较允许浏览器光栅化的小幅抗锯齿差异；测试不保证所有第三方设计软件的 SVG、字体和滤镜表现。发布前应在计划支持的设计 / 合成软件中导入实际文件，检查纯矢量编辑、Alpha 合成、帧率和循环边界。

## 当前规模与性能边界

统一工作台：导出最长边 128–8192 px，保持画布比例；静态预览 512 px，拖动 / 动态 192 px。最多 16 层、16 个源，每层 2000 普通图形、512 蓝噪 / 最小间距样本；单素材 5 MB、项目 25 MB。预览解码上限 1024 px，导出读取原图细节，保留 RGB / Alpha。序列总像素最多 128 百万。预览使用常驻 Worker，单任务完成后读取最新参数；导出使用独立可取消任务。按输出需求省略未用的通道计算和缓冲，PNG 每次压缩 32 行，避免完整未压缩图片副本。纯纹理 16 位 PNG 直接编码浮点值，原色合成与预览为 8 位。具体公式、透明转换和边界见 [material-studio.md](material-studio.md)。

完整样例使用同一 Worker 和正式 PNG / 序列出口：

```bash
npm run dev:web
node scripts/library-samples.cjs /absolute/path/to/完整纹理库样例
```

需要已安装的 Playwright Chromium，或设置 `TEXTURE_TEST_BROWSER`。输出 119 个 512 px PNG、各自可重开的项目、分类索引，以及 13 种 12 FPS 透明循环序列。大型预设逐项生成，不应与代码热更新同时进行。

图形 / 动态工作台：

画布 64–4096 px；最多 16 层、32 个 SVG、20,000 自动颗粒、2,000 手工对象。每层颗粒最多 5,000；SVG 最多 5 MB / 20,000 节点，长宽比最多 512:1；项目文件最多 25 MB。

静态出口最多 16 MP / 8192 px；序列最多 720 帧、每帧 4 MP、ZIP 256 MB。编辑预览最多 4 MP，按显示大小降采样而不删减对象。SVG 位图解码最长边最多 4096 px。高密度、复杂滤镜或大幅叠加仍可能较慢，不能据此承诺任意项目实时运行。

蒙版生成采样分辨率为 256 × 256，过细轮廓可能降低实际颗粒数量。最小间距采用最大尺寸的保守包围范围，网格 / 错位模式不会为被蒙版排除的单元补点。实际生成数量显示在画布上方。

循环序列使用 `[0, duration)`，不重复最后一帧；`duration × fps` 必须是整数。平铺漂移方向吸附为八个方向，按整数单元循环。序列暂在内存打包；需要更大规模时应后续引入分批写入，不能绕过现有限制。

## 安装包与发布

```bash
npm run dist        # 当前平台
npm run dist:mac    # macOS
npm run dist:win    # Windows
```

安装包输出到 `release/`。在目标系统检查安装与启动；本地跨平台打包成功不等于目标系统已验证。发布说明见 [releases.md](releases.md)。

不要提交 `node_modules/`、`dist/`、`dist-electron/`、`.tsbuild/`、`release/` 或工具个人配置。依赖变更同时提交 `package.json` 和锁文件。

## 证书问题

若 npm 或 Electron 下载出现 `unable to get local issuer certificate` / `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`，先检查网络代理和受信任证书。

需要企业根证书时，让 Node 使用经确认的 CA 文件：

```bash
NODE_EXTRA_CA_CERTS=/absolute/path/to/trusted-ca.pem npm ci
```

不要将本机证书路径写入仓库。仅做类型检查与前端构建时，可以跳过 Electron 二进制下载：

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
```

跳过下载后不能直接启动或打包 Electron；修复证书后重新正常安装。不要通过关闭 TLS 验证解决此问题。
