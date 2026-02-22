
// ==================== 自动套利统计功能 ====================

let arbitrageStatsInterval = null;

/**
 * 启动套利统计更新
 */
function startArbitrageStatsUpdate() {
  if (arbitrageStatsInterval) {
    return; // 已经在运行
  }

  // 立即更新一次
  updateArbitrageStats();

  // 每 10 秒更新一次
  arbitrageStatsInterval = setInterval(() => {
    updateArbitrageStats();
  }, 10000);

  logger.debug('套利统计更新已启动');
}

/**
 * 停止套利统计更新
 */
function stopArbitrageStatsUpdate() {
  if (arbitrageStatsInterval) {
    clearInterval(arbitrageStatsInterval);
    arbitrageStatsInterval = null;
    logger.debug('套利统计更新已停止');
  }
}

/**
 * 更新套利统计显示
 */
async function updateArbitrageStats() {
  try {
    const statsList = document.getElementById('arbitrageStatsList');
    if (!statsList) {
      return;
    }

    // 获取套利统计指标
    const response = await fetch('http://localhost:3000/api/metrics/arbitrage');
    if (!response.ok) {
      throw new Error('获取套利统计失败');
    }

    const metrics = await response.json();

    // 构建统计显示
    let html = '';

    if (metrics && metrics.total) {
      const successRate = metrics.totalAttempts > 0
        ? ((metrics.successful / metrics.totalAttempts) * 100).toFixed(1)
        : '0.0';

      html += `
        <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="font-size: 12px;">总执行</span>
          <span style="font-weight: 600; color: #e0e7ff;">${metrics.totalAttempts || 0}</span>
        </div>
        <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="font-size: 12px;">成功</span>
          <span style="font-weight: 600; color: #34d399;">${metrics.successful || 0}</span>
        </div>
        <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="font-size: 12px;">成功率</span>
          <span style="font-weight: 600; color: ${successRate >= 70 ? '#34d399' : successRate >= 50 ? '#fbbf24' : '#f87171'};">${successRate}%</span>
        </div>
        <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid rgba(52, 211, 153, 0.2); margin-top: 8px; padding-top: 12px;">
          <span style="font-size: 12px;">预期利润</span>
          <span style="font-weight: 600; color: #34d399;">$${((metrics.totalProfit || 0)).toFixed(2)}</span>
        </div>
        <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="font-size: 12px;">扫描次数</span>
          <span style="font-weight: 600; color: #60a5fa;">${metrics.scans || 0}</span>
        </div>
        <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="font-size: 12px;">发现机会</span>
          <span style="font-weight: 600; color: #a78bfa;">${metrics.opportunities || 0}</span>
        </div>
      `;
    } else {
      html = '<div class="health-item" style="font-size: 12px; opacity: 0.7;">等待数据...</div>';
    }

    statsList.innerHTML = html;

  } catch (error) {
    // 如果 API 不可用，显示占位符
    const statsList = document.getElementById('arbitrageStatsList');
    if (statsList) {
      statsList.innerHTML = `
        <div class="health-item" style="font-size: 12px; opacity: 0.7;">
          📊 统计收集中...
        </div>
        <div class="health-item" style="font-size: 11px; opacity: 0.5; margin-top: 8px;">
          运行一段时间后将显示详细统计
        </div>
      `;
    }
  }
}
