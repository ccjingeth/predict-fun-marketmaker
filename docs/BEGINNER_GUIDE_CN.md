# 🚀 Predict.fun + Probable.markets 小白配置模板

> **小白友好设计** - 只需填写3个必填项，其余都是自动优化！

---

## 📝 快速开始（3步配置）

### 第1步：获取API密钥

1. **Predict.fun API Key**
   - 加入 Discord: https://discord.gg/predictdotfun
   - 创建工单申请 API Key
   - 复制 API Key

2. **钱包私钥**
   - 创建新的钱包地址（不要用主钱包！）
   - 只转入少量资金测试（10-50 USDT）
   - 复制私钥（格式：0x...）

### 第2步：复制配置模板

```bash
# ============ 必填配置（这3个必须填写）============
API_KEY=你的Predict_API_Key_这里
PRIVATE_KEY=你的钱包私钥_0x开头
ENABLE_TRADING=false              # 先用模拟模式测试！

# ============ 自动优化配置（不用改）============
# 做市商配置
MM_VENUE=predict                 # 默认Predict.fun
ORDER_SIZE=110                   # 自动适配积分规则
SPREAD=0.055                     # 5.5¢ (积分限制6¢)
MIN_SPREAD=0.05
MAX_SPREAD=0.08

# WebSocket实时数据（推荐开启）
PREDICT_WS_ENABLED=true
PREDICT_WS_URL=wss://stream.predict.fun

# 风险控制
MAX_POSITION=100                 # 最大持仓
MAX_DAILY_LOSS=50               # 每日最大亏损

# ============ 高级配置（小白不用改）============
# 日志级别
LOG_LEVEL=info

# 做市参数
MM_LAYERS=3                      # 挂3层订单
MM_LAYER_STEP_BPS=30             # 层间距
MM_QUOTE_INTERVAL_MS=5000         # 报价更新间隔
```

### 第3步：保存并启动

1. 将上面的配置复制到控制台的"环境变量"编辑器
2. 点击"保存配置"
3. 点击"启动做市商"
4. 观察日志，确认看到订单创建成功

---

## 🎯 不同场景的预设配置

### 场景1：纯积分模式（Predict.fun积分优化）

```bash
# 专注于获取积分，牺牲一些利润

API_KEY=你的API_Key
PRIVATE_KEY=你的私钥
ENABLE_TRADING=false              # 先模拟测试！

# 积分优化配置
MM_VENUE=predict
ORDER_SIZE=110                   # >100股的min_shares
SPREAD=0.055                     # 5.5¢ <6¢的max_spread
MIN_SPREAD=0.05
MAX_SPREAD=0.06                   # 严格限制

# 实时数据（重要！）
PREDICT_WS_ENABLED=true
```

**预期收益**：稳定获取积分，利润率较低但非常稳定

---

### 场景2：纯利润模式（Probable.markets利润最大化）

```bash
# 专注于利润，没有积分限制

PROBABLE_PRIVATE_KEY=你的私钥
ENABLE_TRADING=false              # 先模拟测试！

# 平台选择
MM_VENUE=probable

# 激进配置（0%手续费优势）
ORDER_SIZE=100
SPREAD=0.01                      # 1% 超窄价差
MIN_SPREAD=0.005
MAX_SPREAD=0.03

# 更多层数，更多成交
MM_LAYERS=5
MM_LAYER_STEP_BPS=20             # 层间距更窄
MM_QUOTE_INTERVAL_MS=2000         # 更快更新

# 实时数据
PROBABLE_WS_ENABLED=true
```

**预期收益**：高利润率，更多成交，但没有积分

---

### 场景3：混合模式（70%积分 + 30%利润）

**步骤**：
1. 启动两个做市商实例：
   - 实例1（积分）：使用场景1配置
   - 实例2（利润）：使用场景2配置

2. 资金分配：
   - 70%资金在Predict.fun获取积分
   - 30%资金在Probable.markets获取利润

---

## 🎓 小白常见问题

### Q1: 模拟模式（ENABLE_TRADING=false）会赚钱吗？

**A**: 不会！模拟模式只测试策略，不会真实交易。看到订单只是测试，不会实际成交。

**如何切换到实盘**：
1. 确认测试通过
2. 填写 JWT_TOKEN（实盘需要）
3. 设置 `ENABLE_TRADING=true`
4. 设置 `AUTO_CONFIRM=true`（可选，自动确认交易）
5. 重新启动

---

### Q2: 为什么我的订单没有成交？

**可能原因**：
1. **还在模拟模式** - 检查 `ENABLE_TRADING=false`
2. **价差太大** - 降低 `SPREAD`
3. **订单大小太小** - 增加 `ORDER_SIZE`
4. **余额不足** - 检查钱包余额
5. **市场流动性差** - 等待或换其他市场

