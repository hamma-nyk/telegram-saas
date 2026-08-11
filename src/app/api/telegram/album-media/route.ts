import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { Api } from "telegram";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import { executeTelegramOperation, getOptimalDC } from "@/lib/telegramPool";
import { metadataCache, generateCacheKey } from "@/lib/mediaCache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Validasi Sesi Aplikasi
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Ambil Parameter (ID Channel & Offset untuk Load More)
    const channelId = req.nextUrl.searchParams.get("id");
    const offsetId = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    if (!channelId) {
      return NextResponse.json(
        { error: "ID Channel diperlukan" },
        { status: 400 },
      );
    }

    // 🔥 CHECK CACHE FIRST (untuk metadata yang sama)
    const cacheKey = generateCacheKey(
      sessionApp.user.id,
      channelId,
      offsetId,
      "metadata"
    );
    
    const cached = metadataCache.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit for album-media:", cacheKey);
      return NextResponse.json(cached);
    }

    // 3. Koneksi Database & Verifikasi Sesi Telegram
    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id).select("telegramSession").lean();

    if (!userDB?.telegramSession) {
      return NextResponse.json(
        { error: "Sesi Telegram tidak ditemukan" },
        { status: 404 },
      );
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID!);
    const apiHash = process.env.TELEGRAM_API_HASH!;

    // 🔥 MULTI-DC OPTIMIZATION: Gunakan Connection Pool
    const result = await executeTelegramOperation(
      userDB.telegramSession,
      apiId,
      apiHash,
      async (client) => {
        // Deteksi DC optimal untuk channel ini
        const optimalDC = await getOptimalDC(client, channelId);
        console.log(`🌐 Detected optimal DC for ${channelId}: DC${optimalDC}`);

        // Resolusi entity sekali saja
        const entity = await client.getEntity(channelId);

        const FETCH_LIMIT = 20; // Naikkan limit untuk efisiensi

        // Tarik pesan dengan batch lebih besar
        const messages = await client.getMessages(entity, {
          limit: FETCH_LIMIT,
          offsetId: offsetId,
        });

        // Filter & Map secara paralel untuk performa
        const photos = messages
          .filter((msg) => {
            if (!msg.media || msg.message?.toLowerCase().includes("deleted"))
              return false;

            const isPhoto = msg.media instanceof Api.MessageMediaPhoto;
            const isVideo =
              msg.media instanceof Api.MessageMediaDocument &&
              msg.media.document instanceof Api.Document &&
              msg.media.document.mimeType.includes("video");

            return isPhoto || isVideo;
          })
          .map((msg) => {
            const isVideo =
              msg.media instanceof Api.MessageMediaDocument &&
              msg.media.document instanceof Api.Document &&
              msg.media.document.mimeType.includes("video");

            return {
              id: msg.id,
              type: isVideo ? "video" : "photo",
              caption: msg.message || "",
              url: `/api/telegram/media/${msg.id}?chatId=${channelId}`,
              date: msg.date,
              dcId: optimalDC, // Kirim info DC ke frontend
            };
          });

        const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;

        return {
          success: true,
          photos,
          lastId,
          hasMore: messages.length >= FETCH_LIMIT,
        };
      }
    );

    // 🔥 CACHE RESULT (dengan TTL 15 menit)
    metadataCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("ALBUM MEDIA ERROR:", error.message);

    // Deteksi Spesifik: Flood Wait
    if (error.message.includes("FLOOD_WAIT_")) {
      const seconds = error.message.split("_").pop();
      return NextResponse.json(
        { error: `Batas tercapai. Tunggu ${seconds} detik.` },
        { status: 429 },
      );
    }

    // Deteksi Spesifik: Sesi Rusak/Kadaluarsa
    if (
      error.message.includes("AUTH_KEY_UNREGISTERED") ||
      error.message.includes("AUTH_BYTES_INVALID")
    ) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login ulang." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: `Gagal menarik media: ${error.message}` },
      { status: 500 },
    );
  }
}
