import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import { thumbnailCache, generateCacheKey } from "@/lib/mediaCache";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const messageId = parseInt(id);
  const chatId = req.nextUrl.searchParams.get("chatId");

  if (!chatId || isNaN(messageId)) {
    return new Response("Missing Parameters", { status: 400 });
  }

  let client: TelegramClient | null = null;

  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id)
      return new Response("Unauthorized", { status: 401 });

    // 🔥 CHECK THUMBNAIL CACHE (untuk foto kecil)
    const cacheKey = generateCacheKey(
      sessionApp.user.id,
      chatId,
      messageId,
      "thumbnail"
    );

    const cachedThumbnail = thumbnailCache.get(cacheKey);
    if (cachedThumbnail) {
      console.log("✅ Thumbnail cache hit:", cacheKey);
      return new Response(cachedThumbnail as any, {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": cachedThumbnail.length.toString(),
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id).select("telegramSession").lean();
    if (!userDB?.telegramSession)
      return new Response("No Session", { status: 404 });

    client = new TelegramClient(
      new StringSession(userDB.telegramSession),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 5,
        useWSS: true,
        timeout: 30000,
        floodSleepThreshold: 0, // Handle manual
      },
    );

    await client.connect();

    // 🔥 MULTI-DC SUPPORT: Gunakan getEntity untuk mendeteksi lokasi DC file
    const entity = await client.getEntity(chatId);
    const [msg] = await client.getMessages(entity, { ids: [messageId] });

    if (!msg || !msg.media) {
      if (client) await client.disconnect();
      return new Response("Media not found", { status: 404 });
    }

    // Deteksi target DC agar tidak terjadi FILE_MIGRATE error
    const mediaObj =
      (msg.media as any).document || (msg.media as any).photo || msg.media;
    const targetDC = mediaObj.dcId || 2;

    console.log(`📡 Downloading from DC${targetDC} - Chat: ${chatId}, Msg: ${messageId}`);

    // --- LOGIKA PENANGANAN FOTO ---
    if (msg.media instanceof Api.MessageMediaPhoto) {
      const buffer = await client.downloadMedia(msg.media);
      await client.disconnect();

      // 🔥 CACHE THUMBNAIL
      if (buffer && buffer.length < 500 * 1024) { // Cache hanya jika < 500KB
        thumbnailCache.set(cacheKey, buffer as Buffer, buffer.length);
      }

      return new Response(buffer as any, {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": buffer?.length.toString() || "",
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }

    // --- LOGIKA PENANGANAN MUSIK & VIDEO (STREAMING) ---
    if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document as Api.Document;
      const mimeType = doc.mimeType || "audio/mpeg";
      const fileSize = doc.size.toJSNumber();

      const stream = new ReadableStream({
        async start(controller) {
          // 🔥 BACKEND KILL SWITCH: Memantau sinyal batal dari browser
          const onAbort = async () => {
            console.log(
              "⚠️ Browser abort detected! Closing Telegram stream...",
            );
            if (client) {
              try {
                await client.disconnect();
              } catch (e) {}
            }
          };

          // Pasang sensor pendeteksi jika user menutup video/halaman
          req.signal.addEventListener("abort", onAbort);

          try {
            if (!client) return;
            
            // 🔥 OPTIMIZED CHUNK SIZE berdasarkan tipe media
            const isMusic = mimeType.includes("audio");
            const chunkSize = isMusic ? 512 * 1024 : 256 * 1024; // 512KB untuk musik, 256KB untuk video

            for await (const chunk of client.iterDownload({
              file: msg.media,
              requestSize: chunkSize,
              dcId: targetDC,
            })) {
              // Hentikan pengiriman chunk jika browser sudah menolak menerima
              if (req.signal.aborted) {
                console.log("⚠️ Stream cancelled mid-transfer");
                break;
              }
              controller.enqueue(chunk);
            }
            
            if (!req.signal.aborted) controller.close();
          } catch (e: any) {
            // Jangan cetak error jika memang sengaja dibunuh oleh Kill Switch
            if (!req.signal.aborted) {
              console.error("❌ Stream Error:", e.message);
              controller.error(e);
            }
          } finally {
            // Bersihkan sensor dan pastikan Telegram terputus
            req.signal.removeEventListener("abort", onAbort);
            if (client) {
              try {
                await client.disconnect();
              } catch (e) {}
            }
          }
        },
        async cancel() {
          // Fallback ekstra untuk pembatalan stream
          if (client) {
            try {
              await client.disconnect();
            } catch (e) {}
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }

    await client.disconnect();
    return new Response("Unsupported Media Type", { status: 400 });
  } catch (err: any) {
    if (client) {
      try {
        await client.disconnect();
      } catch {}
    }

    // Cegah pencetakan log error panik jika hanya karena aborted
    if (req.signal.aborted) {
      return new Response("Request Aborted", { status: 499 });
    }

    console.error("❌ Critical Proxy Error:", err.message);

    // Kirim feedback yang jelas ke dashboard
    if (err.message.includes("FLOOD_WAIT"))
      return new Response("Flood Wait", { status: 429 });
    if (err.message.includes("AUTH_KEY"))
      return new Response("Session Expired", { status: 401 });

    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
