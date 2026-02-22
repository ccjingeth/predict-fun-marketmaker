# 代码审查综合报告

## 审查日期
2026-02-22

## 审查范围
- ✅ 做市商核心逻辑 (`market-maker.ts`, 5274 行)
- ✅ 套利机器人逻辑 (`arbitrage-bot.ts`, 1789 行)
- ✅ 价格计算 (VWAP, micro-price)
- ✅ 订单大小计算
- ✅ 风险控制机制
- ✅ 积分规则适配
- ✅ WebSocket 处理
- ✅ 错误处理

---

## 🚨 关键发现总结

### 严重问题 (CRITICAL)

#### 做市商 - 1 个
1. **min_shares 处理逻辑不完整** (line 3725-3743)
   - 当 `depthCap` 存在且 `minShares > depthCap` 时，订单会不符合积分规则
   - 影响：积分获取失败

### 高优先级 (HIGH)

#### 做市商 - 3 个
1. 日损失限制触发后没有恢复机制
2. `buildLayerSizes` 可能导致所有层为 0
3. WebSocket 紧急恢复状态可能有死锁

#### 套利机器人 - 8 个
1. 文件过大 (1789 行)
2. 缺少单元测试
3. 部分成交处理不完整
4. 缺少回滚机制
5. 稳定性检测窗口计算复杂
6. 跨平台映射验证不足
7. WebSocket 健康检查阈值可能过于严格
8. 余额和授权检查缺失

---

## 📊 问题统计

| 模块 | CRITICAL | HIGH | MEDIUM | LOW | 总计 |
|------|----------|------|--------|-----|------|
| 做市商 | 1 | 3 | 4 | 3 | 11 |
| 套利 | 0 | 8 | 15 | 10 | 33 |
| **总计** | **1** | **11** | **19** | **13** | **44** |

---

## 🔧 必须修复的问题

### 1. [CRITICAL] min_shares 处理逻辑不完整

**文件**: `src/market-maker.ts:3725-3743`

**问题**:
```typescript
if (minShares > 0 && shares < minShares) {
  const minOrderValue = minShares * price;
  const hardCap = this.config.maxSingleOrderValue ?? Number.POSITIVE_INFINITY;
  if (minOrderValue <= hardCap && minOrderValue <= remainingRiskBudget) {
    if (!depthCap || minShares <= depthCap) {
      shares = minShares;
    }
    // ❌ 当 depthCap 存在且 minShares > depthCap 时，shares 保持 < minShares
  }
}
```

**修复方案**:
```typescript
if (minShares > 0 && shares < minShares) {
  const minOrderValue = minShares * price;
  const hardCap = this.config.maxSingleOrderValue ?? Number.POSITIVE_INFINITY;
  if (minOrderValue <= hardCap && minOrderValue <= remainingRiskBudget) {
    // 即使 depthCap 存在，也需要确保至少有一个层满足 min_shares
    shares = minShares;
  } else {
    // 无法满足 min_shares 要求，记录日志
    this.recordMmEvent('MIN_SHARES_UNMET',
      `min=${minShares} shares=${shares} value=${minOrderValue}`,
      market.token_id);
  }
}
```

**影响**: 不修复会导致订单不符合积分规则，无法获得积分

---

### 2. [HIGH] 日损失限制触发后没有恢复机制

**文件**: `src/market-maker.ts:242-248`

**问题**:
```typescript
if (this.sessionPnL <= -Math.abs(maxDailyLoss)) {
  if (!this.tradingHalted) {
    console.log(`🛑 Trading halted: session PnL ${this.sessionPnL.toFixed(2)} <= -${Math.abs(maxDailyLoss)}`);
  }
  this.tradingHalted = true;
  // ❌ 一旦设置为 true，永远无法恢复
}
```

**修复方案**:
```typescript
const autoResetMs = this.config.mmDailyLossAutoResetMs ?? 0;
if (autoResetMs > 0) {
  const haltTime = this.tradingHaltAt ?? 0;
  if (haltTime > 0 && Date.now() - haltTime > autoResetMs) {
    this.tradingHalted = false;
    this.tradingHaltAt = 0;
    this.sessionPnL = 0;
    this.recordMmEvent('TRADING_RESUMED', 'Auto-reset after daily loss timeout');
  }
}
```

---

### 3. [HIGH] buildLayerSizes 可能导致所有层为 0

**文件**: `src/market-maker.ts:2819-2839`

**问题**:
```typescript
if (minShares > 0 && size < minShares && !allowBelowMin) {
  size = 0;  // ❌ 第一层可能变为 0
}
```

**修复方案**:
```typescript
if (i === 0 && minShares > 0 && size < minShares && !allowBelowMin) {
  // 第一层但无法满足 min_shares: 返回 minShares（让调用者决定是否下单）
  size = minShares;
} else if (i > 0 && minShares > 0 && size < minShares && !allowBelowMin) {
  size = 0;  // 后续层可以为 0
}
```

