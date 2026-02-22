# 🤖 简易自动套利机器人

## 🎯 这是什么？

一个**超简单**的全自动套利机器人，可以：
- ✅ 自动检测套利机会（同平台 yes+no<1，跨平台价差）
- ✅ 自动执行套利交易
- ✅ 持续监控，循环扫描
- ✅ 无需复杂配置

## 🚀 快速开始（3 步）

### 第 1 步：配置基本参数

编辑 `.env` 文件：

```bash
# 套利参数
ARB_MIN_PROFIT=0.02              # 最小利润 2%
CROSS_PLATFORM_MIN_PROFIT=0.02   # 跨平台最小利润 2%

# 执行模式
ENABLE_TRADING=false             # false=模拟，true=实盘
AUTO_CONFIRM=false               # 自动确认订单
```

### 第 2 步：启动自动机器人

```bash
# 方法 1：使用脚本（推荐）
./scripts/simple-auto-arb.sh

# 方法 2：手动循环运行
while true; do
  npm run start:arb
  sleep 10  # 等待 10 秒
done
```

### 第 3 步：观察运行

机器人会自动：
1. 🔍 扫描所有市场
2. ✨ 发现套利机会
3. 🤖 自动执行交易（如果启用）
4. 💰 显示利润统计
5. 🔁 循环重复

## 📊 输出示例

```
==========================================
🤖 简易自动套利机器人
==========================================

配置信息:
  模式: 模拟
  最小利润: 2%
  扫描间隔: 10秒

开始运行...
按 Ctrl+C 停止
==========================================

[2025-02-22 23:45:30] 🔍 扫描套利机会...

🔍 扫描站内套利机会...
  市场数量: 150
  ✅ 发现 1 个套利机会:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  市场: "特朗普会在2024年赢得美国总统大选吗？"
  类型: IN_PLATFORM (站内套利)
  机会: Yes + No < 1

  📊 订单簿分析:
    YES 订单: 买 $0.650 / 卖 $0.655
    NO 订单:  买 $0.340 / 卖 $0.345
    总和: $0.995

  💰 利润分析:
    总和: 0.995 < 1.000
    利润率: 0.50%
    考虑手续费(1.00%): -0.50%
    ✅ 利润不足 2.00%，跳过

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏳ 等待 10 秒后继续...
```

## ⚙️ 配置说明

### 基础参数

```bash
# .env 文件中配置

# 最小利润率（非常重要！）
ARB_MIN_PROFIT=0.015              # 站内套利最小利润 1.5%
CROSS_PLATFORM_MIN_PROFIT=0.02    # 跨平台套利最小利润 2%

# 深度要求
ARB_MIN_DEPTH=100                 # 最小深度 100 股
CROSS_PLATFORM_MAX_SHARES=100     # 最大交易量 100 股

# 执行模式
ENABLE_TRADING=false              # false=模拟测试，true=实盘交易
AUTO_CONFIRM=false                # true=自动确认，false=手动确认
```

### 自定义扫描间隔

```bash
# 修改脚本中的间隔
export AUTO_BOT_SCAN_INTERVAL=5    # 5 秒扫描一次

# 或者在命令行指定
AUTO_BOT_SCAN_INTERVAL=5 ./scripts/simple-auto-arb.sh
```

## 🛡️ 安全建议

### 1. 先用模拟模式测试

```bash
# .env
ENABLE_TRADING=false              # 模拟模式
```

### 2. 设置合理的利润阈值

```bash
# 保守：高利润，低风险
ARB_MIN_PROFIT=0.03               # 3%

# 平衡：中等利润
ARB_MIN_PROFIT=0.02               # 2%

# 激进：低利润，高频
ARB_MIN_PROFIT=0.01               # 1%
```

### 3. 限制交易量

```bash
# 小仓位测试
CROSS_PLATFORM_MAX_SHARES=20      # 每次最多 20 股

# 逐步增加
# 第1周: 20 股
# 第2周: 50 股
# 第3周: 100 股
```

### 4. 手动确认交易

```bash
# 开始时启用手动确认
AUTO_CONFIRM=false

# 熟悉后再改为自动
AUTO_CONFIRM=true
```

## 📈 进阶用法

### 后台运行

```bash
# 使用 nohup 后台运行
nohup ./scripts/simple-auto-arb.sh > auto-arb.log 2>&1 &

# 查看日志
tail -f auto-arb.log
```

### 定时任务

```bash
# 使用 crontab 定时运行
crontab -e

# 添加：每 10 分钟运行一次
*/10 * * * * cd /path/to/project && npm run start:arb
```

### 系统服务

创建 systemd 服务（Linux）：

```ini
# /etc/systemd/system/auto-arbitrage.service
[Unit]
Description=Auto Arbitrage Bot
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/project
ExecStart=/path/to/project/scripts/simple-auto-arb.sh
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl enable auto-arbitrage
sudo systemctl start auto-arbitrage
sudo systemctl status auto-arbitrage
```

## 🔧 故障排除

### 问题 1：没有发现套利机会

**原因**：
- 市场效率高，价差小
- 利润阈值设置太高

**解决**：
```bash
# 降低最小利润要求
ARB_MIN_PROFIT=0.01
```

### 问题 2：交易失败

**原因**：
- 余额不足
- 深度不够
- 价格变化太快

**解决**：
```bash
# 降低交易量
CROSS_PLATFORM_MAX_SHARES=10

# 增加深度要求
ARB_MIN_DEPTH=200
```

### 问题 3：扫描太慢

**原因**：
- 市场数量太多
- API 限制

**解决**：
```bash
# 减少扫描的市场
# 或增加扫描间隔
AUTO_BOT_SCAN_INTERVAL=30
```

## ⚠️ 风险提示

1. **市场风险**：套利机会可能瞬间消失
2. **执行风险**：网络延迟可能导致失败
3. **资金风险**：建议从小金额开始
4. **平台风险**：API 限制和规则变化

**建议**：
- ✅ 先用模拟模式测试 1-2 周
- ✅ 从小金额开始（$10-50）
- ✅ 逐步增加交易量
- ✅ 定期检查日志和统计

## 📞 获取帮助

- 查看日志：`tail -f auto-arb.log`
- 检查配置：`cat .env | grep ARB`
- 手动测试：`npm run start:arb`

**祝交易顺利！** 🎉💰
