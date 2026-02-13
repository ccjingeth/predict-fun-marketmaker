# 小白上手指南（必读）

本指南适合第一次使用做市商/套利脚本的用户。按顺序操作即可。

## 1. 安装与准备

1. 安装 Node.js（建议 18+）
2. 安装 Python3（如果要用依赖套利 / Opinion）
3. 进入项目目录执行：
   - `npm install`

## 2. 准备必要密钥

必须准备：
- `API_KEY`：Predict.fun 的 API Key
- `PRIVATE_KEY`：钱包私钥（用于签名）
- `JWT_TOKEN`：用于私有接口（实盘必须）

可选但推荐：
- `RPC_URL`：提升链上调用稳定性

## 3. 填写 `.env`

复制模板并修改：
- `cp .env.example .env`

最小可运行配置：
- `API_KEY=...`
- `PRIVATE_KEY=...`
- `JWT_TOKEN=...`
- `ENABLE_TRADING=false`（先用模拟模式）

## 4. 先用“模拟模式”

推荐小白先跑扫描，不自动下单：
- `ENABLE_TRADING=false`
- `ARB_AUTO_EXECUTE=false`

启动套利机器人：
- `npm run start:arb`

看到日志输出机会即表示运行正常。

## 5. 开启自动执行（慎重）

确认一切正常后，才考虑打开：
- `ENABLE_TRADING=true`
- `ARB_AUTO_EXECUTE=true`
- 可选：`AUTO_CONFIRM=true`（无人值守）

## 6. 跨平台套利（可选）

需要：
- `CROSS_PLATFORM_ENABLED=true`
- 配好 Polymarket / Opinion 密钥
- 编辑 `cross-platform-mapping.json`
- 如需更稳健执行：`CROSS_PLATFORM_EXECUTION_VWAP_CHECK=true`
- 可选：`CROSS_PLATFORM_PRICE_DRIFT_BPS=40`（限制最优价漂移）
- 可选：`CROSS_PLATFORM_ADAPTIVE_SIZE=true`（按深度自动缩小下单量）
- 可选：`CROSS_PLATFORM_VOLATILITY_BPS=80`（短时波动过滤）
- 可选：`CROSS_PLATFORM_DEPTH_USAGE=0.5`（使用深度的最大比例）
- 可选：`CROSS_PLATFORM_RECHECK_MS=200`（预检二次确认）
- 可选：`CROSS_PLATFORM_STABILITY_SAMPLES=3`（稳定性采样）
- 可选：`CROSS_PLATFORM_POST_TRADE_DRIFT_BPS=80`（成交后漂移降级）
- 可选：`CROSS_PLATFORM_AUTO_TUNE=true`（执行质量自动调参）
- 可选：`CROSS_PLATFORM_CHUNK_MAX_SHARES=20`（分块执行，减少冲击）
- 可选：`CROSS_PLATFORM_LEG_DRIFT_SPREAD_BPS=80`（腿间漂移差异常降级）
- 可选：`CROSS_PLATFORM_AUTO_BLOCKLIST=true`（自动黑名单，失败频次过高会暂时跳过）
- 可选：`CROSS_PLATFORM_CHUNK_AUTO_TUNE=true`（分块大小自动调节）
- 可选：`CROSS_PLATFORM_GLOBAL_COOLDOWN_MS=120000`（全局降级冷却）
- 可选：`CROSS_PLATFORM_CHUNK_DELAY_AUTO_TUNE=true`（分块延迟自动调节）
- 可选：`CROSS_PLATFORM_ORDER_TYPE=FOK`（FOK/FAK/GTC）
- 可选：`CROSS_PLATFORM_METRICS_LOG_MS=10000`（执行指标日志）
- 可选：`CROSS_PLATFORM_BATCH_ORDERS=true`（Polymarket 批量下单）
- 推荐：`CROSS_PLATFORM_USE_FOK=true`，`CROSS_PLATFORM_PARALLEL_SUBMIT=true`
- 可选：`CROSS_PLATFORM_POST_FILL_CHECK=true`（执行后检查未成交并撤单）
- 可选：`CROSS_PLATFORM_HEDGE_ON_FAILURE=true`（失败时自动对冲，风险更高）

## 7. 依赖套利（进阶）

需要：
- `pip install ortools`
- `DEPENDENCY_ARB_ENABLED=true`
- 编辑 `dependency-constraints.json`

## 8. WebSocket 实时行情（强烈建议）

开启：
- `PREDICT_WS_ENABLED=true`
- `POLYMARKET_WS_ENABLED=true`
- `OPINION_WS_ENABLED=true`
可选增强：
- `PREDICT_WS_STALE_MS=20000`（无消息自动重连）
- `POLYMARKET_WS_STALE_MS=20000`
- `OPINION_WS_STALE_MS=20000`