---

### 4. [HIGH] 套利机器人缺少回滚机制

**文件**: `src/arbitrage-bot.ts:735-774`

**问题**: 顺序执行，中间失败不会回滚已执行的 legs

**修复方案**:
```typescript
const executedLegs: Array<{ leg: PlatformLeg; orderId: string }> = [];

try {
  for (const leg of legs) {
    const result = await this.executeLeg(leg);
    executedLegs.push({ leg, orderId: result.orderId });
  }
} catch (error) {
  // 回滚已执行的交易
  await this.rollbackLegs(executedLegs);
  throw error;
}

private async rollbackLegs(executedLegs: Array<{ leg: PlatformLeg; orderId: string }>): Promise<void> {
  for (const { leg, orderId } of executedLegs) {
    try {
      await this.api.cancelOrder(orderId);
      this.recordEvent('ROLLBACK', `Cancelled ${orderId} on ${leg.platform}`);
    } catch (cancelError) {
      this.recordEvent('ROLLBACK_FAILED', `Failed to cancel ${orderId}: ${cancelError}`);
    }
  }
}
```

---

### 5. [HIGH] 余额和授权检查缺失

**文件**: `src/arbitrage-bot.ts:663-733`

**修复方案**:
```typescript
private async validateExecutionReadiness(opp: any): Promise<{
  ok: boolean;
  reason?: string;
}> {
  // 1. 检查余额
  const balance = await this.orderManager?.getBalance();
  const requiredBalance = opp.positionSize * 1.5; // 1.5x 安全边际
  if (balance < requiredBalance) {
    return { ok: false, reason: `Insufficient balance: ${balance} < ${requiredBalance}` };
  }

  // 2. 检查授权
  const approved = await this.orderManager?.checkApprovals();
  if (!approved) {
    return { ok: false, reason: 'Token not approved' };
  }

  return { ok: true };
}
```

---

## 💡 重要改进建议

### 1. 价格计算一致性

**问题**: `midPrice` 返回的是 `microPrice` 而不是简单的 `(bid+ask)/2`

**建议**:
```typescript
// 重命名以明确意图
return {
  midPrice: microPrice,      // 重命名为 microPrice
  simpleMid: (bestBid + bestAsk) / 2,  // 添加简单中间价
  bookSpread: bookSpread,    // 添加实际订单簿价差
  quoteSpread: adaptiveSpread,  // 重命名为 quoteSpread
  // ...
}
```

### 2. 积分规则检查完整性

**问题**: `checkLiquidityPointsEligibility` 当 `!rules?.active` 时返回 `false`

**修复**:
```typescript
checkLiquidityPointsEligibility(market: Market, orderbook: Orderbook): boolean {
  const rules = this.getEffectiveLiquidityActivation(market);
  if (!rules?.active) {
    return true;  // ✅ 无积分规则时允许交易
  }
  // ... 其他检查
}
```

### 3. WebSocket 健康自动恢复

**建议**:
```typescript
private autoRecoverWsHealth(): void {
  const now = Date.now();
  const elapsed = now - this.wsHealthUpdatedAt;
  const recoverMs = this.config.mmWsHealthAutoRecoverMs ?? 30000;

  if (elapsed > recoverMs && this.wsHealthScore < 100) {
    const recoveryRate = this.config.mmWsHealthRecoveryRate ?? 1;
    this.wsHealthScore = Math.min(100, this.wsHealthScore + recoveryRate);
    this.wsHealthUpdatedAt = now;
    this.recordMmEvent('WS_HEALTH_RECOVERED', `score=${this.wsHealthScore}`);
  }
}
```

---

## 📈 性能优化建议

### 1. 内存管理

**问题**: 多个 Map 和 Set 可能无限增长

**解决方案**:
```typescript
private cleanupStaleEntries(): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24小时
  const maxSize = 10000;

  // 清理 lastExecution
  for (const [key, timestamp] of this.lastExecution.entries()) {
    if (now - timestamp > maxAge) {
      this.lastExecution.delete(key);
    }
  }

  // 限制大小
  if (this.lastExecution.size > maxSize) {
    const entries = [...this.lastExecution.entries()]
      .sort((a, b) => a[1] - b[1]);
    const toDelete = entries.slice(0, this.lastExecution.size - maxSize);
    for (const [key] of toDelete) {
      this.lastExecution.delete(key);
    }
  }
}

// 在主循环中定期调用
setInterval(() => this.cleanupStaleEntries(), 60 * 60 * 1000); // 每小时
```

### 2. 并发控制

**建议**: 使用 `p-limit` 控制并发
```typescript
import pLimit from 'p-limit';

const limit = pLimit(this.config.maxConcurrentApiCalls || 20);
const tasks = markets.map(market =>
  limit(() => this.fetchOrderbook(market))
);
await Promise.all(tasks);
```

