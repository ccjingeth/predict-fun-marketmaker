# Predict.fun Market Maker & Arbitrage Bot v2.0

自动做市商和套利机器人，用于 [Predict.fun](https://predict.fun/) - BNB Chain 预测市场协议。

## 🔗 邀请与联系

- 邀请链接：[https://predict.fun?ref=B0CE6](https://predict.fun?ref=B0CE6)
- 推特：@ccjing_eth

## 🎯 功能概述

本项目提供两种核心策略：

### 1️⃣ 做市商
- **目标**：赚取流动性积分
- **策略**：双边挂单，保持挂单状态
- **特点**：
  - 自动挂 bid 和 ask 单
  - 快接近单时自动撤单
  - 持续赚取积分奖励
  - 支持 liquidity activation 规则
  - 深度/VWAP 感知 + 动态价差
  - 盘口不平衡自适应与快速逼近撤单

### 2️⃣ 套利
- **目标**：发现并执行价差机会
- **三种策略**：
  1. **价值错配套利** - 市场价格偏离真实价值时买卖
  2. **站内套利** - Yes + No != 1 时套利
  3. **多结果套利** - 多 Outcome 总成本 < 1
  4. **跨平台套利** - 不同平台价差套利
  5. **依赖套利** - 逻辑约束 + OR-Tools 组合套利

## 📁 项目结构

```
predict-fun-market-maker/
├── src/
│   ├── api/
│   │   └── client.ts              # REST API 客户端
│   ├── arbitrage/             # 套利模块 🆕
│   │   ├── types.ts            # 套利类型定义
│   │   ├── value-detector.ts   # 价值错配检测
│   │   ├── intra-arb.ts        # 站内套利
│   │   ├── cross-arb.ts        # 跨平台套利
│   │   ├── dependency-arb.ts   # 依赖套利
│   │   ├── executor.ts         # 套利执行器
│   │   ├── monitor.ts          # 套利监控器
│   │   └── index.ts            # 导出
│   ├── market-maker/          # 做市商模块
│   │   ├── market-maker.ts     # 做市商逻辑
│   │   ├── market-selector.ts  # 市场选择
│   │   └── order-manager.ts    # 订单管理
│   ├── config.ts               # 配置管理
│   ├── types.ts                # 核心类型
│   ├── markets-config.ts       # 手动市场配置
│   ├── index.ts                # 做市商入口
│   └── arbitrage-bot.ts        # 套利机器人入口
├── .env.example               # 环境变量模板
├── markets-config.json        # 市场规则配置
└── README.md                  # 本文档
```

## 🚀 快速开始

### 安装依赖

```bash
cd predict-fun-market-maker
npm install
```

### 配置环境

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# API 配置
API_BASE_URL=https://api.predict.fun
API_KEY=your_api_key_here
JWT_TOKEN=your_jwt_token_here
RPC_URL=https://bsc-dataseed.binance.org

# 钱包配置
PRIVATE_KEY=your_private_key_here
PREDICT_ACCOUNT_ADDRESS=your_predict_account_address_here

# 做市商配置
SPREAD=0.02                    # 2% 价差
MIN_SPREAD=0.01                # 最小价差
MAX_SPREAD=0.08                # 最大价差
USE_VALUE_SIGNAL=false         # 是否启用价值信号偏置
VALUE_SIGNAL_WEIGHT=0.35       # 价值信号权重（0-1）
VALUE_CONFIDENCE_MIN=0.6       # 价值信号最低置信度
ORDER_SIZE=10                  # 每单 $10
MAX_SINGLE_ORDER_VALUE=50      # 单笔最大金额
MAX_POSITION=100               # 最大持仓 $100
INVENTORY_SKEW_FACTOR=0.15     # 库存偏置强度
CANCEL_THRESHOLD=0.05          # 价格波动 5% 撤单
REPRICE_THRESHOLD=0.003        # 0.3% 重新报价
MIN_ORDER_INTERVAL_MS=3000     # 每市场冷却时间
MAX_ORDERS_PER_MARKET=2        # 每市场挂单上限
MAX_DAILY_LOSS=200             # 当日亏损熔断
ANTI_FILL_BPS=0.002            # 防吃单阈值
NEAR_TOUCH_BPS=0.0015          # 接近吃单提前撤单
MM_TOUCH_BUFFER_BPS=0.0008     # 盘口保护缓冲（被动挂单，越大越不容易成交）
MM_FILL_RISK_SPREAD_BPS=0.0015 # 成交压力越高，自动放大价差
COOLDOWN_AFTER_CANCEL_MS=4000  # 撤单冷却
VOLATILITY_PAUSE_BPS=0.01      # 波动暂停阈值
VOLATILITY_LOOKBACK_MS=10000   # 波动检测窗口
PAUSE_AFTER_VOLATILITY_MS=8000 # 波动暂停时长
HEDGE_ON_FILL=false            # 成交后自动对冲
HEDGE_TRIGGER_SHARES=50        # 触发对冲的最小成交
HEDGE_MODE=FLATTEN             # FLATTEN/CROSS/NONE
HEDGE_MAX_SLIPPAGE_BPS=250     # 对冲最大滑点
REFRESH_INTERVAL=5000          # 5 秒刷新
ENABLE_TRADING=false           # 首次使用设为 false
AUTO_CONFIRM=false             # 自动确认（适合无人值守）

# 跨平台套利配置
CROSS_PLATFORM_ENABLED=false
CROSS_PLATFORM_MIN_PROFIT=0.01
CROSS_PLATFORM_MIN_SIMILARITY=0.78
CROSS_PLATFORM_AUTO_EXECUTE=false
CROSS_PLATFORM_REQUIRE_CONFIRM=true
CROSS_PLATFORM_TRANSFER_COST=0.002
CROSS_PLATFORM_SLIPPAGE_BPS=250
CROSS_PLATFORM_MAPPING_PATH=cross-platform-mapping.json
CROSS_PLATFORM_USE_MAPPING=true

# 依赖套利（OR-Tools）
DEPENDENCY_ARB_ENABLED=false
DEPENDENCY_CONSTRAINTS_PATH=dependency-constraints.json
DEPENDENCY_PYTHON_PATH=python3
DEPENDENCY_PYTHON_SCRIPT=scripts/dependency-arb.py
DEPENDENCY_MIN_PROFIT=0.02
DEPENDENCY_MAX_LEGS=6
DEPENDENCY_MAX_NOTIONAL=200
DEPENDENCY_MIN_DEPTH=1
DEPENDENCY_FEE_BPS=100
DEPENDENCY_SLIPPAGE_BPS=20
DEPENDENCY_MAX_ITER=12
DEPENDENCY_ORACLE_TIMEOUT_SEC=2
DEPENDENCY_TIMEOUT_MS=10000
DEPENDENCY_ALLOW_SELLS=true

# 多结果套利
MULTI_OUTCOME_ENABLED=true
MULTI_OUTCOME_MIN_OUTCOMES=3
MULTI_OUTCOME_MAX_SHARES=500

# 自动执行
ARB_AUTO_EXECUTE=false
ARB_AUTO_EXECUTE_VALUE=false
ARB_EXECUTE_TOP_N=1
ARB_EXECUTION_COOLDOWN_MS=60000
ARB_SCAN_INTERVAL_MS=10000
ARB_MAX_MARKETS=80
ARB_ORDERBOOK_CONCURRENCY=8
ARB_MARKETS_CACHE_MS=10000
ARB_WS_MAX_AGE_MS=10000
ARB_MAX_ERRORS=5
ARB_ERROR_WINDOW_MS=60000
ARB_PAUSE_ON_ERROR_MS=60000
ARB_WS_HEALTH_LOG_MS=0

开启 `ARB_AUTO_EXECUTE=true` 后，`npm run start:arb` 会持续监控并自动执行。
价值错配自动执行需单独开启：`ARB_AUTO_EXECUTE_VALUE=true`。

# 告警
ALERT_WEBHOOK_URL=
ALERT_MIN_INTERVAL_MS=60000

# Polymarket
POLYMARKET_GAMMA_URL=https://gamma-api.polymarket.com
POLYMARKET_CLOB_URL=https://clob.polymarket.com
POLYMARKET_WS_ENABLED=false
POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
POLYMARKET_WS_CUSTOM_FEATURE=false
POLYMARKET_CACHE_TTL_MS=60000
PREDICT_WS_ENABLED=false
PREDICT_WS_URL=wss://ws.predict.fun/ws
PREDICT_WS_API_KEY=
PREDICT_WS_TOPIC_KEY=token_id
POLYMARKET_PRIVATE_KEY=
POLYMARKET_API_KEY=
POLYMARKET_API_SECRET=
POLYMARKET_API_PASSPHRASE=

# Opinion
OPINION_OPENAPI_URL=https://proxy.opinion.trade:8443/openapi
OPINION_API_KEY=
OPINION_PRIVATE_KEY=
OPINION_CHAIN_ID=56
OPINION_HOST=https://proxy.opinion.trade:8443
OPINION_WS_ENABLED=false
OPINION_WS_URL=wss://ws.opinion.trade
OPINION_WS_HEARTBEAT_MS=30000
```

生成 JWT（私有接口必需）：

```bash
npm run auth:jwt
```

首次实盘前先做 approvals：

```bash
npm run setup:approvals
```

### 风控说明（推荐默认值）

- 自适应价差（带上下限）
- 库存偏置（仓位过大时只挂单单侧）
- 重新报价阈值 + 冷却时间，避免频繁撤单
- 每市场挂单上限
- 当日亏损熔断（`MAX_DAILY_LOSS`）
- 价值信号偏置（`USE_VALUE_SIGNAL`）
- 防吃单逻辑（`ANTI_FILL_BPS`/`NEAR_TOUCH_BPS`）
- 成交后对冲（`HEDGE_ON_FILL`/`HEDGE_MODE`）。`FLATTEN` 在 Predict 直接回补，`CROSS` 优先跨平台对冲，失败回退为 FLATTEN。

### 依赖套利（OR-Tools）

1. 安装 OR-Tools：

```bash
pip install ortools
```

2. 编辑 `dependency-constraints.json` 填写真实 token ID
3. 启用：

```env
DEPENDENCY_ARB_ENABLED=true
```

### 获取 API Key

加入 [Predict Discord](https://discord.gg/predictdotfun) → 打开 Support Ticket → 申请 API key

## 📖 使用指南

桌面端完整使用说明：`USAGE.md`
新手指南：`docs/BEGINNER_GUIDE.md`
字段说明：`docs/CONFIG_REFERENCE.md`
JSON 模板：`docs/JSON_TEMPLATES.md`

### 做市商模式

运行做市商机器人：

```bash
npm run start:mm
```

功能：
- 自动选择流动性最好的市场
- 挂双边限价单赚取积分
- 智能撤单避免成交
- 支持 liquidity points 规则

### 套利模式

运行套利机器人：

```bash
npm run start:arb
```

功能：
- 扫描价值错配机会
- 检测站内套利（Yes+No!=1）
- 通知可执行套利机会

## 💡 核心策略（围绕三类套利机会）

预测市场中存在诸多套利机会，参与者通常扮演两种角色：
角色 A：做市商/流动性提供者，在极端赔率时买入低估一方、卖出高估一方，待价格回归理性时平仓获利。
角色 B：方向中性套利者，在预测市场下注一侧，同时使用永续合约对冲方向风险，重点不是押注涨跌，而是利用赔率偏差锁定利润。

本脚本的核心策略围绕以下三类机会展开：
3.1 价值错配套利、3.2 站内套利、3.3 跨平台套利。
做市商模块会在极端赔率或价值信号明显时调整挂单，套利模块负责扫描并执行可行的价差机会。

### 3.1 寻找价值错配的机会

Predict.fun 的价格由用户供需决定，市场容易受情绪影响导致价格扭曲。
通过扫描大量事件并结合人工或模型判断，寻找市场价格与真实价值不匹配的机会，买入被低估的一方。
注意：市场可能不修正（情绪持续），或你的概率估计错，这并非无风险。

### 3.2 站内套利

基础思路：针对同一事件，Yes + No 合约价格合计应等于 1（多结果事件合计为 1）。
若合计 > 1（市场整体高估），做空高估一方锁定利润。
若合计 < 1（市场整体低估），买入所有结果，待结算时必然获利（总价值 ≥ 1）。
注意事项：交易手续费、滑点、成交限额与平台仓位限制都会侵蚀收益。

### 3.3 跨平台套利

同一事件在不同平台（如 Predict.fun 与 Polymarket/Kalshi）可能出现赔率差异。
若两平台事件描述一致，可两边同时下注锁定利润。

示例（简化）：
Polymarket：魔术 41%，马刺 60%
Kalshi：魔术 43%，马刺 57%
若分别买入魔术 41¢ 与马刺 57¢，总成本 98¢，无论哪队赢都结算 100¢，净收益 2¢。
注意事项：手续费、转账成本、平台结算差异与事件定义一致性都会影响实际收益。
补充：脚本内置跨平台套利检测器，但需要你自行接入 Polymarket/Kalshi 的行情数据源。
现在已接入 Polymarket 与 Opinion 的行情源。跨平台一键套利需要配置对应的 API Key/私钥。
若需要无人值守，一键套利可设置 `AUTO_CONFIRM=true` 且 `CROSS_PLATFORM_AUTO_EXECUTE=true`。
为了保证事件严格对应，建议维护 `cross-platform-mapping.json`，用 `predictMarketId` 显式映射外部平台的 Yes/No tokenId。

## ⚙️ Liquidity Points 配置

Predict.fun 的每个市场有特定的流动性积分激活规则：

```
Activate Points
Min. shares: 100
Max spread ±6¢ | Current spread 1¢
```

### 配置方法

编辑 `markets-config.json`：

```json
{
  "markets": {
    "your_token_id_here": {
      "liquidity_activation": {
        "active": true,
        "min_shares": 100,
        "max_spread_cents": 6,
        "max_spread": 0.06
      }
    }
  },
  "global_defaults": {
    "min_shares": 100,
    "max_spread_cents": 6,
    "max_spread": 0.06
  }
}
```

### 规则说明

- **Min shares**: 最小股数要求（如 100 shares）
- **Max spread**: 最大允许价差（如 ±6¢ = 0.06）
- **双边挂单**: 需要同时有 bid 和 ask 订单
- **接近市价**: 越接近市价 → 越多积分

## 🔧 命令

```bash
# 桌面端控制台（Electron）
cd desktop-app
npm install
npm run dev

# 打包桌面端（需要先 build 根项目）
npm run pack

# 做市商模式
npm run start:mm

# 套利模式
npm run start:arb

# 开发模式
npm run dev

# 编译
npm run build

# 测试 API 连接
npm test

# 一键检查 API Key + 行情接口
npm run check:api

# 生成 JWT
npm run auth:jwt

# 初始化 approvals
npm run setup:approvals
```

说明：桌面端控制台会直接读取项目根目录的 `.env` 并调用 `npx tsx` 启动机器人，请确保根目录依赖已安装。打包后会使用系统 `node` 运行编译后的 `dist`，如需指定 Node 路径可设置 `NODE_BINARY`。

跨平台一键套利额外依赖：
- Polymarket: 需要配置 `POLYMARKET_PRIVATE_KEY`，可自动派生 API Key 或手动填入 `POLYMARKET_API_*`
- Opinion: 需要安装 `opinion_clob_sdk`（Python），并配置 `OPINION_API_KEY` 与 `OPINION_PRIVATE_KEY`

## 📊 输出示例

### 做市商输出

```
📝 Placing orders for Lakers vs Knicks... [✨ Points YES!]
   Bid: 0.4700 | Ask: 0.5300
   Bid Size: 212 shares ($10.00)
   Ask Size: 188 shares ($10.00)
   Max Spread for Points: ±6¢
   Min Shares for Points: 100
```

### 套利输出

**价值错配**：
```
🚨 NEW ARBITRAGE OPPORTUNITY!
Type: Value Mismatch
Market: Lakers will win the game...
Edge: 8.50%
Action: BUY_YES
Expected Return: 8.50%
Risk Level: MEDIUM
```

**站内套利**：
```
💰 In-Platform Arbitrage Opportunities:
#1 Trump wins election...
   Yes Price: 45.00¢
   No Price: 40.00¢
   Yes + No: 0.8500
   Type: UNDER_ONE (deviates by 15.00%)
   Action: BUY_BOTH
   Net Profit (after fees): 14.00%
```

## ⚠️ 风险提示

所有套利策略 **非无风险**，受以下因素影响：

1. **市场情绪** - 价格可能不修正或继续偏离
2. **交易费用** - 可能侵蚀套利利润
3. **流动性限制** - 大额订单可能遭遇滑点
4. **成交限制** - 平台可能有仓位限制

## 📚 开发路线图

- [x] 做市商基础功能
- [x] Liquidity Points 支持
- [x] 套利检测模块
- [ ] SDK 集成（实际交易执行）
- [ ] 实时对冲功能
- [ ] 回测和性能分析
- [ ] Web UI 界面

## 📄 相关文档

- [Predict API 文档](https://dev.predict.fun/)
- [Liquidity Rules 配置指南](./LIQUIDITY_RULES.md)
- [SDK 集成指南](./SDK_INTEGRATION.md)

## 📄 Sources

- [Predict API Developer Documentation](https://dev.predict.fun/)
- [How to create or cancel orders](https://dev.predict.fun/how-to-create-or-cancel-orders-679306m0)
- [Get the orderbook for a market](https://dev.predict.fun/get-the-orderbook-for-a-market-25326908e0)
- [NPM SDK Package](https://www.npmjs.com/package/@predictdotfun/sdk)
