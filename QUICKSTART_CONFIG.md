# Predict.fun 做市商 & 套利机器人 - 快速配置指南

## 🔴 必填配置（最小化运行）

### 1. API 密钥配置
```bash
# Predict.fun API Key（必需）
# 获取方式：加入 Discord (https://discord.gg/predictdotfun) 创建工单申请
API_KEY=your_api_key_here

# 钱包私钥（必需）
# 注意：私钥风险自负，建议使用测试账户
PRIVATE_KEY=0x1234567890abcdef...

# JWT Token（实盘交易必需）
# 预测市场需要进行身份验证获取 JWT
JWT_TOKEN=your_jwt_token_here
```

### 2. 基础交易配置
```bash
# 交易模式：false=模拟测试, true=实盘交易
ENABLE_TRADING=false

# 自动确认订单（建议先设为 false）
AUTO_CONFIRM=false

# 订单大小（USDT）
ORDER_SIZE=10

# 价差百分比（0.01 = 1%）
SPREAD=0.02
```

---

## ⚙️ 完整配置模版

### 核心配置
```bash
# ==================== API 配置 ====================
API_BASE_URL=https://api.predict.fun
RPC_URL=https://eth-sepolia.public.blastapi.io

# ==================== 钱包配置 ====================
PRIVATE_KEY=your_private_key_here
PREDICT_ACCOUNT_ADDRESS=your_wallet_address

# ==================== 认证配置 ====================
API_KEY=your_api_key_here          # ⭐ 必填
JWT_TOKEN=your_jwt_token_here      # 实盘必需

# ==================== 交易模式 ====================
ENABLE_TRADING=false               # false=模拟, true=实盘
AUTO_CONFIRM=false                 # 自动确认订单
```

### 做市商配置
```bash
# ==================== 做市商基础 ====================
MM_VENUE=predict                   # 做市平台: predict | probable
MM_REQUIRE_JWT=true                # 是否需要 JWT

# 订单配置
ORDER_SIZE=10                      # 单个订单大小（USDT）
MAX_POSITION=100                   # 最大持仓（USDT）
SPREAD=0.02                        # 价差 2%
MIN_SPREAD=0.01                    # 最小价差 1%
MAX_SPREAD=0.08                    # 最大价差 8%

# 订单数量
MAX_ORDERS_PER_MARKET=2            # 每个市场最大订单数
```

### 套利配置
```bash
# ==================== 套利机器人 ====================
ARB_AUTO_EXECUTE=false             # 自动执行套利（建议先手动）
ARB_WS_REALTIME=true               # 使用 WebSocket 实时扫描
CROSS_PLATFORM_ENABLED=false       # 跨平台套利（高级功能）
```

### WebSocket 配置（推荐）
```bash
# ==================== 实时行情 ====================
PREDICT_WS_ENABLED=true            # ⭐ 推荐：使用 WebSocket
POLYMARKET_WS_ENABLED=false
OPINION_WS_ENABLED=false
PROBABLE_WS_ENABLED=false
```

---

## 📋 配置检查清单

使用前请确认：

- [ ] `API_KEY` 已填写
- [ ] `PRIVATE_KEY` 已填写
- [ ] `ENABLE_TRADING=false` （首次使用）
- [ ] `AUTO_CONFIRM=false` （首次使用）
- [ ] `JWT_TOKEN` 已填写（如需实盘）
- [ ] `ORDER_SIZE` 设置合理（建议从小额开始）

---

## 🚀 启动步骤

1. **配置最小参数**
   ```bash
   API_KEY=your_key
   PRIVATE_KEY=your_key
   ENABLE_TRADING=false
   ORDER_SIZE=10
   SPREAD=0.02
   PREDICT_WS_ENABLED=true
   ```

2. **启动模拟测试**
   - 在控制台点击"启动做市商"
   - 观察日志输出，确认订单正常创建

3. **确认无误后启用实盘**
   ```bash
   ENABLE_TRADING=true
   AUTO_CONFIRM=true
   JWT_TOKEN=your_jwt
   ```

---

## ⚠️ 重要提醒

### 风险控制
- 首次使用务必使用**模拟模式**（`ENABLE_TRADING=false`）
- 建议从小额订单开始（`ORDER_SIZE=5`）
- 设置最大持仓限制（`MAX_POSITION=100`）
- 设置每日最大亏损（`MAX_DAILY_LOSS=200`）

### 安全建议
- 不要使用主钱包私钥
- 妥善保管 .env 文件
- 定期检查交易日志
- 监控账户余额变化

---

## 📞 获取帮助

- **Discord**: https://discord.gg/predictdotfun
- **API Key 申请**: 在 Discord 创建工单
- **文档**: 查看项目 README.md

---

## 🔧 高级配置（可选）

### 自适应参数
```bash
MM_ADAPTIVE_PARAMS=true           # 启用自适应做市
MM_SPREAD_VOL_WEIGHT=1.2          # 波动率权重
MM_DEPTH_EMA_ALPHA=0.2            # 深度 EMA 平滑系数
```

### 库存管理
```bash
INVENTORY_SKEW_FACTOR=0.15         # 库存偏离因子
MM_ACCOUNT_EQUITY_USD=1000        # 账户权益（用于动态计算）
```

### 风控参数
```bash
CANCEL_THRESHOLD=0.05             # 5% 价格变动时取消订单
REPRICE_THRESHOLD=0.003           # 0.3% 价格变动时重新报价
MAX_DAILY_LOSS=200                # 每日最大亏损（USDT）
```

### WebSocket 配置
```bash
PREDICT_WS_ENABLED=true           # 推荐：开启 Predict WS
ARB_WS_REALTIME=true              # 套利实时扫描
CROSS_PLATFORM_WS_REALTIME=true   # 跨平台实时扫描
```
