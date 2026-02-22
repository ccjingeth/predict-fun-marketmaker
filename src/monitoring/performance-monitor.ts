/**
 * 性能监控模块 (APM)
 * 实时追踪关键性能指标和资源使用
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PerformanceStats {
  cpuUsage: number;
  memoryUsage: number;
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export interface APMConfig {
  enabled: boolean;
  sampleRate: number;
  maxMetrics: number;
  alertThresholds: {
    cpu: number;
    memory: number;
    eventLoopDelay: number;
  };
}

/**
 * 性能监控器类
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private histograms = new Map<string, number[]>();
  private config: APMConfig;
  private startTime = Date.now();
  private timer?: NodeJS.Timeout;

  constructor(config?: Partial<APMConfig>) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      maxMetrics: 10000,
      alertThresholds: {
        cpu: 80, // 80%
        memory: 80, // 80%
        eventLoopDelay: 100, // 100ms
      },
      ...config,
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * 记录指标
   */
  recordMetric(name: string, value: number, unit: string = '', tags?: Record<string, string>): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // 维护最大指标数
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift();
    }

    // 更新直方图
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    const histogram = this.histograms.get(name)!;
    histogram.push(value);
    if (histogram.length > 1000) {
      histogram.shift();
    }
  }

  /**
   * 记录操作耗时
   */
  async recordOperation<T>(
    name: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.recordMetric(`${name}.duration`, duration, 'ms', { ...tags, success: 'true' });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric(`${name}.duration`, duration, 'ms', { ...tags, success: 'false' });
      this.recordMetric(`${name}.errors`, 1, 'count', tags);
      throw error;
    }
  }

  /**
   * 记录操作耗时（同步）
   */
  recordOperationSync<T>(
    name: string,
    operation: () => T,
    tags?: Record<string, string>
  ): T {
    const start = Date.now();
    try {
      const result = operation();
      const duration = Date.now() - start;
      this.recordMetric(`${name}.duration`, duration, 'ms', { ...tags, success: 'true' });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric(`${name}.duration`, duration, 'ms', { ...tags, success: 'false' });
      this.recordMetric(`${name}.errors`, 1, 'count', tags);
      throw error;
    }
  }

  /**
   * 获取统计数据
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.length === 0) {
      return null;
    }

    const sorted = [...histogram].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / count;

    return {
      count,
      min,
      max,
      avg,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * 获取系统性能状态
   */
  getSystemStats(): PerformanceStats {
    const memory = process.memoryUsage();
    const hrtime = process.hrtime();

    return {
      cpuUsage: 0, // 需要持续监控才能计算
      memoryUsage: (memory.heapUsed / memory.heapTotal) * 100,
      eventLoopDelay: 0, // 需要专门的延迟检测
      activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
      activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
    };
  }

  /**
   * 检查告警条件
   */
  checkAlerts(): string[] {
    const alerts: string[] = [];
    const stats = this.getSystemStats();

    if (stats.memoryUsage > this.config.alertThresholds.memory) {
      alerts.push(`High memory usage: ${stats.memoryUsage.toFixed(1)}%`);
    }

    return alerts;
  }

  /**
   * 获取最近指标
   */
  getRecentMetrics(
    name?: string,
    duration: number = 60000
  ): PerformanceMetric[] {
    const now = Date.now();
    const cutoff = now - duration;

    return this.metrics.filter(
      m => (!name || m.name === name) && m.timestamp >= cutoff
    );
  }

  /**
   * 获取聚合统计
   */
  getAggregatedMetrics(duration: number = 60000): Record<string, {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  }> {
    const recent = this.getRecentMetrics(undefined, duration);
    const aggregated: Record<string, any> = {};

    for (const metric of recent) {
      if (!aggregated[metric.name]) {
        aggregated[metric.name] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const agg = aggregated[metric.name];
      agg.count++;
      agg.sum += metric.value;
      agg.min = Math.min(agg.min, metric.value);
      agg.max = Math.max(agg.max, metric.value);
    }

    // 计算平均值
    for (const key in aggregated) {
      aggregated[key].avg = aggregated[key].sum / aggregated[key].count;
    }

    return aggregated;
  }

  /**
   * 清除旧指标
   */
  cleanup(maxAge: number = 3600000): void {
    const cutoff = Date.now() - maxAge;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * 重置所有数据
   */
  reset(): void {
    this.metrics = [];
    this.histograms.clear();
    this.startTime = Date.now();
  }

  /**
   * 导出指标
   */
  export(): {
    uptime: number;
    metrics: PerformanceMetric[];
    stats: Record<string, any>;
  } {
    return {
      uptime: Date.now() - this.startTime,
      metrics: this.metrics,
      stats: this.getAggregatedMetrics(),
    };
  }

  /**
   * 开始监控
   */
  private startMonitoring(): void {
    // 每秒收集系统指标
    this.timer = setInterval(() => {
      const stats = this.getSystemStats();
      this.recordMetric('system.memory_used', stats.heapUsed, 'bytes');
      this.recordMetric('system.memory_total', stats.heapTotal, 'bytes');
      this.recordMetric('system.memory_usage_pct', stats.memoryUsage, '%');
      this.recordMetric('system.active_handles', stats.activeHandles, 'count');
      this.recordMetric('system.active_requests', stats.activeRequests, 'count');

      // 检查告警
      const alerts = this.checkAlerts();
      for (const alert of alerts) {
        this.recordMetric('alert', 1, 'count', { message: alert });
      }
    }, 1000);
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

// 创建全局单例
export const performanceMonitor = new PerformanceMonitor();
