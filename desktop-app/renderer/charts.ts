/**
 * 实时图表模块
 * 使用 Canvas API 绘制轻量级实时图表
 */

export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export interface ChartConfig {
  maxPoints: number;
  lineColor: string;
  fillColor: string;
  gridColor: string;
  showGrid: boolean;
  showPoints: boolean;
  autoScale: boolean;
  minY: number;
  maxY: number;
}

/**
 * 轻量级折线图
 */
export class LineChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: ChartDataPoint[] = [];
  private config: ChartConfig;

  constructor(canvas: HTMLCanvasElement, config?: Partial<ChartConfig>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取 Canvas 上下文');
    }
    this.ctx = ctx;

    this.config = {
      maxPoints: 100,
      lineColor: '#10b981',
      fillColor: 'rgba(16, 185, 129, 0.1)',
      gridColor: 'rgba(255, 255, 255, 0.1)',
      showGrid: true,
      showPoints: false,
      autoScale: true,
      minY: -50,
      maxY: 50,
      ...config,
    };

    this.init();
  }

  /**
   * 初始化
   */
  private init(): void {
    // 设置 Canvas 尺寸
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 初始绘制
    this.draw();
  }

  /**
   * 添加数据点
   */
  addDataPoint(value: number): void {
    this.data.push({
      timestamp: Date.now(),
      value,
    });

    // 限制数据点数量
    if (this.data.length > this.config.maxPoints) {
      this.data.shift();
    }

    this.draw();
  }

  /**
   * 设置多个数据点
   */
  setData(data: ChartDataPoint[]): void {
    this.data = data.slice(-this.config.maxPoints);
    this.draw();
  }

  /**
   * 清空数据
   */
  clear(): void {
    this.data = [];
    this.draw();
  }

  /**
   * 绘制图表
   */
  private draw(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 计算Y轴范围
    let minY: number;
    let maxY: number;

    if (this.config.autoScale && this.data.length > 0) {
      const values = this.data.map(d => d.value);
      minY = Math.min(...values);
      maxY = Math.max(...values);
      const padding = (maxY - minY) * 0.1;
      minY -= padding;
      maxY += padding;
    } else {
      minY = this.config.minY;
      maxY = this.config.maxY;
    }

    const range = maxY - minY || 1;

    // 绘制网格
    if (this.config.showGrid) {
      this.drawGrid(ctx, width, height, minY, maxY, range);
    }

    // 绘制数据
    if (this.data.length < 2) {
      return;
    }

    // 转换数据坐标
    const points = this.data.map((d, i) => {
      const x = (i / (this.data.length - 1)) * width;
      const y = height - ((d.value - minY) / range) * height;
      return { x, y };
    });

    // 绘制填充区域
    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    for (const p of points) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = this.config.fillColor;
    ctx.fill();

    // 绘制线条
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = this.config.lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制数据点
    if (this.config.showPoints) {
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.config.lineColor;
        ctx.fill();
      }
    }

    // 绘制最新值标签
    const lastPoint = points[points.length - 1];
    const lastValue = this.data[this.data.length - 1].value;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(lastValue.toFixed(2), width - 5, 15);
  }

  /**
   * 绘制网格
   */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    minY: number,
    maxY: number,
    range: number
  ): void {
    ctx.strokeStyle = this.config.gridColor;
    ctx.lineWidth = 1;

    // 水平线
    const hLines = 5;
    for (let i = 0; i <= hLines; i++) {
      const y = (i / hLines) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Y轴标签
      const value = maxY - (i / hLines) * range;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(value.toFixed(1), 5, y + 3);
    }

    // 垂直线
    const vLines = 10;
    for (let i = 0; i <= vLines; i++) {
      const x = (i / vLines) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 零线
    if (minY < 0 && maxY > 0) {
      const zeroY = height - ((0 - minY) / range) * height;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ChartConfig>): void {
    this.config = { ...this.config, ...config };
    this.draw();
  }

  /**
   * 获取数据
   */
  getData(): ChartDataPoint[] {
    return [...this.data];
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.data = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

/**
 * PnL 图表管理器
 */
export class PnLChartManager {
  private chart?: LineChart;
  private history: number[] = [];

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      this.chart = new LineChart(canvas, {
        lineColor: '#10b981', // 绿色
        fillColor: 'rgba(16, 185, 129, 0.1)',
        maxPoints: 60, // 显示最近60个点
        autoScale: true,
        showGrid: true,
      });
    }
  }

  /**
   * 更新PnL
   */
  updatePnL(pnl: number): void {
    if (!this.chart) return;

    this.history.push(pnl);
    if (this.history.length > 100) {
      this.history.shift();
    }

    this.chart.addDataPoint(pnl);
  }

  /**
   * 清空数据
   */
  clear(): void {
    if (!this.chart) return;
    this.history = [];
    this.chart.clear();
  }

  /**
   * 获取统计
   */
  getStats(): {
    current: number;
    min: number;
    max: number;
    avg: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
  } {
    if (this.history.length === 0) {
      return { current: 0, min: 0, max: 0, avg: 0, trend: 'FLAT' };
    }

    const current = this.history[this.history.length - 1];
    const min = Math.min(...this.history);
    const max = Math.max(...this.history);
    const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length;

    let trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    if (this.history.length >= 10) {
      const recent = this.history.slice(-10);
      const older = this.history.slice(-20, -10);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      if (recentAvg > olderAvg * 1.01) trend = 'UP';
      else if (recentAvg < olderAvg * 0.99) trend = 'DOWN';
    }

    return { current, min, max, avg, trend };
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
    this.history = [];
  }
}

// 创建全局单例（将在renderer.js中初始化）
export let pnlChartManager: PnLChartManager | null = null;

export function initPnLChart(): void {
  pnlChartManager = new PnLChartManager('pnlChart');
}

// 自动初始化（在DOM加载完成后）
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initPnLChart();
    });
  } else {
    initPnLChart();
  }
}

// 导出全局函数供renderer.js调用
(window as any).updatePnLChart = (pnl: number) => {
  if (pnlChartManager) {
    pnlChartManager.updatePnL(pnl);
  }
};

(window as any).getPnLChartStats = () => {
  if (pnlChartManager) {
    return pnlChartManager.getStats();
  }
  return null;
};
