import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

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

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    if (!userDB?.telegramSession) {
      return new Response("No Telegram Session Found", { status: 400 });
    }

    client = new TelegramClient(
      new StringSession(userDB.telegramSession),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      { connectionRetries: 3, useWSS: true },
    );

    await client.connect();

    const [msg] = await client.getMessages(chatId, { ids: [messageId] });

    // FIX 500: Pastikan pesan dan media ada
    if (!msg || !msg.media) {
      if (client) await client.disconnect();
      return new Response("Media not found", { status: 404 });
    }

    // --- LOGIKA DETEKSI MEDIA (FIX IMAGE & MUSIC) ---
    let mimeType = "application/octet-stream";
    let fileSize = 0;
    let mediaHandle = msg.media;

    if (
      msg.media instanceof Api.MessageMediaPhoto &&
      msg.media.photo instanceof Api.Photo
    ) {
      // Jika itu FOTO
      mimeType = "image/jpeg";
      const largestSize = msg.media.photo.sizes.at(-1);
      fileSize = (largestSize as any)?.size || 0;
    } else if (
      msg.media instanceof Api.MessageMediaDocument &&
      msg.media.document instanceof Api.Document
    ) {
      // Jika itu DOKUMEN (Musik/Video/File)
      mimeType = msg.media.document.mimeType || "application/octet-stream";
      fileSize = msg.media.document.size.toJSNumber();
    }

    // --- STREAMING DENGAN CACHE ---
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (!client) return;
          for await (const chunk of client.iterDownload({
            file: mediaHandle,
            requestSize: 512 * 1024, // 512KB per chunk
          })) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        } finally {
          if (client) await client.disconnect();
        }
      },
      async cancel() {
        if (client) await client.disconnect();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileSize > 0 ? fileSize.toString() : "",
        "Accept-Ranges": "bytes",
        // CACHE STRATEGY: Simpan di browser selama 1 tahun, di Vercel Edge selama 30 hari
        "Cache-Control":
          "public, max-age=31536000, s-maxage=2592000, stale-while-revalidate=86400",
        "Content-Disposition": `inline; filename="media-${id}"`,
      },
    });
  } catch (err: any) {
    if (client) await client.disconnect();
    console.error("Critical Proxy Error:", err.message);
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
