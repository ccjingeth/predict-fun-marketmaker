# 🚨 关键问题快速修复指南

## 立即修复（影响积分获取）

### 1. [CRITICAL] min_shares 处理不完整

**症状**: 订单可能不符合积分规则，导致无法获得积分

**位置**: `src/market-maker.ts` 第 3725-3743 行

**快速修复**:
```typescript
// 找到这段代码（约 3725 行）:
if (minShares > 0 && shares < minShares) {
  const minOrderValue = minShares * price;
  const hardCap = this.config.maxSingleOrderValue ?? Number.POSITIVE_INFINITY;
  if (minOrderValue <= hardCap && minOrderValue <= remainingRiskBudget) {
    if (!depthCap || minShares <= depthCap) {
      shares = minShares;
    }
  }
}

// 替换为:
if (minShares > 0 && shares < minShares) {
  const minOrderValue = minShares * price;
  const hardCap = this.config.maxSingleOrderValue ?? Number.POSITIVE_INFINITY;
  if (minOrderValue <= hardCap && minOrderValue <= remainingRiskBudget) {
    // 优先确保满足 min_shares，即使超过 depthCap
    shares = minShares;
    this.recordMmEvent('MIN_SHARES_ENFORCED',
      `min=${minShares} depthCap=${depthCap}`,
      market.token_id);
  }
}
```

**验证方法**:
```bash
# 查看日志
grep "MIN_SHARES_ENFORCED" logs/bot.log
# 应该看到执行记录
```

---

## 必须修复（影响功能）

### 2. [HIGH] 日损失限制无法恢复

**症状**: 触发日损失限制后，做市商永久停止

**位置**: `src/market-maker.ts` 第 242-248 行

**快速修复**:
```typescript
// 在检查 tradingHalted 之前添加（约 242 行）:
const autoResetMs = this.config.mmDailyLossAutoResetMs ?? 0;
if (autoResetMs > 0 && this.tradingHalted) {
  const haltTime = this.tradingHaltAt ?? 0;
  if (haltTime > 0 && Date.now() - haltTime > autoResetMs) {
    console.log(`♻️ Auto-resuming trading after ${autoResetMs}ms timeout`);
    this.tradingHalted = false;
    this.tradingHaltAt = 0;
    this.sessionPnL = 0;
    this.recordMmEvent('TRADING_RESUMED', 'Auto-reset after daily loss timeout');
  }
}

// 然后在原有的检查中添加时间戳记录:
if (this.sessionPnL <= -Math.abs(maxDailyLoss)) {
  if (!this.tradingHalted) {
    console.log(`🛑 Trading halted: session PnL ${this.sessionPnL.toFixed(2)} <= -${Math.abs(maxDailyLoss)}`);
    this.tradingHaltAt = Date.now(); // ✅ 添加这行
  }
  this.tradingHalted = true;
}
```

**配置**:
```bash
# 在 .env 中添加（可选，默认不自动恢复）
MM_DAILY_LOSS_AUTO_RESET_MS=86400000  # 24小时后自动恢复
```

---

### 3. [HIGH] buildLayerSizes 返回 0

**症状**: 第一层订单大小可能为 0，导致无法下单

**位置**: `src/market-maker.ts` 第 2819-2839 行

**快速修复**:
```typescript
// 找到 buildLayerSizes 函数中的这段代码（约 2830 行）:
for (let i = 0; i < safeCount; i += 1) {
  const scaled = i === 0 ? baseShares : baseShares * Math.pow(decay, i);
  let size = Math.max(1, Math.floor(scaled * floor));
  if (minShares > 0 && size < minShares && !allowBelowMin) {
    size = 0;  // ❌ 问题代码
  }
  sizes.push(size);
}

// 替换为:
for (let i = 0; i < safeCount; i += 1) {
  const scaled = i === 0 ? baseShares : baseShares * Math.pow(decay, i);
  let size = Math.max(1, Math.floor(scaled * floor));

  // ✅ 修复后的逻辑
  if (minShares > 0 && size < minShares && !allowBelowMin) {
    if (i === 0) {
      // 第一层：尽量满足 min_shares
      size = minShares;
    } else {
      // 后续层：可以为 0
      size = 0;
    }
  }

  sizes.push(size);
}
```

---

## 建议修复（提高稳定性）

### 4. [MEDIUM] 积分规则检查逻辑错误

**位置**: `src/market-maker.ts` 第 3783-3797 行

**快速修复**:
```typescript
// 找到 checkLiquidityPointsEligibility 函数（约 3783 行）:
checkLiquidityPointsEligibility(market: Market, orderbook: Orderbook): boolean {
  const rules = this.getEffectiveLiquidityActivation(market);
  if (!rules?.active) {
    return true;  // ✅ 改为 true：无积分规则时允许交易
  }

  // 检查 spread
  const maxSpread = rules.max_spread ?? (rules.max_spread_cents ? rules.max_spread_cents / 100 : undefined);
  if (maxSpread && orderbook.spread && orderbook.spread > maxSpread) {
    this.recordMmEvent('POINTS_SPREAD_EXCEEDED',
      `spread=${orderbook.spread} max=${maxSpread}`,
      market.token_id);
    return false;
  }

  return true;
}
```

