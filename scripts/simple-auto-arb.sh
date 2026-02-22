#!/bin/bash

# 简易自动套利机器人启动脚本
# 自动检测套利机会并执行

echo "=========================================="
echo "🤖 简易自动套利机器人"
echo "=========================================="
echo ""
echo "配置信息:"
echo "  模式: ${AUTO_BOT_MODE:-模拟}"
echo "  最小利润: ${AUTO_BOT_MIN_PROFIT:-2}%"
echo "  扫描间隔: ${AUTO_BOT_SCAN_INTERVAL:-10}秒"
echo ""
echo "开始运行..."
echo "按 Ctrl+C 停止"
echo "=========================================="
echo ""

# 设置默认值
export AUTO_BOT_MODE=${AUTO_BOT_MODE:-DRY_RUN}
export AUTO_BOT_MIN_PROFIT=${AUTO_BOT_MIN_PROFIT:-0.02}
export AUTO_BOT_SCAN_INTERVAL=${AUTO_BOT_SCAN_INTERVAL:-10}

# 循环运行
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 扫描套利机会..."

  # 运行套利机器人（单次检测）
  npm run start:arb

  # 等待下一次扫描
  echo ""
  echo "⏳ 等待 ${AUTO_BOT_SCAN_INTERVAL} 秒后继续..."
  sleep ${AUTO_BOT_SCAN_INTERVAL}
done
