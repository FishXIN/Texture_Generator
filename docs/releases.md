# 安装包与发布

## 下载

安装包统一在 [GitHub Releases](https://github.com/FishXIN/Texture_Generator/releases) 管理，[最新版本入口](https://github.com/FishXIN/Texture_Generator/releases/latest)跟随发布更新。

当前最新发布为 `v0.1.5`，附件包括 macOS arm64 `.dmg` 和 Windows x64 `.exe`。其他架构以各版本实际附件为准，不依据构建配置推断支持。

主分支文档和代码可能包含尚未发布的改动；已下载的旧安装包不会自动获得这些改动。发布记录见 [CHANGELOG](../CHANGELOG.md)。

## 本地构建

```bash
npm ci
npm run dist:mac
# 或在 Windows 使用：
npm run dist:win
```

`electron-builder.yml` 定义安装包名称与目标格式。产物输出到 `release/`；整个输出目录由 Git 忽略，下载副本和二进制文件不放进源码仓库。

Windows 使用可选择安装目录的 NSIS 安装流程。当前流程未配置应用签名或 macOS 公证；这不等于已完成面向商用分发的签名流程。

## GitHub Actions

`.github/workflows/release.yml` 在 `v*` 标签推送或手动执行时运行，分别在 macOS 和 Windows 安装依赖、构建安装包并上传工作流产物。`electron-builder` 在标签发布环境下使用 `GH_TOKEN` 发布 GitHub Release 附件。

发布前：

1. 确认 `package.json` 与锁文件版本一致，补充对应变更记录。
2. 完成类型检查、构建和目标系统安装 / 启动验证。
3. 确认标签版本与包版本一致。
4. 推送发布标签，检查两种系统的工作流和 Release 附件。

普通源码或文档优化不创建新标签，也不会替换现有安装包。手动工作流运行主要用于构建检查；发布行为以标签和 electron-builder 的发布策略为准。
