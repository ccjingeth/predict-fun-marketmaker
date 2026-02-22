# 📦 发布打包指南

## 快速开始

### 1. 打包应用

```bash
cd desktop-app
npm run build:release
```

这将会：
1. 编译后端代码
2. 打包桌面应用（当前平台）
3. 创建发布说明

### 2. 上传到 GitHub Release

```bash
cd desktop-app
npm run upload:release
```

这将会：
1. 创建 GitHub Release
2. 上传所有安装包
3. 上传发布说明

## 平台支持

| 平台 | 输出格式 | 架构 |
|------|---------|------|
| **macOS** | .dmg, .zip | x64, arm64 |
| **Windows** | .exe, .zip | x64 |
| **Linux** | .AppImage, .deb, .tar.gz | x64 |

## macOS 特殊说明

### 绕过 Gatekeeper

由于没有 Apple 开发者账号签名，用户需要：

1. **首次运行时**：
   - 右键点击应用
   - 选择"打开"
   - 点击"打开"确认

2. **或者使用命令**：
   ```bash
   xattr -cr /Applications/Predict.fun\ Console.app
   ```

### 启用公证（可选）

如果有 Apple 开发者账号，创建 `.env` 文件：

```bash
# Apple 开发者账号
APPLE_ID=your@email.com
APPLE_ID_PASSWORD=app-specific-password
APPLE_TEAM_ID=your-team-id
```

## Windows 特殊说明

### SmartScreen 警告

Windows 可能显示"Windows 已保护你的电脑"警告。

用户需要：
1. 点击"更多信息"
2. 选择"仍要运行"

## Linux 特殊说明

### Ubuntu/Debian

```bash
sudo dpkg -i Predict-fun-Console-*.deb
sudo apt-get install -f  # 修复依赖
```

### AppImage

```bash
chmod +x Predict-fun-Console-*.AppImage
./Predict-fun-Console-*.AppImage
```

## 手动打包（单平台）

### macOS
```bash
npm run build:bot
electron-builder --mac --x64 --arm64
```

### Windows
```bash
npm run build:bot
electron-builder --win --x64
```

### Linux
```bash
npm run build:bot
electron-builder --linux --x64
```

## 故障排查

### 打包失败

1. 检查 Node.js 版本（推荐 v18+）
2. 删除 `node_modules` 重新安装
3. 删除 `dist` 目录重试

### 上传失败

1. 检查是否安装 GitHub CLI: `gh --version`
2. 检查是否登录: `gh auth status`
3. 检查 Release 是否已存在

### macOS 签名问题

如果遇到签名错误，可以在 `package.json` 中禁用：

```json
"mac": {
  "hardenedRuntime": false,
  "gatekeeperAssess": false
}
```

## 发布流程

1. **开发完成**
   ```bash
   # 测试应用
   npm run dev
   ```

2. **版本更新**
   ```bash
   # 修改版本号
   # desktop-app/package.json
   # package.json
   ```

3. **打包应用**
   ```bash
   npm run build:release
   ```

4. **测试安装包**
   - macOS: 测试 .dmg 文件
   - Windows: 测试 .exe 文件
   - Linux: 测试 .AppImage 文件

5. **上传 Release**
   ```bash
   npm run upload:release
   ```

6. **发布公告**
   - 在 GitHub Release 页面编辑描述
   - 添加截图和视频（可选）

## 自动化（可选）

可以创建 GitHub Actions 自动打包所有平台：

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run build:bot
        working-directory: desktop-app

      - run: npm run dist
        working-directory: desktop-app
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: softprops/action-gh-release@v1
        with:
          files: desktop-app/dist/*
```

---

**版本**: 0.3.0
**更新时间**: 2026-02-22
