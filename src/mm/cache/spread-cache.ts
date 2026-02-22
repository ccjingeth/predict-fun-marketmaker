/**
 * 价差缓存模块
 * 用于减少重复计算，提高做市商性能
 */

interface SpreadCacheEntry {
  spread: number;
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  timestamp: number;
  hash: string;
}

interface CacheConfig {
  maxAge: number; // 缓存最大有效期（毫秒）
  maxSize: number; // 最大缓存条目数
  enableHash: boolean; // 是否启用哈希验证
}

/**
 * 价差缓存类
 */
export class SpreadCache {
  private cache = new Map<string, SpreadCacheEntry>();
  private hits = 0;
  private misses = 0;
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxAge: 1000, // 默认1秒
      maxSize: 1000, // 默认1000条
      enableHash: true,
      ...config,
    };
  }

  /**
   * 生成缓存键
   */
  private generateKey(
    tokenId: string,
    orderbookHash: string,
    volEma: number,
    depthEma: number,
    inventoryBias: number
  ): string {
    const parts = [
      tokenId,
      orderbookHash,
      volEma.toFixed(4),
      depthEma.toFixed(4),
      inventoryBias.toFixed(4),
    ];
    return parts.join('|');
  }

  /**
   * 生成订单簿哈希
   */
  private generateOrderbookHash(bidPrice: number, askPrice: number, bidSize: number, askSize: number): string {
    if (!this.config.enableHash) {
      return 'no-hash';
    }
    // 使用简单的哈希算法
    const str = `${bidPrice.toFixed(6)}-${askPrice.toFixed(6)}-${bidSize.toFixed(2)}-${askSize.toFixed(2)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取缓存条目
   */
  get(
    tokenId: string,
    orderbookHash: string,
    volEma: number,
    depthEma: number,
    inventoryBias: number
  ): SpreadCacheEntry | null {
    const key = this.generateKey(tokenId, orderbookHash, volEma, depthEma, inventoryBias);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry;
  }

  /**
   * 设置缓存条目
   */
  set(
    tokenId: string,
    orderbookHash: string,
    volEma: number,
    depthEma: number,
    inventoryBias: number,
    spread: number,
    bidPrice: number,
    askPrice: number,
    midPrice: number
  ): void {
    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const key = this.generateKey(tokenId, orderbookHash, volEma, depthEma, inventoryBias);
    const entry: SpreadCacheEntry = {
      spread,
      bidPrice,
      askPrice,
      midPrice,
      timestamp: Date.now(),
      hash: orderbookHash,
    };

    this.cache.set(key, entry);
  }

  /**
   * 便捷方法：通过订单簿数据获取或计算价差
   */
  getOrCompute(
    tokenId: string,
    bidPrice: number,
    askPrice: number,
    bidSize: number,
    askSize: number,
    volEma: number,
    depthEma: number,
    inventoryBias: number,
    computeFn: () => { spread: number; midPrice: number }
  ): { spread: number; bidPrice: number; askPrice: number; midPrice: number; cached: boolean } {
    const orderbookHash = this.generateOrderbookHash(bidPrice, askPrice, bidSize, askSize);
    const cached = this.get(tokenId, orderbookHash, volEma, depthEma, inventoryBias);

    if (cached) {
      return {
        spread: cached.spread,
        bidPrice: cached.bidPrice,
        askPrice: cached.askPrice,
        midPrice: cached.midPrice,
        cached: true,
      };
    }

    // 计算新值
    const computed = computeFn();
    this.set(
      tokenId,
      orderbookHash,
      volEma,
      depthEma,
      inventoryBias,
      computed.spread,
      bidPrice,
      askPrice,
      computed.midPrice
    );

    return {
      spread: computed.spread,
      bidPrice,
      askPrice,
      midPrice: computed.midPrice,
      cached: false,
    };
  }

  /**
   * 清除指定token的缓存
   */
  clearToken(tokenId: string): void {
    const prefix = tokenId + '|';
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 清除过期缓存
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.maxAge) {
        this.cache.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  /**
   * 淘汰最旧的缓存条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    // 如果maxSize减小，可能需要清理缓存
    if (this.cache.size > this.config.maxSize) {
      while (this.cache.size > this.config.maxSize) {
        this.evictOldest();
      }
    }
  }
}

// 创建全局单例
export const spreadCache = new SpreadCache();
