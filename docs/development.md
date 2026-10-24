# 开发指南

## 环境与启动

推荐 Node.js 20 LTS 或 22 LTS、npm 10+。依赖版本以 `package-lock.json` 为准。

```bash
npm ci
npm run dev
```

开发命令启动 Vite 并打开 Electron。默认端口为 5173，占用时自动切换；以终端输出的地址为准。Electron 主进程收到实际开发服务地址。

需要只在浏览器查看编译结果时：

```bash
npm run build
npm run preview
```

浏览器没有原生保存对话框，会回退为文件下载。当前应用沿用桌面布局，未针对手机创作做适配。

## 检查与构建

```bash
npm run typecheck
npm run build
```

- `typecheck` 检查 TypeScript 项目。
- `build` 执行类型检查，编译前端到 `dist/`、主进程和 preload 到 `dist-electron/`。
- `.tsbuild/` 为 TypeScript 构建缓存。
- CI 在主分支推送和 Pull Request 时执行类型检查与构建；这不代表完成了所有设计场景验收。

修改代码路径后，同时检查 `index.html`、导入路径、`components.json` 与文档。当前 shadcn 配置使用 `tailwind.config.js`、`src/app/styles.css` 和 `src/shared/ui/`。

## 功能验证

按修改范围验证实际使用流程：

1. 导入一张底图与多个元素，检查缩略图、尺寸及预览。
2. 改变尺寸、旋转、间距和种子，确认参数会即时生效。
3. 恢复同一参数与种子，确认排列一致。
4. 删除元素、清空底图和切换主题，确认界面仍可操作。
5. 导出 PNG / JPEG，核对尺寸、已有透明度和 JPEG 白底。
6. 全 SVG 输入时导出 SVG，核对结构与外观；混入位图时 SVG 入口禁用。
7. 在桌面端检查系统保存、取消和再次导出。

纯矢量检查、平铺、动态循环等规划能力须在实现后增加对应验证。当前不能用静态导出成功代替这些验收。

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
