# 🔑 套利模块激活码管理指南

## 🎯 激活码系统概述

套利模块现在需要激活码才能使用，而做市商模块完全免费。

### 功能分离

| 模块 | 状态 | 说明 |
|------|------|------|
| 做市商模块 | ✅ 免费 | 无限制使用，无需激活码 |
| 套利模块 | 🔒 需激活 | 必须有有效激活码 |

---

## 🚀 快速开始

### 用户激活流程

#### 方法 1：命令行激活

```bash
# 方式 1：交互式激活
npm run activate

# 方式 2：直接激活
npm run activate XXXX-XXXX-XXXX-XXXX-XXXX

# 方式 3：检查激活状态
npm run activate:check
```

#### 方法 2：界面激活

1. 打开简化版应用
2. 在"🤖 全自动套利"区块找到激活码输入框
3. 输入激活码
4. 点击"激活"按钮

---

## 🛠️ 管理员工具

### 生成激活码

```typescript
import { ActivationManager } from './src/activation.js';

// 生成 30 天测试激活码
const licenseKey = ActivationManager.generateLicenseKey(
  'user_123',        // 用户ID
  'John Doe',        // 用户名
  30                // 有效天数（天）
);

console.log('激活码:', licenseKey);
// 输出示例: A1B2-C3D4-E5F6-7890-ABCD-EF12-3456
```

### 命令行生成

```bash
# 开发者工具：生成测试激活码
npm run activate:generate

# 按提示输入：
# - 用户ID（默认: test_user）
# - 有效天数（默认: 30天）
```

### 激活码格式

```
XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
```

- 8 组，每组 4 个十六进制字符
- 总共 39 个字符（包含7个连字符）
- 示例：`A1B2-C3D4-E5F6-7890-ABCD-EF12-3456`

---

## 🔒 安全特性

### 1. 机器绑定

激活码绑定到当前机器的硬件ID：
- 操作系统类型
- CPU架构
- MAC地址

**防止**：激活码在多台机器上共享使用

### 2. 时间限制

每个激活码有固定的有效期：
- 默认：365天（1年）
- 可自定义：任意天数
- 过期后自动失效

**计算示例**：
```typescript
// 30天激活码
const license1 = generateLicenseKey(userId, userName, 30);

// 1年激活码
const license2 = generateLicenseKey(userId, userName, 365);

// 永久激活码（不推荐）
const license3 = generateLicenseKey(userId, userName, 365 * 10);
```

### 3. 功能限制

激活码仅授权以下功能：
- ✅ 站内套利（yes+no<1）
- ✅ 跨平台套利（价差套利）
- ✅ 自动套利机器人

**不限制**：
- 做市商模块（免费使用）
- 配置修改
- 查看市场数据

---

## 📊 用户激活流程

### 第 1 步：获取激活码

联系管理员提供以下信息：
- 用户ID（唯一标识符）
- 用户名（显示用）
- 需要的有效期（天数）

### 第 2 步：激活许可证

**选项 A - 命令行激活**：

```bash
npm run activate <激活码>
```

**选项 B - 交互式激活**：

```bash
npm run activate
# 按提示输入：
# 1. 输入激活码
# 2. 输入用户ID
# 3. 输入用户名
```

**选项 C - 界面激活**：

1. 打开桌面应用
2. 在套利区块找到激活输入框
3. 输入激活码
4. 点击"激活"按钮

### 第 3 步：验证激活

```bash
# 检查激活状态
npm run activate:check

# 输出示例：
# ✅ 已激活
#    用户: John Doe
#    到期日期: 2026-02-22
#    剩余天数: 345 天
```

---

## 🔧 常用命令

### 用户命令

```bash
npm run activate              # 交互式激活
npm run activate <key>        # 直接激活
npm run activate:check        # 检查状态
npm run activate:clear        # 清除激活（测试用）
```

### 管理员命令

```bash
npm run activate:generate     # 生成测试激活码
```

---

## 📝 激活信息文件

激活后会在项目根目录生成：

```
.arbitrage_activation.json
```

