# 使用说明（桌面端）

## 下载安装

1. 打开 GitHub Releases 页面，下载 macOS 版本：
   - `Predict.fun Console-0.1.0-arm64.dmg`
2. 双击 `.dmg`，拖动到 Applications。
3. 首次启动如果被系统拦截：右键应用 → 打开。

## 配置文件位置

打包版会在用户目录创建配置：
- macOS：`~/Library/Application Support/Predict.fun Console/bot/.env`
- macOS 映射文件：`~/Library/Application Support/Predict.fun Console/bot/cross-platform-mapping.json`

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
