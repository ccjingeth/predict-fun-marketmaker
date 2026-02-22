# 🤖 全自动套利机器人使用指南

## 🎯 功能特点

这是一个**全自动**的跨平台套利机器人，可以：

- ✅ **实时监控**多个预测市场平台
- ✅ **自动发现**套利机会（价格差异）
- ✅ **自动执行**套利交易
- ✅ **余额管理**和风险控制
- ✅ **模拟模式**测试

## 🚀 快速开始

### 1. 配置平台凭证

复制配置模板：

```bash
cp .env.auto-arbitrage .env
```

编辑 `.env` 文件，填入您的 API 凭证：

```bash
# 执行模式（建议先用 false 测试）
AUTO_ARBITRAGE_DRY_RUN=false

# 套利参数
AUTO_ARBITRAGE_MIN_PROFIT=0.02  # 最小利润率 2%
AUTO_ARBITRAGE_MAX_SIZE=100     # 单笔最大 $100
AUTO_ARBITRAGE_RESERVE=0.3      # 保留 30% 资金

# Predict.Fun 凭证
PREDICT_FUN_API_KEY=你的密钥
PREDICT_FUN_API_SECRET=你的密钥
PREDICT_FUN_ENABLED=true

# Polymarket 凭证（可选）
POLYMARKET_API_KEY=你的密钥
POLYMARKET_ENABLED=false
```

### 2. 启动机器人

```bash
npm run start:auto-arbitrage
```

### 3. 观察运行

机器人会自动：

1. 🔍 每 5 秒扫描所有平台
2. 💰 检查每个平台的余额
3. ✨ 发现套利机会并显示
4. 🚀 自动执行交易
5. 📊 显示统计信息

## 📊 输出示例

```
=======================================================
🤖 多平台全自动套利机器人
=======================================================
模式: 🧪 模拟模式
最小利润率: 2.0%
最大交易量: $100
保留资金: 30%
扫描间隔: 5秒
=======================================================

✅ 已验证平台凭证:
   - predict_fun
   - polymarket

💰 当前余额:
   predict_fun: $950.00 (可用) + $0.00 (锁定) = $950.00
   polymarket: $500.00 (可用) + $0.00 (锁定) = $500.00
   总计: $1450.00

✅ 机器人已启动！

🔍 扫描 #1 [14:30:25]
   📊 活跃市场: 150

   ✨ 发现 2 个套利机会:

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   市场: 特朗普会在2024年赢得美国总统大选吗？
   predict_fun: BUY @ $0.650
   polymarket: SELL @ $0.670
   💰 利润率: 3.08%
   💵 预计利润: $2.95
   📊 可交易量: $50 - $95

   🚀 执行套利 [trade-1234567890]
      📝 predict_fun: BUY 95 股 @ $0.650
      📝 polymarket: SELL 95 股 @ $0.670
      ✅ 套利执行成功！
      📈 利润: $2.95

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## ⚙️ 配置说明

### 执行模式

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `AUTO_ARBITRAGE_DRY_RUN` | false=实盘，true=模拟 | `true` |

**建议**：先用 `true` 测试，确认无误后再改为 `false`

### 套利参数

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| `AUTO_ARBITRAGE_MIN_PROFIT` | 最小利润率 | `0.02` (2%) |
| `AUTO_ARBITRAGE_MAX_SIZE` | 单笔最大交易 | `100` ($100) |
| `AUTO_ARBITRAGE_RESERVE` | 保留资金比例 | `0.3` (30%) |
| `AUTO_ARBITRAGE_MAX_CONCURRENT` | 最大并发数 | `3` |

### 扫描设置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `AUTO_ARBITRAGE_SCAN_INTERVAL` | 扫描间隔（毫秒） | `5000` (5秒) |
| `AUTO_ARBITRAGE_BALANCE_INTERVAL` | 余额检查间隔（毫秒） | `60000` (60秒) |

## 🔒 安全建议

1. **从小金额开始**
   ```bash
   AUTO_ARBITRAGE_MAX_SIZE=10  # 先用 $10 测试
   ```

2. **保留足够的资金**
   ```bash
   AUTO_ARBITRAGE_RESERVE=0.5  # 保留 50%
   ```

3. **设置合理的利润阈值**
   ```bash
   AUTO_ARBITRAGE_MIN_PROFIT=0.03  # 至少 3% 利润
   ```

4. **先用模拟模式测试**
   ```bash
   AUTO_ARBITRAGE_DRY_RUN=true
   ```

## 📈 统计信息

机器人会定期显示：

- 运行时间
- 总扫描次数
- 发现机会数
- 执行交易数（成功/失败）
- 总利润
- 当前余额

## 🛑 停止机器人

按 `Ctrl + C` 停止机器人，它会：
1. 停止扫描
2. 显示最终统计
3. 退出程序

## 🔧 故障排除

### 问题 1：无法连接平台

**错误**：`获取 xxx 平台余额失败`

**解决**：
1. 检查 API 凭证是否正确
2. 确认网络连接正常
3. 查看平台 API 是否正常运行

### 问题 2：没有发现套利机会

**可能原因**：
1. 市场价差太小
2. 最小利润率设置太高

**解决**：
```bash
# 降低最小利润率
AUTO_ARBITRAGE_MIN_PROFIT=0.015  # 改为 1.5%
```

### 问题 3：交易失败

**错误**：`执行失败: 余额不足`

**解决**：
```bash
# 降低单笔交易量
AUTO_ARBITRAGE_MAX_SIZE=50

# 或增加保留资金
AUTO_ARBITRAGE_RESERVE=0.5
```

## 📚 高级用法

### 自定义启动

创建自定义脚本：

```typescript
import { MultiPlatformArbitrageBot } from './src/arbitrage/multi-platform-bot.js';

const bot = new MultiPlatformArbitrageBot({
  credentials: [
    {
      name: 'predict_fun',
      apiKey: 'your_key',
      apiSecret: 'your_secret',
      enabled: true,
    },
  ],
  enabled: true,
  dryRun: true,
  minProfitRate: 0.025,
  maxTradeSize: 200,
  reserveRatio: 0.4,
  maxConcurrentTrades: 5,
  scanInterval: 3000,
  checkBalanceInterval: 30000,
});

await bot.start();
```

### 程序化使用

```typescript
// 获取统计
const stats = bot.getStats();
console.log('总利润:', stats.totalProfit);

// 手动停止
bot.stop();

// 更新配置
bot.updateConfig({ minProfitRate: 0.03 });
```

## ⚠️ 风险提示

1. **市场风险**：套利机会可能瞬间消失
2. **执行风险**：网络延迟可能导致失败
3. **资金风险**：建议从小金额开始
4. **API 限制**：注意平台的速率限制

## 📞 支持

如有问题，请查看：
- GitHub Issues
- 项目文档
- 社区论坛

**祝交易顺利！** 🎉💰