---

### 5. [MEDIUM] WebSocket 健康自动恢复

**位置**: `src/market-maker.ts` 添加新方法

**添加代码**:
```typescript
// 在 MarketMaker 类中添加新方法（约 260 行附近）:
private autoRecoverWsHealth(): void {
  const now = Date.now();
  const elapsed = now - this.wsHealthUpdatedAt;
  const recoverMs = this.config.mmWsHealthAutoRecoverMs ?? 30000;

  if (elapsed > recoverMs && this.wsHealthScore < 100) {
    const oldScore = this.wsHealthScore;
    this.wsHealthScore = Math.min(100, this.wsHealthScore + 1);
    this.wsHealthUpdatedAt = now;

    if (this.wsHealthScore > oldScore) {
      console.log(`♻️ WebSocket health recovering: ${oldScore} -> ${this.wsHealthScore}`);
    }
  }
}

// 在 runQuoteCycle() 中调用（约 2500 行）:
// 在函数开始处添加:
this.autoRecoverWsHealth();
```

---

## 修复步骤

### 1. 备份代码
```bash
cd /Users/cc/Desktop/CC/predict-fun-market-maker
git checkout -b fix/critical-issues
git add .
git commit -m "Backup before critical fixes"
```

### 2. 应用修复

**选项A: 手动修复**（推荐）
```bash
# 按照上面的指南逐个修复
code src/market-maker.ts
```

**选项B: 使用 patch**
```bash
# 创建 patch 文件
cat > critical-fixes.patch << 'EOF'
# patch 内容...
EOF

# 应用 patch
patch -p1 < critical-fixes.patch
```

### 3. 测试修复
```bash
# 编译检查
npm run build

# 运行测试（如果有）
npm test

# 手动测试
ENABLE_TRADING=false npm start
```

### 4. 验证修复
```bash
# 查看日志确认修复生效
tail -f logs/bot.log | grep -E "MIN_SHARES_ENFORCED|TRADING_RESUMED"
```

### 5. 提交修复
```bash
git add src/market-maker.ts
git commit -m "fix: 修复 min_shares 处理逻辑

- 优先满足 min_shares 即使超过 depthCap
- 添加事件日志记录
- 修复 CRITICAL 问题影响积分获取

Co-Authored-By: Claude Sonnet <noreply@anthropic.com>"
```

---

## 测试检查清单

修复后，请确认以下测试通过：

### ✅ 功能测试
- [ ] 做市商可以正常启动
- [ ] 订单创建成功
- [ ] 订单大小 >= min_shares (100)
- [ ] 订单价差 <= max_spread (6¢)
- [ ] 日志显示 "MIN_SHARES_ENFORCED"

### ✅ 积分规则测试
- [ ] 配置 ORDER_SIZE=110
- [ ] 配置 SPREAD=0.055
- [ ] 启动做市商
- [ ] 检查创建的订单符合积分规则
- [ ] 日志显示订单符合规则

### ✅ 恢复机制测试
- [ ] 触发日损失限制
- [ ] 确认交易暂停
- [ ] 等待自动恢复时间
- [ ] 确认交易自动恢复

---

## 验证命令

```bash
# 1. 检查订单大小
grep "ORDER_SIZE" .env
# 应该看到 >= 100

# 2. 检查价差配置
grep "SPREAD" .env
# 应该看到 <= 0.06

# 3. 运行做市商（模拟模式）
ENABLE_TRADING=false npm start

# 4. 查看日志
tail -f logs/bot.log | grep -E "MIN_SHARES|SPREAD|POINTS"

# 5. 验证积分符合性
# 日志中应该看到:
# ✅ 订单符合积分规则
# ✅ MIN_SHARES_ENFORCED min=100 depthCap=...
```

---

## 常见问题

### Q1: 修复后还是无法获得积分？
**A**: 检查以下几点：
1. ORDER_SIZE 是否 >= 100
2. SPREAD 是否 <= 0.06
3. 日志中是否显示订单符合规则
4. 是否在正确的市场（有积分规则的市场）

### Q2: 如何确认修复生效？
**A**: 查看日志中的事件记录：
```bash
grep "MIN_SHARES_ENFORCED" logs/bot.log
```

### Q3: 修复后编译失败？
**A**: 检查：
1. TypeScript 版本是否正确
2. 是否有语法错误
3. 运行 `npm run build` 查看详细错误

### Q4: 能否先不修复就运行？
**A**:
- ❌ **不推荐**：CRITICAL 问题直接影响积分获取
- ⚠️ **临时方案**：确保 ORDER_SIZE >= 110 且禁用 depthCap
- ✅ **推荐**：立即修复后再用于生产

---

## 需要帮助？

- **详细审查报告**: `docs/CODE_REVIEW_SUMMARY.md`
- **完整代码审查**: 做市商和套利机器人已全面审查
- **问题跟踪**: 所有发现的问题都在报告中

**下一步**: 应用上述修复后，重新运行审查确认问题已解决。
