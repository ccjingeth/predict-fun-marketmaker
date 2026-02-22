/**
 * Cache Management System
 * 缓存管理系统 - 智能缓存订单簿、市场数据和计算结果
 */

/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // Time to live (毫秒)
  hits: number;
  size: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalSize: number;
  evictions: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  maxSize: number;          // 最大缓存条目数
  defaultTTL: number;        // 默认 TTL (毫秒)
  cleanupInterval: number;   // 清理间隔 (毫秒)
  enableCompression: boolean; // 启用压缩
  enableStats: boolean;      // 启用统计
}

/**
 * 智能缓存管理器
 */
export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats = {
    totalEntries: 0,
    totalHits: 0,
    totalMisses: 0,
    hitRate: 0,
    totalSize: 0,
    evictions: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 60000, // 1 分钟
      cleanupInterval: 30000, // 30 秒
      enableCompression: false,
      enableStats: true,
      ...config,
    };

    // 启动定期清理
    this.startCleanup();
  }

  /**
   * 设置缓存
   */
  set(key: string, value: T, ttl?: number): void {
    // 检查缓存大小
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      hits: 0,
      size: this.estimateSize(value),
    };

    this.cache.set(key, entry);

    if (this.config.enableStats) {
      this.stats.totalEntries = this.cache.size;
      this.stats.totalSize += entry.size;
    }
  }

  /**
   * 获取缓存
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableStats) {
        this.stats.totalMisses++;
        this.updateHitRate();
      }
      return null;
    }

    // 检查 TTL
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      if (this.config.enableStats) {
        this.stats.totalMisses++;
        this.updateHitRate();
      }
      return null;
    }

    // 更新命中
    if (this.config.enableStats) {
      this.stats.totalHits++;
      entry.hits++;
      this.updateHitRate();
    }

    return entry.value;
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查 TTL
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      if (this.config.enableStats) {
        this.stats.totalSize -= entry.size;
        this.stats.totalEntries = this.cache.size - 1;
      }
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    if (this.config.enableStats) {
      this.stats.totalEntries = 0;
      this.stats.totalSize = 0;
    }
  }

  /**
   * 获取或设置（缓存未命中时使用函数计算）
   */
  async getOrSet(key: string, factory: () => T | Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // 计算值
    const value = await factory();
    this.set(key, value, ttl);

    return value;
  }

  /**
   * 批量获取
   */
  getBatch(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * 批量设置
   */
  setBatch(entries: Map<string, T>, ttl?: number): void {
    for (const [key, value] of entries.entries()) {
      this.set(key, value, ttl);
    }
  }

  /**
   * 删除匹配模式的键
   */
  deletePattern(pattern: RegExp): number {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * LRU 淘汰
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let oldestHits = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // 优先淘汰命中次数少的旧条目
      const score = entry.timestamp + entry.hits * 1000;
      if (score < oldestTime || (score === oldestTime && entry.hits < oldestHits)) {
        oldestKey = key;
        oldestTime = score;
        oldestHits = entry.hits;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      if (this.config.enableStats) {
        this.stats.evictions++;
      }
    }
  }

  /**
   * 估算大小
   */
  private estimateSize(value: any): number {
    if (value === null || value === undefined) return 0;

    // 简单估算：JSON 字符串长度
    try {
      return JSON.stringify(value).length * 2; // 每个字符 2 字节（UTF-16）
    } catch {
      return 100; // 默认大小
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? this.stats.totalHits / total : 0;
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    if (keysToDelete.length > 0 && this.config.enableStats) {
      this.stats.evictions += keysToDelete.length;
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取所有值
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * 打印统计信息
   */
  printStats(): void {
    console.log('\n📦 缓存统计:');
    console.log(`   总条目: ${this.stats.totalEntries}`);
    console.log(`   命中: ${this.stats.totalHits}`);
    console.log(`   未命中: ${this.stats.totalMisses}`);
    console.log(`   命中率: ${(this.stats.hitRate * 100).toFixed(1)}%`);
    console.log(`   总大小: ${(this.stats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`   淘汰数: ${this.stats.evictions}`);
  }
}

/**
 * 专用缓存类型
 */

// 订单簿缓存
let orderbookCache: CacheManager<any> | null = null;

export function getOrderbookCache(): CacheManager<any> {
  if (!orderbookCache) {
    orderbookCache = new CacheManager<any>({
      maxSize: 500,
      defaultTTL: 1000, // 1 秒
      cleanupInterval: 10000,
    });
  }
  return orderbookCache;
}

// 市场数据缓存
let marketDataCache: CacheManager<any> | null = null;

export function getMarketDataCache(): CacheManager<any> {
  if (!marketDataCache) {
    marketDataCache = new CacheManager<any>({
      maxSize: 1000,
      defaultTTL: 5000, // 5 秒
      cleanupInterval: 30000,
    });
  }
  return marketDataCache;
}

// 计算结果缓存
let computationCache: CacheManager<any> | null = null;

export function getComputationCache(): CacheManager<any> {
  if (!computationCache) {
    computationCache = new CacheManager<any>({
      maxSize: 2000,
      defaultTTL: 30000, // 30 秒
      cleanupInterval: 60000,
    });
  }
  return computationCache;
}

// 套利机会缓存
let arbitrageCache: CacheManager<any> | null = null;

export function getArbitrageCache(): CacheManager<any> {
  if (!arbitrageCache) {
    arbitrageCache = new CacheManager<any>({
      maxSize: 100,
      defaultTTL: 10000, // 10 秒
      cleanupInterval: 20000,
    });
  }
  return arbitrageCache;
}

/**
 * 缓存键生成器
 */
export class CacheKeyGenerator {
  static orderbook(marketId: string): string {
    return `orderbook:${marketId}`;
  }

  static marketData(marketId: string): string {
    return `marketData:${marketId}`;
  }

  static arbitrage(marketId: string, type: string): string {
    return `arbitrage:${type}:${marketId}`;
  }

  static scoring(opportunityId: string): string {
    return `scoring:${opportunityId}`;
  }

  static prediction(marketId: string, timestamp: number): string {
    return `prediction:${marketId}:${timestamp}`;
  }

  static route(opportunityId: string, size: number): string {
    return `route:${opportunityId}:${size}`;
  }
}

/**
 * 缓存预热器
 */
export class CacheWarmer {
  /**
   * 预热订单簿缓存
   */
  static async warmupOrderbooks(marketIds: string[], fetchFn: (marketId: string) => Promise<any>): Promise<void> {
    const cache = getOrderbookCache();

    const promises = marketIds.map(async (marketId) => {
      const key = CacheKeyGenerator.orderbook(marketId);
      if (!cache.has(key)) {
        const data = await fetchFn(marketId);
        cache.set(key, data);
      }
    });

    await Promise.all(promises);
  }

  /**
   * 预热市场数据缓存
   */
  static async warmupMarketData(marketIds: string[], fetchFn: (marketId: string) => Promise<any>): Promise<void> {
    const cache = getMarketDataCache();

    const promises = marketIds.map(async (marketId) => {
      const key = CacheKeyGenerator.marketData(marketId);
      if (!cache.has(key)) {
        const data = await fetchFn(marketId);
        cache.set(key, data);
      }
    });

    await Promise.all(promises);
  }
}

/**
 * 全局缓存统计
 */
export function printAllCacheStats(): void {
  console.log('\n' + '='.repeat(60));
  console.log('🗄️  全局缓存统计');
  console.log('='.repeat(60));

  const caches = [
    { name: '订单簿缓存', cache: getOrderbookCache() },
    { name: '市场数据缓存', cache: getMarketDataCache() },
    { name: '计算结果缓存', cache: getComputationCache() },
    { name: '套利机会缓存', cache: getArbitrageCache() },
  ];

  for (const { name, cache } of caches) {
    console.log(`\n${name}:`);
    cache.printStats();
  }

  console.log('\n' + '='.repeat(60));
}