---

## 🧪 测试建议

### 必须添加的测试

#### 1. 单元测试
```typescript
// tests/market-maker/calculate-prices.test.ts
describe('calculatePrices', () => {
  it('should handle min_shares correctly when depthCap exists', () => {
    // 测试 min_shares > depthCap 场景
  });

  it('should not return zero for first layer when baseShares < minShares', () => {
    // 测试 buildLayerSizes
  });
});

// tests/arbitrage/execution.test.ts
describe('executeOpportunity', () => {
  it('should rollback on partial failure', () => {
    // 测试回滚机制
  });

  it('should validate balance before execution', () => {
    // 测试余额检查
  });
});
```

#### 2. 集成测试
```typescript
// tests/integration/points-eligibility.test.ts
describe('Points Eligibility', () => {
  it('should correctly identify eligible orders', async () => {
    // 测试积分规则符合性
  });
});
```

---

## 🔒 安全建议

### 1. 私钥保护
✅ 使用 ethers Wallet，私钥不会在日志中暴露
✅ 没有硬编码私钥

### 2. API 密钥
✅ 从环境变量加载
✅ 没有硬编码

### 3. 风险限制
⚠️ 建议添加:
- 单笔最大交易限制
- 每日最大交易次数限制
- 异常交易检测

---

## ✅ 做得好的地方

### 做市商
1. ✅ 微观价格 (micro-price) 计算准确
2. ✅ 详细的日志记录
3. ✅ 事件系统 (mmEventLog)
4. ✅ 积分管理器集成
5. ✅ 价差缓存优化
6. ✅ 多层风控机制

### 套利机器人
1. ✅ VWAP 计算正确，考虑手续费和滑点
2. ✅ WebSocket 实时扫描
3. ✅ 预检逻辑完整
4. ✅ 机会指纹去重
5. ✅ 稳定性检测

---

## 🎯 优先修复顺序

### 立即修复 (本周内)
1. [CRITICAL] min_shares 处理逻辑
2. [HIGH] buildLayerSizes 返回 0 问题
3. [HIGH] 日损失恢复机制

### 短期修复 (2周内)
1. [HIGH] 套利部分成交处理
2. [HIGH] 套利回滚机制
3. [HIGH] 余额检查
4. [MEDIUM] 积分规则检查逻辑
5. [MEDIUM] WebSocket 健康恢复

### 中期改进 (1个月内)
1. [MEDIUM] 文件拆分
2. [MEDIUM] 添加单元测试
3. [MEDIUM] 内存管理
4. [MEDIUM] 并发控制
5. [MEDIUM] 日志级别控制

---

## 📋 修复检查清单

### 做市商
- [ ] 修复 min_shares 处理 (CRITICAL)
- [ ] 修复 buildLayerSizes 返回 0 (HIGH)
- [ ] 添加日损失恢复机制 (HIGH)
- [ ] 修复积分规则检查 (MEDIUM)
- [ ] 添加 WebSocket 健康恢复 (MEDIUM)
- [ ] 改进错误处理 (MEDIUM)

### 套利机器人
- [ ] 添加部分成交处理 (HIGH)
- [ ] 实现回滚机制 (HIGH)
- [ ] 添加余额检查 (HIGH)
- [ ] 改进跨平台映射验证 (HIGH)
- [ ] 添加单元测试 (HIGH)
- [ ] 拆分大文件 (HIGH)
- [ ] 改进错误恢复 (MEDIUM)
- [ ] 添加内存管理 (MEDIUM)
- [ ] 改进并发控制 (MEDIUM)

---

## 🎉 总结

### 整体评估
- **代码质量**: ⭐⭐⭐⭐☆ (4/5)
- **逻辑正确性**: ⭐⭐⭐⭐☆ (4/5)
- **风险控制**: ⭐⭐⭐☆☆ (3/5)
- **测试覆盖**: ⭐☆☆☆☆ (1/5)
- **可维护性**: ⭐⭐⭐☆☆ (3/5)

### 关键问题
1. **1个 CRITICAL 问题** - min_shares 处理不完整，影响积分获取
2. **11个 HIGH 问题** - 需要尽快修复
3. **19个 MEDIUM 问题** - 建议修复
4. **13个 LOW 问题** - 可选优化

### 建议
- ✅ 逻辑整体正确，可以运行
- ⚠️ 必须先修复 CRITICAL 问题再用于生产
- ⚠️ 建议修复所有 HIGH 问题
- 💡 添加测试覆盖后再大规模部署

### 下一步行动
1. 立即修复 CRITICAL 问题
2. 创建修复分支
3. 添加单元测试
4. 进行集成测试
5. 部署到测试环境验证
6. 部署到生产环境
