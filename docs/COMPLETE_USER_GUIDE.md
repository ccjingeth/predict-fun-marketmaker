# 🎯 做市商与套利系统 - 完整使用指南

## 📖 系统概述

Predict.fun 做市商与套利系统提供两个核心功能：
1. **做市商系统** - 专注赚取积分
2. **套利系统** - 自动套利交易（支持同平台和跨平台）

---

## 🚀 快速开始

### 第1步：选择版本

首次启动应用：
```bash
npm start
```

会显示版本选择页面：
- **简化版（🎯）**：推荐新手，专注积分
- **完整版（🔧）**：高级用户，包含套利

### 第2步：配置环境变量

打开应用后，点击 **"配置中心"** 标签页，确保配置：
```bash
# 必需配置
API_KEY=your_api_key_here
PRIVATE_KEY=your_private_key_here
JWT_TOKEN=your_jwt_token_here

# 做市商配置
ENABLE_TRADING=true           # 启用交易（true=实盘，false=模拟）
MM_VENUE=predict             # 做市平台
MM_POINTS_OPTIMIZATION=true   # 启用积分优化
MM_POINTS_V2_OPTIMIZER=true   # 启用V2极致优化
```

### 第3步：保存配置

点击 **"保存配置"** 按钮

### 第4步：启动系统

- **做市商**：点击 **"启动做市商"** 按钮
- **套利机器人**：点击 **"启动套利"** 按钮（仅完整版）

---

## 🎯 做市商系统（赚取积分）

### 功能特点

✅ **智能积分优化**
- V1 优化引擎：基础积分优化
- V2 优化引擎：机器学习驱动的极致优化
- 自动调整订单大小和价差
- 实时监控积分效率

✅ **多平台支持**
- Predict.fun（主要平台）
- Probable（虚拟积分适配）
- 未来支持更多平台

✅ **一键最佳实践**
- 自动配置所有积分优化参数
- 新手友好的配置模板

### 使用流程

#### 简化版（推荐新手）

```
1. 点击 "✨ 一键最佳实践"
2. 点击 "保存配置"
3. 点击 "启动做市商"
4. 查看 "积分状态" 确认正常
```

#### 完整版

```
1. 配置策略开关（30个选项）
2. 选择做市平台（Predict/Probable）
3. 应用配置模板
4. 点击 "启动做市商"
5. 监控执行指标（30+个指标）
```

### 积分优化配置

#### 核心配置
```bash
# 积分优化开关
MM_POINTS_PRIORITIZE=true              # 优先积分市场（默认）
MM_POINTS_OPTIMIZATION=true             # 启用积分优化（默认）
MM_POINTS_V2_OPTIMIZER=true             # V2 极致优化（默认）
MM_ONLY_POINTS_MARKETS=true             # 只做积分市场

# 积分规则
MM_POINTS_MIN_SHARES=100                # 最小订单股数
MM_POINTS_MAX_SPREAD_CENTS=6            # 最大价差（美分）
MM_POINTS_ASSUME_ACTIVE=true            # 启用默认规则

# V2 优化器权重（高级）
# weights: { points: 0.4, profit: 0.3, risk: 0.2, efficiency: 0.1 }
```

### 积分效率监控

启动后查看 **"积分状态"** 卡片：
- ✅ **积分效率**：符合积分规则的订单比例（目标 80%+）
- ✅ **活跃积分市场**：当前有积分规则的市场数量
- ✅ **总订单数**：已提交的订单总数
- ✅ **符合订单数**：符合积分规则的订单数

### 日志查看

在 **"运行日志"** 中过滤：
- 选择 **"做市商"** 查看做市相关日志
- 选择 **"积分相关"** 查看积分优化日志

日志示例：
```
🎯 V2 optimization for abc12345: score=95 points=90
市场状况: EXCELLENT
机会评分: 85/100
积分预期: 优秀 (90/100)
```

---

## 💰 套利系统（自动套利）

### 功能特点

✅ **多种套利类型**
- **站内套利**：同一平台内的套利机会
- **跨平台套利**：不同平台之间的套利机会
- **多结果套利**：多市场组合套利
- **依赖套利**：依赖关系套利
- **价值错配套利**：价值差异套利

✅ **多平台支持**
- Predict.fun
- Polymarket
- Opinion
- Probable

✅ **智能执行**
- 自动预检
- 风险评估
- 自动执行（可选）
- 实时监控

### 套利类型详解

#### 1. 站内套利（In-Platform）

**说明**：在同一个平台内进行套利
- 例：Predict.fun YES @ 0.45 → Predict.fun NO @ 0.55

**配置**：
```bash
# 启用站内套利
ARB_AUTO_EXECUTE=false              # 手动执行（推荐）
ARB_PREFLIGHT_ENABLED=true          # 启用预检
ARB_WS_REALTIME=true                 # 实时扫描
```

**适用场景**：
- ✅ 新手用户
- ✅ 低风险偏好
- ✅ 单平台用户

#### 2. 跨平台套利（Cross-Platform）

