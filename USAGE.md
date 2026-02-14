# 使用说明（桌面端）

## 下载安装

1. 打开 GitHub Releases 页面，下载 macOS 版本：
   - `Predict.fun Console-0.1.0-arm64.dmg`
2. 双击 `.dmg`，拖动到 Applications。
3. 首次启动如果被系统拦截：右键应用 → 打开。

提示：打包版依赖系统已安装 Node.js（建议 18+）。如 `node` 不在默认路径，可设置环境变量 `NODE_BINARY` 指向 Node 可执行文件。

## 配置文件位置

打包版会在用户目录创建配置：
- macOS：`~/Library/Application Support/Predict.fun Console/bot/.env`
- macOS 映射文件：`~/Library/Application Support/Predict.fun Console/bot/cross-platform-mapping.json`
- macOS 依赖套利约束：`~/Library/Application Support/Predict.fun Console/bot/dependency-constraints.json`

桌面端 UI 内可直接编辑 `.env`。

## 必要配置

最少需要设置：
- `API_KEY`
- `PRIVATE_KEY`
- `JWT_TOKEN`（实盘必需）
- `ENABLE_TRADING`（实盘设为 `true`）

无人值守自动执行：
- `AUTO_CONFIRM=true`

跨平台一键套利：
- `CROSS_PLATFORM_ENABLED=true`
- `CROSS_PLATFORM_AUTO_EXECUTE=true`
- 配置 Polymarket / Opinion 的密钥
- 可选：`CROSS_PLATFORM_ADAPTIVE_SIZE=true`（按深度缩小下单量）
- 可选：`CROSS_PLATFORM_DEPTH_USAGE=0.5`（使用深度的最大比例）
- 可选：`CROSS_PLATFORM_MAX_NOTIONAL=200`（名义金额上限）
- 可选：`CROSS_PLATFORM_RECHECK_MS=200`（预检二次确认）
- 可选：`CROSS_PLATFORM_STABILITY_SAMPLES=3`（稳定性采样）
- 可选：`CROSS_PLATFORM_POST_TRADE_DRIFT_BPS=80`（成交后漂移降级）
- 可选：`CROSS_PLATFORM_AUTO_TUNE=true`（执行质量自动调参）
- 可选：`CROSS_PLATFORM_CHUNK_MAX_SHARES=20`（分块执行）
- 可选：`CROSS_PLATFORM_LEG_DRIFT_SPREAD_BPS=80`（腿间漂移差阈值）
- 可选：`CROSS_PLATFORM_AUTO_BLOCKLIST=true`（自动黑名单）
- 可选：`CROSS_PLATFORM_CHUNK_AUTO_TUNE=true`（分块大小自动调节）
- 可选：`CROSS_PLATFORM_GLOBAL_COOLDOWN_MS=120000`（全局降级冷却）
- 可选：`CROSS_PLATFORM_CHUNK_DELAY_AUTO_TUNE=true`（分块延迟自动调节）
- 可选：`CROSS_PLATFORM_ORDER_TYPE=FOK`（也可 FAK/GTC）
- 可选：`CROSS_PLATFORM_VOLATILITY_BPS=80`（短时波动过滤）
- 可选：`CROSS_PLATFORM_METRICS_LOG_MS=10000`（执行指标日志）

实时行情（Polymarket WebSocket）：
- `POLYMARKET_WS_ENABLED=true`
- `POLYMARKET_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market`

实时行情（Predict WebSocket）：
- `PREDICT_WS_ENABLED=true`
- `PREDICT_WS_URL=wss://ws.predict.fun/ws`
- `PREDICT_WS_TOPIC_KEY=token_id`（如不生效可改成 `condition_id`）

实时行情（Opinion WebSocket）：
- `OPINION_WS_ENABLED=true`
- `OPINION_WS_URL=wss://ws.opinion.trade`
- `OPINION_WS_HEARTBEAT_MS=30000`

依赖套利（OR-Tools）：
- `DEPENDENCY_ARB_ENABLED=true`
- `DEPENDENCY_CONSTRAINTS_PATH=dependency-constraints.json`
- 安装 OR-Tools：`pip install ortools`

