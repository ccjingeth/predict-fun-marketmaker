/**
 * 智能错误恢复模块
 * 自动检测、分类和恢复错误
 */

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  MARKET_CLOSED = 'MARKET_CLOSED',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ErrorInfo {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  timestamp: number;
  count: number;
  lastOccurrence: number;
  context?: Record<string, any>;
  recoveryAttempts: number;
  recovered: boolean;
}

export interface RecoveryStrategy {
  category: ErrorCategory;
  maxAttempts: number;
  retryDelay: number;
  backoffMultiplier: number;
  canRecover: (error: Error) => boolean;
  recover: (error: Error, context?: any) => Promise<void>;
}

/**
 * 智能错误恢复器
 */
export class SmartErrorRecovery {
  private errors = new Map<string, ErrorInfo>();
  private strategies = new Map<ErrorCategory, RecoveryStrategy>();
  private errorPatterns: Array<{ pattern: RegExp; category: ErrorCategory }> = [];

  constructor() {
    this.initializePatterns();
    this.initializeStrategies();
  }

  /**
   * 初始化错误模式
   */
  private initializePatterns(): void {
    this.errorPatterns = [
      { pattern: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network/i, category: ErrorCategory.NETWORK },
      { pattern: /429|rate limit|too many requests/i, category: ErrorCategory.RATE_LIMIT },
      { pattern: /401|403|unauthorized|forbidden/i, category: ErrorCategory.API },
      { pattern: /400|validation|invalid/i, category: ErrorCategory.VALIDATION },
      { pattern: /insufficient|balance|funds/i, category: ErrorCategory.INSUFFICIENT_BALANCE },
      { pattern: /closed|inactive|suspended/i, category: ErrorCategory.MARKET_CLOSED },
    ];
  }

  /**
   * 初始化恢复策略
   */
  private initializeStrategies(): void {
    // 网络错误策略
    this.strategies.set(ErrorCategory.NETWORK, {
      category: ErrorCategory.NETWORK,
      maxAttempts: 5,
      retryDelay: 2000,
      backoffMultiplier: 2,
      canRecover: () => true,
      recover: async (error) => {
        // 等待后重试
        await this.sleep(2000);
      },
    });

    // 速率限制策略
    this.strategies.set(ErrorCategory.RATE_LIMIT, {
      category: ErrorCategory.RATE_LIMIT,
      maxAttempts: 3,
      retryDelay: 60000, // 1分钟
      backoffMultiplier: 1,
      canRecover: () => true,
      recover: async () => {
        // 等待更长时间
        await this.sleep(60000);
      },
    });

    // API错误策略
    this.strategies.set(ErrorCategory.API, {
      category: ErrorCategory.API,
      maxAttempts: 2,
      retryDelay: 5000,
      backoffMultiplier: 1.5,
      canRecover: (error) => {
        // 只重试临时性错误
        const msg = error.message.toLowerCase();
        return msg.includes('temporarily') || msg.includes('unavailable');
      },
      recover: async () => {
        await this.sleep(5000);
      },
    });

    // 余额不足策略
    this.strategies.set(ErrorCategory.INSUFFICIENT_BALANCE, {
      category: ErrorCategory.INSUFFICIENT_BALANCE,
      maxAttempts: 1,
      retryDelay: 0,
      backoffMultiplier: 1,
      canRecover: () => false,
      recover: async () => {
        // 无法自动恢复，需要用户介入
        throw new Error('Insufficient balance, please add funds');
      },
    });

    // 市场关闭策略
    this.strategies.set(ErrorCategory.MARKET_CLOSED, {
      category: ErrorCategory.MARKET_CLOSED,
      maxAttempts: 1,
      retryDelay: 0,
      backoffMultiplier: 1,
      canRecover: () => false,
      recover: async () => {
        // 市场已关闭，停止交易
        throw new Error('Market is closed');
      },
    });
  }

