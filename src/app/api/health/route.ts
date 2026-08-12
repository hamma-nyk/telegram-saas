/**
 * 🔥 API HEALTH CHECK & MONITORING ENDPOINT
 * Endpoint untuk monitoring kesehatan sistem
 */

import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/mongodb";
import { 
  metadataCache, 
  thumbnailCache 
} from "@/lib/mediaCache";
import { connectionPool } from "@/lib/telegramPool";
import { 
  perfLogger, 
  bandwidthMonitor, 
  networkMonitor 
} from "@/lib/telegramUtils";
import { startBotListener } from "@/lib/bot/listener";

export const dynamic = "force-dynamic";

let isBotRunning = false;

export async function GET() {
  if (!isBotRunning) {
    try {
      startBotListener();
      isBotRunning = true;
      console.log("Bot listener started via health endpoint");
    } catch (e) {
      console.error("Gagal start bot listener", e);
    }
  }

  try {
    const dbHealth = await checkDatabaseHealth();

    const health = {
      status: "healthy",
      botRunning: isBotRunning,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + " MB",
        total: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + " MB",
        rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + " MB",
      },
      database: {
        healthy: dbHealth.healthy,
        poolSize: dbHealth.poolSize,
        latency: dbHealth.latency,
      },
      cache: {
        metadata: metadataCache.getStats(),
        thumbnail: thumbnailCache.getStats(),
      },
      performance: {
        operations: perfLogger.getStats(),
        bandwidth: {
          totalTransferred: bandwidthMonitor.getTotalTransferred(),
          currentSpeed: bandwidthMonitor.getCurrentSpeed(),
        },
        network: {
          quality: networkMonitor.getQuality(),
          avgLatency: networkMonitor.getAverageLatency(),
          suggestedChunkSize: networkMonitor.getSuggestedChunkSize(),
        },
      },
    };

    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        botRunning: isBotRunning,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