**文件内容**：
```json
{
  "activated": true,
  "licenseKey": "A1B2-C3D4-...",
  "userId": "user_123",
  "userName": "John Doe",
  "expireDate": 1706038661000,
  "machineId": "a1b2c3d4e5f6",
  "features": ["arbitrage", "auto_trading"],
  "activatedAt": 1705947200000
}
```

**注意**：
- 不要删除此文件
- 不要分享此文件
- 迁移项目时需要保留此文件

---

## ⚠️ 常见问题

### Q1: 激活码无效

**可能原因**：
1. 激活码格式错误
2. 激活码已过期
3. 激活码与机器不匹配

**解决方法**：
- 检查激活码是否完整（39字符）
- 确认激活码未过期
- 联系管理员重新生成

### Q2: 激活码在多台电脑上无法使用

**原因**：机器绑定保护

**解决方案**：
- 每台电脑需要单独的激活码
- 联系管理员为每台机器生成激活码

### Q3: 重装系统后激活失效

**原因**：机器ID可能改变

**解决方案**：
- 保存 `.arbitrage_activation.json` 文件
- 重装后恢复此文件
- 或联系管理员重新激活

### Q4: 做市商模块无法启动

**可能原因**：
- 检查是否误运行了套利命令

**解决方案**：
```bash
# 正确的做市商命令
npm run start:mm

# 套利命令
npm run start:arb
```

### Q5: 如何延长有效期

**联系管理员**：
- 提供当前激活信息
- 说明需要的延长时间
- 管理员会生成新的激活码

---

## 🎯 使用场景

### 场景 1：个人用户

```
用户 → 获取激活码 → 激活套利模块 → 开始套利
```

### 场景 2：团队使用

```
管理员 → 为每个成员生成激活码 → 分发激活码 → 成员各自激活
```

### 场景 3：商业化

```
开发者 → 生成激活码 → 销售给用户 → 用户激活使用 → 定期续费
```

---

## 🔐 安全最佳实践

### 对于用户

1. **保护激活码**
   - 不要分享激活码
   - 不要存储在云端
   - 定期备份 `.arbitrage_activation.json`

2. **监控有效期**
   - 定期运行 `npm run activate:check`
   - 提前 30 天联系续期

3. **机器绑定**
   - 激活后不要频繁更换硬件
   - 重装系统前备份激活文件

### 对于管理员

1. **生成激活码**
   - 记录每个激活码对应的用户
   - 设置合理的有效期
   - 定期审查使用情况

2. **撤销权限**
   - 如需撤销，删除用户的激活文件
   - 或生成新的机器ID

3. **防止滥用**
   - 限制每个用户的激活码数量
   - 监控异常使用模式

---

## 📈 扩展功能（可选）

### 批量生成激活码

```typescript
function generateBatchLicenses(userIds: string[], days: number): Map<string, string> {
  const licenses = new Map();

  for (const userId of userIds) {
    const licenseKey = ActivationManager.generateLicenseKey(
      userId,
      `User_${userId}`,
      days
    );
    licenses.set(userId, licenseKey);
  }

  return licenses;
}

// 使用示例
const userIds = ['user1', 'user2', 'user3'];
const licenses = generateBatchLicenses(userIds, 30);
console.log(licenses);
```

### 在线验证服务器（可选）

如果需要服务器端验证，可以：

1. 搭建简单的API服务器
2. 存储激活码数据库
3. 提供激活查询API

示例API：
```
POST /api/activate
POST /api/validate
GET /api/check
```

---

## 💡 提示

### 测试模式

如果需要测试，可以使用：

```bash
# 生成30天测试激活码
npm run activate:generate

# 测试完成后清除
npm run activate:clear
```

### 生产环境

生产环境建议：
1. 设置较长的有效期（365天）
2. 定期备份激活文件
3. 监控使用情况
4. 建立客服支持流程

---

## 📞 技术支持

如有问题，请提供：
- 用户ID
- 激活码（脱敏）
- 错误信息
- 机器环境信息

---

**版本**: 1.0.0
**更新时间**: 2025-02-22
**作者**: Claude Sonnet 4.5
