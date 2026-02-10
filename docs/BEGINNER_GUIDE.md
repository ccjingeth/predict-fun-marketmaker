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

并可设置：
- `ARB_WS_HEALTH_LOG_MS=5000`（日志监控）

## 9. 深度与 VWAP（已默认启用）

脚本会基于订单簿深度计算 VWAP，确保“总成本 < $1”的判断更接近真实成交。

## 10. 失败熔断（防止连亏）

建议开启：
- `ARB_MAX_ERRORS=5`
- `ARB_ERROR_WINDOW_MS=60000`
- `ARB_PAUSE_ON_ERROR_MS=60000`

## 11. 手续费提示（重要）

- Polymarket 的部分市场存在**曲线型手续费**，不是简单的线性比例。
- 脚本默认使用 `POLYMARKET_FEE_RATE_URL` 获取费率，并用 `POLYMARKET_FEE_CURVE_*` 估算费用。
- 如果你在非收费市场或费用变化频繁，建议：
  - 将 `POLYMARKET_FEE_BPS=0` 或关闭曲线（`POLYMARKET_FEE_CURVE_RATE=0`）。

## 12. 常见问题

1. 没有数据？检查 API Key / WS 开关 / 网络。
2. 自动执行失败？看日志，检查 JWT / 余额 / Approvals。
3. 跨平台不出机会？检查映射是否正确、市场是否一致。

如需要详细字段解释，请看：
- `docs/CONFIG_REFERENCE.md`
- `docs/JSON_TEMPLATES.md`
