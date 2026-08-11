/**
 * 🔥 ADVANCED TELEGRAM UTILITIES
 * Helper functions untuk operasi Telegram yang lebih kompleks
 */

import { TelegramClient, Api } from "telegram";

/**
 * 🌐 TELEGRAM DATA CENTER INFORMATION
 */
export const DC_INFO = {
  1: { location: "Miami, FL, USA", region: "Americas" },
  2: { location: "Amsterdam, Netherlands", region: "Europe" },
  3: { location: "Miami, FL, USA", region: "Americas" },
  4: { location: "Amsterdam, Netherlands", region: "Europe" },
  5: { location: "Singapore", region: "Asia-Pacific" },
} as const;

/**
 * 🎯 Get DC Information
 */
export function getDCInfo(dcId: number) {
  return DC_INFO[dcId as keyof typeof DC_INFO] || { 
    location: "Unknown", 
    region: "Unknown" 
  };
}

/**
 * 📊 Batch Message Fetcher dengan Progress Callback
 * Fetch messages dalam batch dengan monitoring progress
 */
export async function fetchMessagesWithProgress(
  client: TelegramClient,
  entity: any,
  options: {
    totalLimit: number;
    batchSize?: number;
    filter?: any;
    onProgress?: (current: number, total: number) => void;
  }
) {
  const batchSize = options.batchSize || 100;
  const allMessages: any[] = [];
  let offsetId = 0;
  let fetched = 0;

  while (fetched < options.totalLimit) {
    const limit = Math.min(batchSize, options.totalLimit - fetched);

    const messages = await client.getMessages(entity, {
      limit,
      offsetId,
      filter: options.filter,
    });

    if (messages.length === 0) break;

    allMessages.push(...messages);
    fetched += messages.length;
    offsetId = messages[messages.length - 1].id;

    if (options.onProgress) {
      options.onProgress(fetched, options.totalLimit);
    }

    // Jeda kecil untuk menghindari flood
    await new Promise((r) => setTimeout(r, 100));
  }

  return allMessages;
}

/**
 * 🔍 Smart Entity Resolver
 * Resolve entity dengan caching dan error handling
 */
const entityCache = new Map<string, { entity: any; timestamp: number }>();
const ENTITY_CACHE_TTL = 60 * 60 * 1000; // 1 jam

// Cleanup entity cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of entityCache.entries()) {
    if (now - value.timestamp > ENTITY_CACHE_TTL) {
      entityCache.delete(key);
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes

export async function resolveEntity(
  client: TelegramClient,
  identifier: string
): Promise<any> {
  // Check cache
  const cached = entityCache.get(identifier);
  if (cached && Date.now() - cached.timestamp < ENTITY_CACHE_TTL) {
    return cached.entity;
  }

  try {
    const entity = await client.getEntity(identifier);
    entityCache.set(identifier, { entity, timestamp: Date.now() });
    return entity;
  } catch (error: any) {
    // Cleanup cache on error
    entityCache.delete(identifier);
    throw error;
  }
}

/**
 * 📡 Network Quality Estimator
 * Estimate network quality berdasarkan latency
 */
export class NetworkQualityMonitor {
  private latencies: number[] = [];
  private readonly maxSamples = 10;

  recordLatency(latency: number): void {
    this.latencies.push(latency);
    if (this.latencies.length > this.maxSamples) {
      this.latencies.shift();
    }
  }

  getAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  getQuality(): "excellent" | "good" | "fair" | "poor" {
    const avg = this.getAverageLatency();
    if (avg < 100) return "excellent";
    if (avg < 300) return "good";
    if (avg < 600) return "fair";
    return "poor";
  }

  getSuggestedChunkSize(): number {
    const quality = this.getQuality();
    switch (quality) {
      case "excellent":
        return 512 * 1024; // 512KB
      case "good":
        return 256 * 1024; // 256KB
      case "fair":
        return 128 * 1024; // 128KB
      case "poor":
        return 64 * 1024; // 64KB
    }
  }
}

/**
 * 🎨 Media Type Detector
 */
export function detectMediaType(msg: any): {
  type: "photo" | "video" | "audio" | "document" | "sticker" | "voice" | "unknown";
  mimeType?: string;
  size?: number;
} {
  if (!msg.media) return { type: "unknown" };

  if (msg.media instanceof Api.MessageMediaPhoto) {
    return { type: "photo" };
  }

  if (msg.media instanceof Api.MessageMediaDocument) {
    const doc = msg.media.document as Api.Document;
    const mimeType = doc.mimeType;
    const size = doc.size.toJSNumber();

    if (mimeType.startsWith("video/")) {
      return { type: "video", mimeType, size };
    }
    if (mimeType.startsWith("audio/")) {
      return { type: "audio", mimeType, size };
    }
    if (mimeType.includes("webp") || mimeType.includes("tgs")) {
      return { type: "sticker", mimeType, size };
    }
    if (mimeType.includes("ogg") && size < 1024 * 1024) {
      return { type: "voice", mimeType, size };
    }

    return { type: "document", mimeType, size };
  }

  return { type: "unknown" };
}

/**
 * 🔐 Session Health Checker
 */
export async function checkSessionHealth(
  client: TelegramClient
): Promise<{
  healthy: boolean;
  user?: any;
  error?: string;
}> {
  try {
    const user = await client.getMe();
    return { healthy: true, user };
  } catch (error: any) {
    return { 
      healthy: false, 
      error: error.message 
    };
  }
}

/**
 * 📈 Performance Logger
 */
export class PerformanceLogger {
  private logs: Array<{
    operation: string;
    duration: number;
    timestamp: number;
    success: boolean;
  }> = [];

  async measure<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    let success = true;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - start;
      this.logs.push({
        operation,
        duration,
        timestamp: Date.now(),
        success,
      });

      // Keep only last 100 logs
      if (this.logs.length > 100) {
        this.logs.shift();
      }
    }
  }

  getStats() {
    const successLogs = this.logs.filter((l) => l.success);
    const failedLogs = this.logs.filter((l) => !l.success);

    return {
      total: this.logs.length,
      success: successLogs.length,
      failed: failedLogs.length,
      successRate: (successLogs.length / this.logs.length) * 100,
      avgDuration: successLogs.length > 0
        ? successLogs.reduce((a, b) => a + b.duration, 0) / successLogs.length
        : 0,
      slowestOperation: [...this.logs].sort((a, b) => b.duration - a.duration)[0],
    };
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * 🧮 Bandwidth Calculator
 */
export class BandwidthMonitor {
  private bytesTransferred = 0;
  private startTime = Date.now();

  recordTransfer(bytes: number): void {
    this.bytesTransferred += bytes;
  }

  getCurrentSpeed(): string {
    const elapsed = (Date.now() - this.startTime) / 1000; // seconds
    const bytesPerSecond = this.bytesTransferred / elapsed;
    return this.formatSpeed(bytesPerSecond);
  }

  getTotalTransferred(): string {
    return this.formatBytes(this.bytesTransferred);
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024)
      return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  reset(): void {
    this.bytesTransferred = 0;
    this.startTime = Date.now();
  }
}

// Singleton instances
export const networkMonitor = new NetworkQualityMonitor();
export const perfLogger = new PerformanceLogger();
export const bandwidthMonitor = new BandwidthMonitor();