**说明**：在不同平台之间进行套利
- 例：Predict.fun YES @ 0.45 → Polymarket YES @ 0.55

**配置**：
```bash
# 启用跨平台套利
CROSS_PLATFORM_ENABLED=true                         # 启用跨平台检测
CROSS_PLATFORM_AUTO_EXECUTE=false                   # 手动执行（推荐）
CROSS_PLATFORM_MIN_SIMILARITY=0.78                  # 最小相似度
CROSS_PLATFORM_MIN_PROFIT=0.01                      # 最小利润（1%）
CROSS_PLATFORM_TRANSFER_COST=0.002                  # 转账成本（0.2%）
CROSS_PLATFORM_MAX_SHARES=200                        # 最大股数
CROSS_PLATFORM_DEPTH_LEVELS=10                       # 深度层级
CROSS_PLATFORM_WS_REALTIME=true                      # 实时扫描
CROSS_PLATFORM_REQUIRE_WS=true                       # 强制使用WebSocket
```

**平台选择**：
在 **"套利机会"** 卡片中：
1. **类型**：选择 **"跨平台套利"**
2. **平台**：勾选要使用的平台（多选）
   - ✅ Predict.fun
   - ✅ Polymarket
   - ✅ Opinion
   - ✅ Probable
3. 点击 **"重置平台"** 恢复默认选择

**适用场景**：
- ✅ 高级用户
- ✅ 追求更高收益
- ✅ 多平台账户

#### 3. 多结果套利（Multi-Outcome）

**说明**：利用同一事件的不同市场进行套利
- 例：Trump 2024 市场1 @ 0.45 → 市场2 @ 0.55

**配置**：
```bash
MULTI_OUTCOME_ENABLED=true                           # 启用多结果套利
MULTI_OUTCOME_MIN_OUTCOMES=3                         # 最小市场数
MULTI_OUTCOME_MAX_SHARES=500                         # 最大股数
```

**适用场景**：
- ✅ 高级用户
- ✅ 事件相关市场多时

#### 4. 依赖套利（Dependency）

**说明**：利用市场间的依赖关系套利
- 例：A > B > C 的价格关系

**配置**：
```bash
DEPENDENCY_ARB_ENABLED=true                           # 启用依赖套利
```

**适用场景**：
- ✅ 高级用户
- ✅ 有依赖关系的市场

#### 5. 价值错配套利（Value Mismatch）

**说明**：利用价值判断差异套利
- 例：市场低估 → 高估

**配置**：
```bash
ARB_AUTO_EXECUTE_VALUE=true                           # 启用价值错配自动执行
USE_VALUE_SIGNAL=true                                  # 启用价值信号
```

**适用场景**：
- ✅ 高级用户
- ✅ 价值投资策略

### 套利执行流程

#### 自动执行模式

⚠️ **谨慎使用**：建议先在模拟模式测试

```bash
# 站内套利自动执行
ARB_AUTO_EXECUTE=true
ARB_PREFLIGHT_ENABLED=true

# 跨平台套利自动执行
CROSS_PLATFORM_AUTO_EXECUTE=true
CROSS_PLATFORM_ENABLED=true
```

#### 手动执行模式（推荐）

```bash
# 关闭自动执行
ARB_AUTO_EXECUTE=false
CROSS_PLATFORM_AUTO_EXECUTE=false
```

1. 查看 **"套利机会"** 卡片
2. 选择套利类型和平台
3. 查看机会详情
4. 手动决定是否执行

### 套利机会过滤

在 **"套利机会"** 卡片中：

**类型过滤**：
- 全部
- 站内套利
- 跨平台套利
- 多结果套利
- 依赖套利
- 价值错配

**平台过滤**（多选）：
- Predict.fun
- Polymarket
- Opinion
- Probable

**收益过滤**：
- 最小收益%（例如：2%）
- 最小利润 USD（例如：$10）

### 套利执行指标

监控 **"执行指标"** 卡片：

**核心指标**：
- ✅ **成功率**：执行成功的比例（目标 80%+）
- ✅ **失败率**：执行失败的比例（目标 <20%）
- ✅ **预检失败率**：预检阶段失败的比例
- ✅ **成交后失败率**：成交后失败的比例

**性能指标**：
- ✅ **预检耗时 EMA**：预检平均耗时（ms）
- ✅ **执行耗时 EMA**：执行平均耗时（ms）
- ✅ **总耗时 EMA**：总平均耗时（ms）

**质量指标**：
- ✅ **Post-trade Drift**：成交后价格漂移（bps）
- ✅ **质量分**：自适应执行评分
- ✅ **深度惩罚**：深度不对称惩罚

**风险指标**：
- ✅ **风险等级**：当前风险等级
- ✅ **告警次数**：post-trade 触发次数
- ✅ **软拒绝**：软阈值阻断次数

### 风险控制

#### 自动降级

点击 **"一键降级"** 按钮：自动应用保守配置

#### 保守档

点击 **"保守档"** 按钮：应用保守策略

#### 极保守

