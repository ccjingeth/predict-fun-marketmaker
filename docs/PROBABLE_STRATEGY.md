# Probable.markets 平台优化策略

## 平台特点

1. **0% 手续费** - 相比 Predict.fun 的2%手续费，可以大幅降低价差
2. **无积分系统** - 不需要遵守积分规则（min_shares, max_spread）
3. **高流动性** - 订单簿深度更好

## 优化策略

### 1. 价差优化

**Predict.fun**: 2% 价差
**Probable**: 1% 价差

```bash
# Probable 平台配置
SPREAD=0.01              # 1% 价差（vs Predict.fun 2%）
MIN_SPREAD=0.005         # 0.5% 最小价差
MAX_SPREAD=0.03          # 3% 最大价差
```

### 2. 订单频率优化

**优势**：无手续费，可以更频繁地调整订单

```bash
# 订单更新频率
MM_QUOTE_INTERVAL_MS=2000        # 2秒（vs Predict.fun 5秒）
MM_REQUOTE_INTERVAL_MS=3000      # 3秒重新报价
```

### 3. 订单数量优化

**优势**：流动性好，可以挂更多层

```bash
# 订单层数
MM_LAYERS=5                      # 5层（vs 默认3层）
```

### 4. 订单大小优化

**优势**：无积分限制，可以使用更小的订单

```bash
# 订单大小
ORDER_SIZE=10                    # 基础订单大小
MM_ORDER_SIZE_USD=10
```

## 配置示例

### .env 配置

```bash
# Probable.markets 专用配置
MM_VENUE=probable
ENABLE_TRADING=true

# 优势：0%手续费
SPREAD=0.01                      # 1% vs 2% (Predict.fun)
MIN_SPREAD=0.005                 # 0.5% vs 1% (Predict.fun)
MAX_SPREAD=0.03                  # 3% vs 8% (Predict.fun)

# 优势：无积分限制
# 不需要 MM_POINTS_MIN_SHARES
# 不需要 MM_POINTS_MAX_SPREAD

# 优势：高流动性
MM_LAYERS=5                      # 更多层数
MM_LAYER_STEP_BPS=20             # 更窄层间距

# 优势：可频繁调整
MM_QUOTE_INTERVAL_MS=2000        # 更快更新
MM_REQUOTE_INTERVAL_MS=3000
```

### 完整配置模板

```bash
# ========== Probable.markets 优化配置 ==========

# 平台选择
MM_VENUE=probable
PROBABLE_PRIVATE_KEY=your_private_key_here
PROBABLE_MARKET_API_URL=https://market-api.probable.markets
PROBABLE-trade-api_URL=https://trade-api.probable.markets

# 交易配置
ENABLE_TRADING=true
AUTO_CONFIRM=false
ORDER_SIZE=10

# ========== 价差优化（利用0%手续费）==========
SPREAD=0.01                      # 1%（Predict.fun: 2%）
MIN_SPREAD=0.005                 # 0.5%（Predict.fun: 1%）
MAX_SPREAD=0.03                  # 3%（Predict.fun: 8%）

# ========== 订单层数优化（利用高流动性）==========
MM_LAYERS=5                      # 5层（默认: 3层）
MM_LAYER_STEP_BPS=20             # 0.2% 层间距

# ========== 更新频率优化（无手续费成本）==========
MM_QUOTE_INTERVAL_MS=2000        # 2秒更新（默认: 5秒）
MM_REQUOTE_INTERVAL_MS=3000      # 3秒重报价

# ========== WebSocket 实时数据 ==========
PROBABLE_WS_ENABLED=true
PROBABLE_WS_URL=wss://stream.probable.markets

# ========== 风控参数 ==========
MAX_POSITION=100                 # 最大持仓
MAX_DAILY_LOSS=200              # 每日最大亏损
```

## 预期收益

### 收益提升

1. **价差收益**: 1% vs 2% = 更窄价差，更多成交机会
2. **手续费节省**: 0% vs 2% = 每笔交易节省2%利润
3. **成交量提升**: 更多层数 + 更频繁更新 = 更多成交

### 风险降低

1. **无积分风险**: 不需要担心积分规则
2. **更灵活调整**: 可以快速响应市场变化
3. **更小单笔风险**: 可以使用更小订单测试

## 监控指标

```bash
# 关键指标
- Probable收益率 vs Predict.fun收益率
- 订单成交率
- 价差利用率
- 每日PnL
```

## 最佳实践

1. **从小额开始**: ORDER_SIZE=5, 测试策略
2. **逐步增加**: 确认稳定后增加订单大小
3. **监控对比**: 同时运行 Predict.fun 和 Probable，对比收益
4. **及时调整**: 根据市场情况调整 SPREAD 和 MM_LAYERS
