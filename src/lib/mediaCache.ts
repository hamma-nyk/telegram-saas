/**
 * 🚀 ADVANCED MEDIA CACHE SYSTEM
 * 
 * Fitur:
 * - In-Memory LRU Cache untuk media yang sering diakses
 * - Metadata caching untuk menghindari repeated getMessages
 * - Smart eviction policy
 * - Memory usage monitoring
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

export class MediaCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly maxAge: number;
  private currentSize: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    maxSizeMB: number = 50, // Default 50MB cache
    maxAgeMs: number = 30 * 60 * 1000 // Default 30 menit
  ) {
    this.maxSize = maxSizeMB * 1024 * 1024;
    this.maxAge = maxAgeMs;

    // Periodic cleanup (fixed memory leak)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 🔍 Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  /**
   * 💾 Set item to cache
   */
  set(key: string, data: T, size?: number): void {
    // Estimate size jika tidak diberikan
    const estimatedSize = size || this.estimateSize(data);

    // Evict jika cache penuh
    while (this.currentSize + estimatedSize > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    // Jika item terlalu besar, jangan cache
    if (estimatedSize > this.maxSize * 0.3) {
      console.warn(`Item too large to cache: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Delete old entry if exists
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      size: estimatedSize,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    this.currentSize += estimatedSize;
  }

  /**
   * 🗑️ Delete item from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.currentSize -= entry.size;
    return this.cache.delete(key);
  }

  /**
   * 🧹 Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.delete(key);
    }

    console.log(`🧹 Cache cleanup: removed ${toDelete.length} expired entries`);
  }

  /**
   * 🎯 LRU Eviction
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruScore = Infinity;

    // Score = lastAccessed / accessCount (semakin kecil = semakin jarang diakses)
    for (const [key, entry] of this.cache.entries()) {
      const score = entry.lastAccessed / (entry.accessCount + 1);
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
    }
  }

  /**
   * 📊 Estimate data size (conservative approximation)
   */
  private estimateSize(data: any): number {
    if (Buffer.isBuffer(data)) {
      return data.length;
    }

    if (typeof data === "string") {
      return data.length * 2; // UTF-16
    }

    if (typeof data === "object") {
      // Conservative estimate: JSON length * 10 for object overhead
      try {
        return JSON.stringify(data).length * 10;
      } catch (e) {
        // Circular reference or large object
        return 10 * 1024 * 1024; // Assume 10MB
      }
    }

    return 1024; // Default 1KB
  }

  /**
   * 📈 Get cache stats
   */
  getStats() {
    return {
      entries: this.cache.size,
      sizeMB: (this.currentSize / 1024 / 1024).toFixed(2),
      maxSizeMB: (this.maxSize / 1024 / 1024).toFixed(2),
      utilizationPercent: ((this.currentSize / this.maxSize) * 100).toFixed(2),
    };
  }

  /**
   * 🧨 Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * 🛑 Destroy cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instances
export const metadataCache = new MediaCache<any>(10, 15 * 60 * 1000); // 10MB, 15 menit
export const thumbnailCache = new MediaCache<Buffer>(30, 60 * 60 * 1000); // 30MB, 1 jam

/**
 * 🎯 SMART CACHE KEY GENERATOR
 */
export function generateCacheKey(
  userId: string,
  channelId: string,
  messageId: number,
  type: "metadata" | "thumbnail" | "full" = "metadata"
): string {
  return `${type}:${userId}:${channelId}:${messageId}`;
}