多结果套利：
- `MULTI_OUTCOME_ENABLED=true`
- `MULTI_OUTCOME_MIN_OUTCOMES=3`

自动执行：
- `ARB_AUTO_EXECUTE=true`
- `ARB_EXECUTE_TOP_N=1`
价值错配自动执行：
- `ARB_AUTO_EXECUTE_VALUE=true`
扫描频率：
- `ARB_SCAN_INTERVAL_MS=10000`
扫描市场数：
- `ARB_MAX_MARKETS=80`
并发拉取 orderbook：
- `ARB_ORDERBOOK_CONCURRENCY=8`
市场列表缓存：
- `ARB_MARKETS_CACHE_MS=10000`
WS 最大可接受延迟：
- `ARB_WS_MAX_AGE_MS=10000`
- `ARB_MAX_VWAP_DEVIATION_BPS=200`（VWAP 允许偏离盘口上限）
- `ARB_RECHECK_DEVIATION_BPS=60`（偏离过大时要求二次确认）
自动执行错误熔断：
- `ARB_MAX_ERRORS=5`
- `ARB_ERROR_WINDOW_MS=60000`
- `ARB_PAUSE_ON_ERROR_MS=60000`
WS 健康日志：
- `ARB_WS_HEALTH_LOG_MS=0`（>0 启用，单位毫秒）
开启后 `npm run start:arb` 会进入持续监控模式

## 做市防吃单建议（新手必看）

如果你希望“挂单赚积分但尽量不成交”，建议打开以下保护：

- `MM_TOUCH_BUFFER_BPS=0.0008`：挂单远离盘口最优价，越大越不容易成交。
- `MM_FILL_RISK_SPREAD_BPS=0.0015`：成交压力越高，自动放大价差。
- `MM_SOFT_CANCEL_BPS=0.0012` / `MM_HARD_CANCEL_BPS=0.0025`：提前撤单避免被吃。
- `MM_HOLD_NEAR_TOUCH_MS=800`：接近成交时短暂观察，避免误撤。
- `MM_DYNAMIC_CANCEL_ON_FILL=true`：一旦成交，提高撤单敏感度。

## 一键模板（推荐）

桌面端策略开关区提供两套模板：

1. **做市防吃单模板**：自动开启盘口缓冲 + 成交压力价差 + 近触碰撤单。
2. **套利稳健模板**：自动启用 WS + 预检 + VWAP 偏离二次确认 + 稳定性窗口。

## 小额实盘演练（推荐）

用于验证下单与撤单链路是否正常：

```bash
npm run smoke:predict
```

如需真实下单再撤单：
- `ENABLE_TRADING=true`
- `SMOKE_LIVE=true`
- 可选：`SMOKE_SHARES=1`、`SMOKE_PRICE_BUFFER_BPS=50`、`SMOKE_CANCEL_MS=5000`

## 跨平台严格映射（强烈建议）

编辑 `cross-platform-mapping.json`，将 Predict 的 `condition_id` 映射到外部平台 token：

```json
{
  "entries": [
    {
      "predictMarketId": "<condition_id_or_event_id>",
      "polymarketYesTokenId": "<token>",
      "polymarketNoTokenId": "<token>",
      "opinionYesTokenId": "<token>",
      "opinionNoTokenId": "<token>"
    }
  ]
}
```

## 依赖说明（跨平台执行）

- Polymarket：需要 `POLYMARKET_PRIVATE_KEY`，可自动派生 API Key。
- Opinion：需安装 `opinion_clob_sdk`（Python），并配置 `OPINION_API_KEY` 与 `OPINION_PRIVATE_KEY`。

## 联系与邀请

- 邀请链接：https://predict.fun?ref=B0CE6
- 推特：@ccjing_eth

## 文档索引

- 新手指南：`docs/BEGINNER_GUIDE.md`
- 字段说明：`docs/CONFIG_REFERENCE.md`
- JSON 模板：`docs/JSON_TEMPLATES.md`