并可设置：
- `ARB_WS_HEALTH_LOG_MS=5000`（日志监控）

## 9. 执行指标看板（桌面端推荐）

桌面端新增“执行指标”面板，用于快速判断当前执行是否健康。常见字段说明：

- 成功率：`successes / attempts`，低于 60% 建议检查滑点与映射质量。
- 预检耗时 EMA：`EMA(preflight)`，反映订单簿获取 + VWAP 校验耗时。
- 执行耗时 EMA：`EMA(exec)`，反映下单与撮合链路速度。
- 总耗时 EMA：`EMA(total)`，预检 + 执行整体耗时。
- Post-trade Drift：成交后价格漂移均值，越高越危险。
- 质量分：自适应执行评分，低于阈值会触发降级或冷却。
- Chunk 因子：分块下单比例，自动调参会拉低冲击。
- Chunk 延迟：分块间延迟，失败会拉长、成功会缩短。
- 全局冷却：质量分过低后自动暂停执行。
- 封禁 Token / 平台：失败过多会被临时跳过。
- 最后错误：最近一次失败原因。
- 趋势图：成功率与 Post-trade Drift 的滚动趋势，便于识别“执行退化”。
- 告警：当成功率过低、漂移过高、质量分过低或指标过期时会提示。

## 10. 一键体检（桌面端推荐）

桌面端新增“一键体检”，可快速发现配置缺失与风险点：

- API Key / 私钥 / JWT 是否就绪
- WS 是否开启
- 跨平台映射与依赖约束是否有效
- metrics / state 文件是否更新
- 做市/套利进程运行状态

点击“导出诊断包”会生成包含 `.env`、映射、依赖、metrics/state 的诊断包，方便排查问题。
诊断包还会包含最近日志（`bot-logs.json`），以及体检报告（`diagnostics.json`）。
新增 `env-suggestions.txt`：自动给出的“安全降级”建议参数，可直接复制进 `.env`。
诊断包中的 `bot-logs.json` 只保留最近 24 小时关键日志，降低噪声。

## 11. 风险等级与一键降级（桌面端推荐）

- 风险等级会根据成功率、漂移、质量分、指标时效自动评估为“低/中/高”。  
- “一键降级”会写入更保守的执行参数（只修改编辑区，需要手动保存）。  
- “复制失败原因”可以快速粘贴给技术支持或用于排查。
- “修复建议”按钮会根据失败原因给出可执行的参数建议。
- “保守档 / 极保守”支持快速切到不同风险档位。
- “应用修复建议”会根据失败分类写入参数模板（仍需手动保存）。
- “修复建议预览”会显示将被修改的参数以及当前值/目标值。
- “风险解释”会显示风险评分来源的具体加分项。
- “选择性应用”支持按条勾选修复建议。
- “风险权重”支持自定义评分权重（成功率/漂移/质量/时效）。
- 日志支持按失败分类过滤，点击分类可自动筛选日志。
- 权重可保存为预设，支持切换/删除。
- 预设支持导入/导出 JSON。
- 日志支持关键词搜索。

指标文件可在 `.env` 里设置：
- `CROSS_PLATFORM_METRICS_PATH`
- `CROSS_PLATFORM_STATE_PATH`

## 12. 小额实盘演练（推荐）

脚本内置一键烟雾测试（下单后自动撤单）：

- `npm run smoke:predict`

如需真实下单再撤单：
- `ENABLE_TRADING=true`
- `SMOKE_LIVE=true`
- 建议设置 `SMOKE_SHARES=1`、`SMOKE_PRICE_BUFFER_BPS=50`

## 13. 深度与 VWAP（已默认启用）

脚本会基于订单簿深度计算 VWAP，确保“总成本 < $1”的判断更接近真实成交。

## 14. 失败熔断（防止连亏）

建议开启：
- `ARB_MAX_ERRORS=5`
- `ARB_ERROR_WINDOW_MS=60000`
- `ARB_PAUSE_ON_ERROR_MS=60000`

## 15. 手续费提示（重要）

- Polymarket 的部分市场存在**曲线型手续费**，不是简单的线性比例。
- 脚本默认使用 `POLYMARKET_FEE_RATE_URL` 获取费率，并用 `POLYMARKET_FEE_CURVE_*` 估算费用。
- 如果你在非收费市场或费用变化频繁，建议：
  - 将 `POLYMARKET_FEE_BPS=0` 或关闭曲线（`POLYMARKET_FEE_CURVE_RATE=0`）。

## 16. 常见问题

1. 没有数据？检查 API Key / WS 开关 / 网络。
2. 自动执行失败？看日志，检查 JWT / 余额 / Approvals。
3. 跨平台不出机会？检查映射是否正确、市场是否一致。

如需要详细字段解释，请看：
- `docs/CONFIG_REFERENCE.md`
- `docs/JSON_TEMPLATES.md`
