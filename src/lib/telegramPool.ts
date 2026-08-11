/**
 * 🔥 TELEGRAM CONNECTION POOL MANAGER
 * Mengelola koneksi ke berbagai Data Center Telegram secara efisien
 * 
 * Fitur:
 * - Connection Pooling untuk reuse koneksi
 * - Auto DC Detection & Routing
 * - Exponential Backoff Retry
 * - Flood Wait Handler
 * - Memory Leak Prevention
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

interface PooledConnection {
  client: TelegramClient;
  lastUsed: number;
  inUse: boolean;
  dcId?: number;
}

class TelegramConnectionPool {
  private pool: Map<string, PooledConnection[]> = new Map();
  private readonly MAX_POOL_SIZE = 3;
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 menit
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Jalankan cleanup otomatis setiap 2 menit
    this.startCleanup();
  }

  /**
   * 🎯 Ambil atau buat koneksi baru dari pool
   */
  async acquire(
    sessionString: string,
    apiId: number,
    apiHash: string,
    dcId?: number
  ): Promise<TelegramClient> {
    const poolKey = `${sessionString.substring(0, 20)}_${dcId || "default"}`;

    if (!this.pool.has(poolKey)) {
      this.pool.set(poolKey, []);
    }

    const connections = this.pool.get(poolKey)!;

    // Cari koneksi idle yang bisa dipakai ulang
    const available = connections.find((conn) => !conn.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();

      // Pastikan masih terkoneksi
      try {
        await available.client.getMe();
        return available.client;
      } catch (error) {
        // Jika koneksi mati, reconnect
        try {
          await available.client.connect();
          return available.client;
        } catch (reconnectError) {
          // Jika gagal total, mark sebagai not in use dan buang
          available.inUse = false;
          connections.splice(connections.indexOf(available), 1);
        }
      }
    }

    // Jika pool penuh, tunggu atau reject
    if (connections.length >= this.MAX_POOL_SIZE) {
      // Tunggu koneksi tersedia (max 10 detik)
      const waitStart = Date.now();
      while (Date.now() - waitStart < 10000) {
        const nowAvailable = connections.find((conn) => !conn.inUse);
        if (nowAvailable) {
          nowAvailable.inUse = true;
          nowAvailable.lastUsed = Date.now();
          return nowAvailable.client;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      // Timeout: reject instead of forcing reuse
      throw new Error("Connection pool exhausted: all connections busy after 10s timeout");
    }

    // Buat koneksi baru
    const client = new TelegramClient(
      new StringSession(sessionString),
      apiId,
      apiHash,
      {
        connectionRetries: 5,
        useWSS: true,
        autoReconnect: false, // Kita handle manual
        timeout: 30000,
        floodSleepThreshold: 0, // Kita handle flood wait manual
        dcId: dcId,
      }
    );

    await client.connect();

    const pooledConn: PooledConnection = {
      client,
      lastUsed: Date.now(),
      inUse: true,
      dcId,
    };

    connections.push(pooledConn);
    return client;
  }

  /**
   * 🔓 Release koneksi kembali ke pool
   */
  release(client: TelegramClient): void {
    for (const connections of this.pool.values()) {
      const conn = connections.find((c) => c.client === client);
      if (conn) {
        conn.inUse = false;
        conn.lastUsed = Date.now();
        return;
      }
    }
  }

  /**
   * 🧹 Cleanup koneksi yang sudah idle terlalu lama
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [key, connections] of this.pool.entries()) {
        // Filter koneksi yang sudah idle > IDLE_TIMEOUT
        const toRemove = connections.filter(
          (conn) =>
            !conn.inUse && now - conn.lastUsed > this.IDLE_TIMEOUT
        );

        // Disconnect all stale connections
        for (const conn of toRemove) {
          try {
            conn.client.disconnect();
          } catch (e) {
            // Ignore error saat disconnect
          }
        }

        // Remove stale connections (fixed race condition)
        const remaining = connections.filter(
          (conn) => !toRemove.includes(conn)
        );
        this.pool.set(key, remaining);

        // Hapus pool key jika kosong
        if (remaining.length === 0) {
          this.pool.delete(key);
        }
      }
    }, 120000); // Setiap 2 menit
  }

  /**
   * 🛑 Destroy semua koneksi (untuk shutdown graceful)
   */
  async destroyAll(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const disconnectPromises: Promise<void>[] = [];

    for (const connections of this.pool.values()) {
      for (const conn of connections) {
        disconnectPromises.push(
          conn.client.disconnect().catch(() => {})
        );
      }
    }

    await Promise.all(disconnectPromises);
    this.pool.clear();
  }
}

// Singleton instance
const connectionPool = new TelegramConnectionPool();

/**
 * 🎯 SMART RETRY WITH EXPONENTIAL BACKOFF
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Handle Flood Wait
      if (error.message?.includes("FLOOD_WAIT_")) {
        const seconds = parseInt(error.message.split("_").pop() || "30");
        console.log(`⏳ Flood wait detected: ${seconds}s`);
        
        // Jika terlalu lama (>60s), lempar error
        if (seconds > 60) {
          throw error;
        }
        
        await new Promise((r) => setTimeout(r, seconds * 1000));
        continue;
      }

      // Jangan retry untuk error authentication
      if (
        error.message?.includes("AUTH_KEY") ||
        error.message?.includes("SESSION_")
      ) {
        throw error;
      }

      // Exponential backoff untuk error lainnya
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * 🌐 SMART DC DETECTOR & ROUTER
 * Mendeteksi dan routing ke DC yang tepat
 */
export async function getOptimalDC(
  client: TelegramClient,
  entityId: string
): Promise<number> {
  try {
    const entity = await client.getEntity(entityId);
    
    // Ekstrak DC ID dari entity
    const dcId = (entity as any).photo?.dcId || 
                 (entity as any).dcId || 
                 2; // Default DC2 Singapore
    
    return dcId;
  } catch (error) {
    console.warn("Failed to detect DC, using default:", error);
    return 2; // Fallback ke DC2
  }
}

/**
 * 🎯 HIGH-LEVEL API: Execute Telegram Operation
 */
export async function executeTelegramOperation<T>(
  sessionString: string,
  apiId: number,
  apiHash: string,
  operation: (client: TelegramClient) => Promise<T>,
  dcId?: number
): Promise<T> {
  let client: TelegramClient | null = null;

  try {
    client = await connectionPool.acquire(sessionString, apiId, apiHash, dcId);
    
    const result = await executeWithRetry(async () => {
      return await operation(client!);
    });

    return result;
  } finally {
    if (client) {
      connectionPool.release(client);
    }
  }
}

export { connectionPool };
