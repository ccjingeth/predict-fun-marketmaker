#!/bin/bash

# GitHub Release 上传脚本

set -e

# 配置
REPO="ccjingeth/predict-fun-marketmaker"
VERSION="0.3.0"
DIST_DIR="desktop-app/dist"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=========================================${NC}"
echo -e "${YELLOW}GitHub Release 上传工具${NC}"
echo -e "${YELLOW}=========================================${NC}"
echo ""

# 检查是否安装了gh命令
if ! command -v gh &> /dev/null; then
    echo "❌ 未安装 GitHub CLI (gh)"
    echo ""
    echo "请先安装 GitHub CLI:"
    echo "  macOS:   brew install gh"
    echo "  Ubuntu:  sudo apt install gh"
    echo "  Windows: winget install GitHub.cli"
    echo ""
    echo "然后登录: gh auth login"
    exit 1
fi

# 检查是否已登录
if ! gh auth status &> /dev/null; then
    echo "❌ 未登录 GitHub"
    echo "请运行: gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI 已安装并登录${NC}"
echo ""

# 检查dist目录是否存在
if [ ! -d "$DIST_DIR" ]; then
    echo "❌ 未找到打包目录: $DIST_DIR"
    echo "请先运行打包脚本"
    exit 1
fi

# 创建 Release
echo -e "${YELLOW}创建 GitHub Release...${NC}"
echo ""

# 生成Release描述
cat > /tmp/release-notes.md << 'EOF'
# 🔑 Predict.fun Desktop Console v0.3.0

## 🎉 重大更新

### 激活码系统
- ✅ **做市商模块** - 完全免费使用
- 🔒 **套利模块** - 需要激活码

### 功能优化
- 改进用户界面
- 添加激活码输入UI
- 优化错误提示
- 完善文档说明

## 📦 下载说明

### macOS
1. 下载 `Predict-fun-Console-0.3.0-arm64-Mac.dmg` (Apple Silicon) 或 `Predict-fun-Console-0.3.0-x64-Mac.dmg` (Intel)
2. **首次运行：** 右键点击应用 → 选择"打开"
3. 拖拽到 Applications 文件夹

### Windows
1. 下载 `Predict-fun-Console-Setup-0.3.0.exe`
2. 双击安装
3. 从开始菜单启动

### Linux
1. Ubuntu/Debian: 下载 `.deb` 文件
2. 其他发行版: 下载 `.AppImage` 文件

## 🔑 激活码使用

### 获取激活码
联系管理员提供：
- 用户ID
- 用户名
- 有效期（天数）

### 激活方法

**方法1 - 应用内激活：**
1. 打开应用
2. 在"套利机器人"区块输入激活码
3. 点击"激活"

**方法2 - 命令行激活：**
```bash
npm run activate <激活码>
```

## 📋 功能对比

| 功能 | 做市商模块 | 套利模块 |
|------|-----------|---------|
| 自动做市 | ✅ 免费 | - |
| 同平台套利 | - | 🔒 需激活 |
| 跨平台套利 | - | 🔒 需激活 |
| 实时监控 | ✅ 免费 | - |

## ⚠️ 重要提示

1. **首次使用**
   - 编辑 `.env` 文件配置API密钥
   - 重启应用使配置生效

2. **macOS用户**
   - 如提示"已损坏"，运行：
     ```bash
     xattr -cr /Applications/Predict.fun\ Console.app
     ```

3. **激活码绑定**
   - 激活码绑定到机器硬件
   - 每台电脑需要独立激活码
   - 请勿分享激活码

## 🐛 问题反馈

发现问题请提交 Issue：
https://github.com/ccjingeth/predict-fun-marketmaker/issues

---

**完整更新日志**: 查看 [CHANGELOG.md](https://github.com/ccjingeth/predict-fun-marketmaker/blob/main/CHANGELOG.md)
EOF

# 创建Release
gh release create "v$VERSION" \
  --title "Predict.fun Desktop Console v$VERSION" \
  --notes-file /tmp/release-notes.md \
  --repo "$REPO" 2>&1 || echo "Release可能已存在，继续上传文件..."

echo -e "${GREEN}✓ Release 创建成功${NC}"
echo ""

# 上传文件
echo -e "${YELLOW}上传安装包...${NC}"
echo ""

# 查找所有安装包
find "$DIST_DIR" -type f \( -name "*.dmg" -o -name "*.zip" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.deb" -o -name "*.tar.gz" \) | sort | while read file; do
    filename=$(basename "$file")
    filesize=$(du -h "$file" | cut -f1)

    echo "上传: $filename ($filesize)..."

    gh release upload "v$VERSION" "$file" --repo "$REPO" --clobber

    echo -e "${GREEN}✓ $filename 上传完成${NC}"
    echo ""
done

# 上传发布说明
echo "上传发布说明..."
gh release upload "v$VERSION" "$DIST_DIR/RELEASE_NOTES.md" --repo "$REPO" --clobber

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ 所有文件上传完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Release 页面:"
echo "https://github.com/$REPO/releases/v$VERSION"
echo ""