点击 **"极保守"** 按钮：应用极保守策略

#### 硬门控自动修复

```bash
CROSS_PLATFORM_HARD_GATE_AUTO_APPLY_FIX=true     # 自动修复
CROSS_PLATFORM_HARD_GATE_AUTO_ULTRA=true          # 极保守模式
```

---

## 🔧 高级配置

### 模板系统

#### 做市模板

1. **做市防吃单模板**
   - 优化 `MM_TOUCH_BUFFER_BPS`
   - 优化 `MM_FILL_RISK_SPREAD_BPS`
   - 优化 `MM_NEAR_TOUCH_PENALTY_BPS`

2. **Probable 积分做市模板**
   - `MM_VENUE=probable`
   - `MM_POINTS_MIN_ONLY=true`
   - `MM_ONLY_POINTS_MARKETS=true`

3. **Probable 对冲模板**
   - 启用对冲功能
   - 优化对冲参数

#### 套利模板

**套利稳健模板**：
```bash
ARB_PREFLIGHT_ENABLED=true
ARB_WS_REALTIME=true
ARB_MAX_VWAP_DEVIATION_BPS=50
```

### WebSocket 实时数据

**做市商 WebSocket**：
```bash
MM_WS_ENABLED=true                  # 做市商 WebSocket（默认）
PREDICT_WS_ENABLED=true              # Predict WebSocket
PROBABLE_WS_ENABLED=true             # Probable WebSocket
```

**套利 WebSocket**：
```bash
ARB_REQUIRE_WS=true                  # 套利强制 WebSocket
ARB_WS_REALTIME=true                 # 套利实时扫描
CROSS_PLATFORM_REQUIRE_WS=true       # 跨平台强制 WebSocket
CROSS_PLATFORM_WS_REALTIME=true      # 跨平台实时扫描
```

### API 配置

```bash
# Predict API
API_BASE_URL=https://api.predict.org
API_KEY=your_api_key
JWT_TOKEN=your_jwt_token

# Probable API
PROBABLE_ENABLED=true                 # 启用 Probable 数据
PROBABLE_API_URL=https://api.probable.markets
```

---

## 📊 监控与诊断

### 做市指标

**"做市指标"** 卡片显示：
- 活跃市场数
- 订单总数
- 符合积分规则的订单（新增）
- 积分效率（新增）
- 总盈亏
- 成交次数

### 套利机会

**"套利机会"** 卡片显示：
- 当前可用机会
- 类型标签
- 预期收益
- 平台信息

### 系统体检

点击 **"一键体检"** 按钮：
- ✅ 检查配置完整性
- ✅ 检查 API 连接
- ✅ 检查 WebSocket 连接
- ✅ 检查账户余额
- ✅ 生成诊断报告

---

## 💡 使用建议

### 新手用户推荐配置

```
✅ 简化版 + 一键最佳实践
✅ 模拟模式测试（ENABLE_TRADING=false）
✅ 站内套利手动执行
✅ 监控积分效率
```

### 高级用户推荐配置

```
✅ 完整版 + 自定义配置
✅ 实盘模式（ENABLE_TRADING=true）
✅ 跨平台套利（多平台）
✅ 自动执行（谨慎）
✅ 监控30+个指标
```

### 风险管理

```
1. 从模拟模式开始
2. 小仓位测试
3. 逐步增加仓位
4. 监控成功率
5. 失败时降级
```

---

## ⚠️ 注意事项

### 做市商

- ⚠️ 确保满足积分规则（min_shares, max_spread）
- ⚠️ 监控库存风险
- ⚠️ 注意市场流动性
- ⚠️ WebSocket 断线会自动恢复

### 套利

- ⚠️ 跨平台套利需要多个平台账户
- ⚠️ 考虑转账成本和费用
- ⚠️ 价格可能快速变化
- ⚠️ 预检不通过不要执行

### 风险控制

- ⚠️ 始终使用止损
- ⚠️ 监控成功率
- ⚠️ 失败率过高时降级
- ⚠️ 定期查看日志

---

## 🆘 故障排除

### 做市商无法启动

1. 检查 `ENABLE_TRADING` 配置
2. 检查 JWT_TOKEN 是否有效
3. 检查 API_KEY 是否正确
4. 查看日志中的错误信息

### 套利无机会

1. 检查 WebSocket 连接
2. 检查平台过滤器设置
3. 降低最小收益要求
4. 刷新套利机会

### 积分效率低

1. 确保启用了积分优化
2. 检查 min_shares 和 max_spread 配置
3. 使用一键最佳实践
4. 查看积分状态卡片

---

## 📚 相关文档

- `QUICKSTART.md` - 快速开始指南
- `PROJECT_SUMMARY.md` - 项目完整总结
- `docs/VERSION_SYSTEM_GUIDE.md` - 版本系统指南
- `docs/POINTS_OPTIMIZATION_GUIDE.md` - 积分优化指南

---

**版本**: 2.0.0
**更新时间**: 2025-02-22
**作者**: Predict.fun 做市商团队