  /**
   * 分类错误
   */
  categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    for (const { pattern, category } of this.errorPatterns) {
      if (pattern.test(message)) {
        return category;
      }
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * 确定错误严重程度
   */
  determineSeverity(category: ErrorCategory, error: Error): ErrorSeverity {
    switch (category) {
      case ErrorCategory.INSUFFICIENT_BALANCE:
      case ErrorCategory.MARKET_CLOSED:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.RATE_LIMIT:
        return ErrorSeverity.HIGH;
      case ErrorCategory.NETWORK:
      case ErrorCategory.API:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * 处理错误
   */
  async handleError(error: Error, context?: Record<string, any>): Promise<ErrorInfo> {
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(category, error);

    // 生成错误ID
    const errorId = this.generateErrorId(category, error.message);

    // 获取或创建错误信息
    let errorInfo = this.errors.get(errorId);
    if (!errorInfo) {
      errorInfo = {
        id: errorId,
        category,
        severity,
        message: error.message,
        timestamp: Date.now(),
        count: 0,
        lastOccurrence: 0,
        context,
        recoveryAttempts: 0,
        recovered: false,
      };
    }

    // 更新错误信息
    errorInfo.count++;
    errorInfo.lastOccurrence = Date.now();
    if (context) {
      errorInfo.context = { ...errorInfo.context, ...context };
    }

    this.errors.set(errorId, errorInfo);

    // 尝试恢复
    await this.attemptRecovery(errorInfo, error);

    return errorInfo;
  }

  /**
   * 尝试恢复
   */
  private async attemptRecovery(errorInfo: ErrorInfo, error: Error): Promise<void> {
    const strategy = this.strategies.get(errorInfo.category);
    if (!strategy) {
      return;
    }

    // 检查是否可以恢复
    if (!strategy.canRecover(error)) {
      return;
    }

    // 检查重试次数
    if (errorInfo.recoveryAttempts >= strategy.maxAttempts) {
      return;
    }

    errorInfo.recoveryAttempts++;

    try {
      // 计算延迟
      const delay = strategy.retryDelay * Math.pow(strategy.backoffMultiplier, errorInfo.recoveryAttempts - 1);
      await this.sleep(delay);

      // 执行恢复
      await strategy.recover(error, errorInfo.context);

      errorInfo.recovered = true;
    } catch (recoveryError) {
      // 恢复失败，记录但不抛出
      console.error(`Recovery failed for ${errorInfo.id}:`, recoveryError);
    }
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(category: ErrorCategory, message: string): string {
    // 使用消息的前100个字符作为ID基础
    const base = message.substring(0, 100).replace(/\s+/g, '_');
    const hash = this.simpleHash(base);
    return `${category}_${hash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * 获取错误信息
   */
  getErrorInfo(errorId: string): ErrorInfo | undefined {
    return this.errors.get(errorId);
  }

  /**
   * 获取所有错误
   */
  getAllErrors(): ErrorInfo[] {
    return Array.from(this.errors.values()).sort((a, b) => b.lastOccurrence - a.lastOccurrence);
  }

  /**
   * 获取未恢复的错误
   */
  getUnrecoveredErrors(): ErrorInfo[] {
    return this.getAllErrors().filter(e => !e.recovered);
  }

  /**
   * 获取关键错误
   */
  getCriticalErrors(): ErrorInfo[] {
    return this.getAllErrors().filter(e => e.severity === ErrorSeverity.CRITICAL);
  }

  /**
   * 清除旧错误
   */
  clearOldErrors(maxAge: number = 3600000): void {
    const cutoff = Date.now() - maxAge;

    for (const [id, error] of this.errors.entries()) {
      if (error.lastOccurrence < cutoff && error.recovered) {
        this.errors.delete(id);
      }
    }
  }

  /**
   * 清除所有错误
   */
  clearAllErrors(): void {
    this.errors.clear();
  }

  /**
   * 获取错误统计
   */
  getStats(): {
    totalErrors: number;
    unrecoveredErrors: number;
    criticalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  } {
    const errors = this.getAllErrors();
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    for (const error of errors) {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    }

    return {
      totalErrors: errors.length,
      unrecoveredErrors: errors.filter(e => !e.recovered).length,
      criticalErrors: errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
      errorsByCategory,
      errorsBySeverity,
    };
  }

  /**
   * 添加自定义策略
   */
  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.category, strategy);
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建全局单例
export const smartErrorRecovery = new SmartErrorRecovery();