---

### Q3: min_shares 是什么？为什么重要？

**A**: `min_shares` 是积分系统的最小订单要求。
- Predict.fun 要求每个订单≥100股才能获得积分
- 如果订单<100股，提供流动性但**没有积分**

**如何优化**：
- 设置 `ORDER_SIZE=110`（>100）
- 或 `ORDER_SIZE=150`（更安全）

---

### Q4: max_spread 是什么？为什么重要？

**A**: `max_spread` 是积分系统的最大价差限制。
- Predict.fun 要求价差≤6¢才能获得积分
- 如果价差>6¢，提供流动性但**没有积分**

**如何优化**：
- 设置 `SPREAD=0.055`（5.5¢ < 6¢）
- 或 `SPREAD=0.05`（5.0¢，更安全）

---

### Q5: 如何查看我是否在获得积分？

**方法1**：在控制台查看"积分效率"指标
- 绿色高百分比 = 积分获取效率高
- 红色低百分比 = 需要调整订单参数

**方法2**：查看日志中的积分提示
```
✅ 订单符合积分规则
❌ 订单大小105 < min_shares100  <-- 这里的提示
```

---

### Q6: 两个平台手续费是多少？

| 平台 | 手续费 | 影响 |
|------|--------|------|
| **Predict.fun** | 2% | 每笔交易扣除2% |
| **Probable.markets** | 0% | 无手续费！ |

**策略建议**：
- Predict.fun：用较宽价差（2%手续费需要补偿）
- Probable.markets：用较窄价差（无手续费，可激进）

---

### Q7: 资金分配建议？

**新手推荐**：
1. **测试阶段**：每个平台10-50 USDT
2. **小额运行**：每个平台100-200 USDT
3. **稳定后**：每个平台500-1000 USDT

**风险控制**：
- 设置 `MAX_POSITION=100`（最大持仓）
- 设置 `MAX_DAILY_LOSS=50`（每日最大亏损）
- 监控PnL，亏损立即停止

---

## ⚠️ 重要安全提示

### ✅ DO（推荐做法）

1. **创建专用钱包**
   - 不要用主钱包！
   - 只转入测试资金

2. **先用模拟模式**
   - ENABLE_TRADING=false
   - 观察几天，确认稳定

3. **从小额开始**
   - ORDER_SIZE=10 或 20
   - 确认稳定后再增加

4. **设置止损**
   - MAX_DAILY_LOSS=50
   - MAX_POSITION=100

5. **定期检查**
   - 查看日志
   - 监控PnL
   - 检查积分状态

### ❌ DON'T（不要做）

1. **不要用主钱包**
   - 风险巨大！

2. **不要一开始就大额**
   - 先测试再增加

3. **不要忽略警告**
   - 红色警告要重视

4. **不要设置过大价差**
   - 积分规则：max_spread=6¢
   - 建议设置5-5.5¢

5. **不要设置过小订单**
   - 积分规则：min_shares=100
   - 建议设置110-150

---

## 🎯 推荐配置（复制即用）

### 极简配置（最小化）

```bash
# 只需填写这3个
API_KEY=你的API_Key
PRIVATE_KEY=你的私钥
ENABLE_TRADING=false

# 其他自动优化
ORDER_SIZE=110
SPREAD=0.055
```

### 稳健配置（平衡风险和收益）

```bash
API_KEY=你的API_Key
PRIVATE_KEY=你的私钥
ENABLE_TRADING=false

# 做市参数
ORDER_SIZE=120
SPREAD=0.055
MIN_SPREAD=0.05
MAX_SPREAD=0.08

# 风控
MAX_POSITION=100
MAX_DAILY_LOSS=50

# 实时数据
PREDICT_WS_ENABLED=true
```

### 激进配置（追求利润）

```bash
API_KEY=你的API_Key
PRIVATE_KEY=你的私钥
ENABLE_TRADING=false

# 更窄价差，更多成交
ORDER_SIZE=150
SPREAD=0.045
MIN_SPREAD=0.04
MM_LAYERS=5

# 更快更新
MM_QUOTE_INTERVAL_MS=3000
```

---

## 📞 需要帮助？

- **Discord**: https://discord.gg/predictdotfun
- **查看日志**：控制台实时显示所有操作
- **智能建议**：系统会自动给出优化建议
- **一键应用**：点击"应用最佳实践"按钮

---

## 🎉 总结

**记住3个黄金法则**：
1. ✅ 先模拟，后实盘
2. ✅ 先小额，后大额
3. ✅ 盯控积分，及时调整

**积分优化关键**：
- 订单大小 > 100（min_shares）
- 价差 < 6¢（max_spread）
- 开启 WebSocket 实时数据

**祝你交易顺利！** 🚀
