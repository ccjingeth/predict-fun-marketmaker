#!/bin/bash

# Predict.fun Desktop - 多平台打包脚本

set -e

echo "========================================="
echo "Predict.fun Desktop - 多平台打包"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查当前平台
CURRENT_OS=$(uname -s)
echo "当前操作系统: $CURRENT_OS"

# 编译后端代码
echo ""
echo -e "${YELLOW}步骤 1/3: 编译后端代码${NC}"
echo "----------------------------------------"
cd "$(dirname "$0")/../.."
npm run build
echo -e "${GREEN}✓ 后端编译完成${NC}"

# 打包桌面应用
echo ""
echo -e "${YELLOW}步骤 2/3: 打包桌面应用${NC}"
echo "----------------------------------------"
cd desktop-app

if [ "$CURRENT_OS" = "Darwin" ]; then
    echo "检测到 macOS，打包 macOS 版本..."
    npm run dist

    # 检查打包结果
    if [ -d "dist/mac" ] || [ -d "dist/mac-arm64" ]; then
        echo -e "${GREEN}✓ macOS 打包完成${NC}"
        echo ""
        echo "生成的文件:"
        find dist -name "*.dmg" -o -name "*.zip" | while read file; do
            SIZE=$(du -h "$file" | cut -f1)
            echo "  - $file ($SIZE)"
        done
    else
        echo -e "${RED}✗ macOS 打包失败${NC}"
        exit 1
    fi

elif [ "$CURRENT_OS" = "Linux" ]; then
    echo "检测到 Linux，打包 Linux 版本..."
    npm run dist

    if [ -d "dist/linux" ]; then
        echo -e "${GREEN}✓ Linux 打包完成${NC}"
        echo ""
        echo "生成的文件:"
        find dist -name "*.AppImage" -o -name "*.deb" -o -name "*.tar.gz" | while read file; do
            SIZE=$(du -h "$file" | cut -f1)
            echo "  - $file ($SIZE)"
        done
    else
        echo -e "${RED}✗ Linux 打包失败${NC}"
        exit 1
    fi

else
    echo "检测到 Windows，打包 Windows 版本..."
    npm run dist

    if [ -d "dist/win-unpacked" ]; then
        echo -e "${GREEN}✓ Windows 打包完成${NC}"
        echo ""
        echo "生成的文件:"
        find dist -name "*.exe" -o -name "*.zip" | while read file; do
            SIZE=$(du -h "$file" | cut -f1)
            echo "  - $file ($SIZE)"
        done
    else
        echo -e "${RED}✗ Windows 打包失败${NC}"
        exit 1
    fi
fi

# 创建发布说明
echo ""
echo -e "${YELLOW}步骤 3/3: 创建发布说明${NC}"
echo "----------------------------------------"
cat > desktop-app/dist/RELEASE_NOTES.md << 'EOF'
# Predict.fun Desktop Console v0.3.0

## 📦 下载说明

### macOS 用户
1. 下载 `.dmg` 文件
2. 双击打开并拖拽到 Applications 文件夹
3. **首次运行：** 右键点击应用，选择"打开"，然后点击"打开"确认
4. 之后可以正常双击启动

### Windows 用户
1. 下载 `.exe` 安装包
2. 双击运行安装程序
3. 按照提示完成安装
4. 从开始菜单启动应用

### Linux 用户
选择适合你系统的安装包：

**Ubuntu/Debian:**
- 下载 `.deb` 文件
- 运行: `sudo dpkg -i Predict.fun-Console-*.deb`

**其他发行版:**
- 下载 `.AppImage` 文件
- 添加执行权限: `chmod +x Predict.fun-Console-*.AppImage`
- 运行: `./Predict.fun-Console-*.AppImage`

## 🔑 激活码说明

**重要提示：**
- ✅ **做市商模块** - 完全免费，无需激活码
- 🔒 **套利模块** - 需要激活码才能使用

### 如何获取激活码

联系管理员获取激活码，提供：
- 用户ID（唯一标识符）
- 用户名
- 需要的有效期（天数）

### 如何激活

**方法1 - 在应用中激活：**
1. 打开应用
2. 在"套利机器人"区块找到激活输入框
3. 输入激活码
4. 点击"激活"按钮

**方法2 - 命令行激活：**
```bash
npm run activate <激活码>
```

## 📋 功能列表

### ✅ 做市商模块（免费）
- 自动做市
- 实时监控
- 积分优化
- 无需激活码

### 🔒 套利模块（需激活）
- 同平台套利（yes+no<1）
- 跨平台套利（价差套利）
- 自动执行
- 需要激活码

## ⚠️ 重要提示

1. **首次运行配置**
   - 应用启动后会自动创建配置文件
   - 编辑 `.env` 文件填入你的 API 密钥
   - 重启应用使配置生效

2. **macOS 安全提示**
   - 如果提示"已损坏"，请在终端运行：
     ```bash
     xattr -cr /Applications/Predict.fun\ Console.app
     ```

3. **Windows 安全提示**
   - Windows Defender 可能误报，需要添加信任

4. **激活码绑定**
   - 激活码绑定到机器硬件
   - 每台电脑需要独立的激活码
   - 请妥善保管激活码

## 🆘 技术支持

如有问题，请提供：
- 操作系统版本
- 应用版本
- 错误信息截图
- 激活状态

---

**版本**: 0.3.0
**发布日期**: 2026-02-22
**更新内容**:
- 添加激活码系统
- 优化做市商和套利模块分离
- 改进用户界面
- 修复已知问题
EOF

echo -e "${GREEN}✓ 发布说明创建完成${NC}"

# 完成
echo ""
echo "========================================="
echo -e "${GREEN}打包完成！${NC}"
echo "========================================="
echo ""
echo "输出目录: desktop-app/dist/"
echo ""
echo "下一步:"
echo "1. 测试打包的应用"
echo "2. 创建 GitHub Release"
echo "3. 上传文件到 Release"
echo ""
