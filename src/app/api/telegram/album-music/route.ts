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
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const channelId = req.nextUrl.searchParams.get("id");
    const offsetId = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    if (!channelId) {
      return NextResponse.json({ error: "Channel ID required" }, { status: 400 });
    }

    // 🔥 CHECK CACHE FIRST
    const cacheKey = generateCacheKey(
      sessionApp.user.id,
      channelId,
      offsetId,
      "metadata"
    );
    
    const cached = metadataCache.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit for album-music:", cacheKey);
      return NextResponse.json(cached);
    }

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id).select("telegramSession").lean();

    if (!userDB?.telegramSession) {
      return NextResponse.json({ error: "No telegram session" }, { status: 403 });
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID!);
    const apiHash = process.env.TELEGRAM_API_HASH!;

    // 🔥 MULTI-DC OPTIMIZATION: Gunakan Connection Pool
    const result = await executeTelegramOperation(
      userDB.telegramSession,
      apiId,
      apiHash,
      async (client) => {
        // Deteksi DC optimal
        const optimalDC = await getOptimalDC(client, channelId);
        console.log(`🎵 Detected optimal DC for music channel ${channelId}: DC${optimalDC}`);

        const entity = await client.getEntity(channelId);

        const messages = await client.getMessages(entity, {
          limit: 20, // Naikkan limit untuk efisiensi
          offsetId: offsetId,
          filter: new Api.InputMessagesFilterMusic(),
        });

        const songs = messages
          .filter((msg) => !msg.message?.toLowerCase().includes("deleted"))
          .map((msg) => {
            const doc =
              msg.media instanceof Api.MessageMediaDocument
                ? (msg.media.document as Api.Document)
                : null;
            const audioAttr = doc?.attributes.find(
              (a) => a instanceof Api.DocumentAttributeAudio,
            ) as any;
            const fileAttr = doc?.attributes.find(
              (a) => a instanceof Api.DocumentAttributeFilename,
            ) as any;

            return {
              id: msg.id,
              title: audioAttr?.title || fileAttr?.fileName || "Unknown Track",
              performer: audioAttr?.performer || "Unknown Artist",
              duration: audioAttr?.duration || 0,
              size: doc
                ? (doc.size.toJSNumber() / (1024 * 1024)).toFixed(2) + " MB"
                : "0 MB",
              url: `/api/telegram/media/${msg.id}?chatId=${channelId}`,
              dcId: optimalDC,
            };
          });

        const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;

        return { success: true, songs, lastId };
      }
    );

    // 🔥 CACHE RESULT
    metadataCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("ALBUM MUSIC ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
