# 🔑 激活码系统快速参考

## 系统概述

**模块分离:**
- ✅ **做市商模块** - 完全免费，无需激活码
- 🔒 **套利模块** - 需要激活码才能使用

## 快速开始

### 用户 - 激活套利模块

```bash
# 1. 检查激活状态
npm run activate:check

# 2. 输入激活码激活（从管理员获取）
npm run activate <激活码>

# 3. 验证激活成功
npm run activate:check
```

### 管理员 - 生成激活码

```bash
# 生成测试激活码（30天）
npm run activate:quick test_user 30

# 生成年费激活码（365天）
npm run activate:quick user123 365

# 交互式生成激活码
npm run activate:generate
```

## 所有命令

| 命令 | 说明 |
|------|------|
| `npm run activate` | 交互式激活向导 |
| `npm run activate <key>` | 直接使用激活码激活 |
| `npm run activate:check` | 查看当前激活状态 |
| `npm run activate:clear` | 清除激活（测试用） |
| `npm run activate:generate` | 交互式生成激活码 |
| `npm run activate:quick` | 快速生成测试激活码 |
| `npm run start:mm` | 启动做市商（免费） |
| `npm run start:arb` | 启动套利机器人（需激活） |

## 激活码格式

```
XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
```

示例：`A7E5-2F9C-725E-1899-9F93-D64C-0AC4-DBF7`

## 激活信息文件

激活后会在项目根目录生成：`.arbitrage_activation.json`

**不要删除此文件！**

## 错误排查

### ❌ "未激活或已过期"

```bash
# 检查状态
npm run activate:check

# 如果过期，联系管理员获取新激活码
# 然后重新激活
npm run activate <新激活码>
```

### ❌ "激活码与当前机器不匹配"

激活码绑定到机器硬件，每台电脑需要单独的激活码。

### ❌ "激活码格式无效"

确保激活码完整，包含7个连字符和8组十六进制字符。

## 安全特性

- ✅ 机器绑定（基于MAC地址）
- ✅ 时间限制（可设置天数）
- ✅ 功能限制（只授权套利模块）
- ✅ 加密验证（SHA-256）

## 测试流程

```bash
# 1. 生成测试激活码
npm run activate:quick test_user 30

# 2. 激活
npm run activate <生成的激活码> test_user "测试用户"

# 3. 验证
npm run activate:check

# 4. 测试套利机器人激活检查
node --import tsx scripts/test-arb-activation.ts

# 5. 清除（测试用）
node --import tsx scripts/clear-activation.ts
```

## 桌面应用

在简化版应用中，可以直接在UI界面激活：

1. 打开桌面应用
2. 在"🤖 全自动套利"区块找到激活输入框
3. 输入激活码
4. 点击"激活"按钮

## 完整文档

详细文档请查看：`docs/ACTIVATION_GUIDE.md`

---

**版本**: 1.0.0
**更新时间**: 2026-02-22
**作者**: Claude Sonnet 4.5
