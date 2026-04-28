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
    if (!userDB?.telegramSession)
      return new Response("No Session", { status: 404 });

    client = new TelegramClient(
      new StringSession(userDB.telegramSession),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 5,
        useWSS: true,
        timeout: 20000, // Menambah napas untuk koneksi Cloud
      },
    );

    await client.connect();

    // 🔥 WAJIB DI VERCEL: Pancing inisialisasi agar internal receiver aktif
    try {
      await client.getMe();
    } catch (e) {}

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

    // --- LOGIKA PENANGANAN FOTO ---
    if (msg.media instanceof Api.MessageMediaPhoto) {
      const buffer = await client.downloadMedia(msg.media);
      await client.disconnect();

      return new Response(buffer as any, {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": buffer?.length.toString() || "",
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }

    // --- LOGIKA PENANGANAN MUSIK (STREAMING) ---
    if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document as Api.Document;
      const mimeType = doc.mimeType || "audio/mpeg";
      const fileSize = doc.size.toJSNumber();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            if (!client) return;
            for await (const chunk of client.iterDownload({
              file: msg.media,
              // 🔥 ANTI-FLOOD: Gunakan chunk menengah untuk stabilitas Vercel
              requestSize: 128 * 1024,
              dcId: targetDC, // Langsung tembak ke DC yang benar
            })) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (e: any) {
            // Handle jika Telegram minta pindah DC di tengah jalan
            console.error("Stream Error:", e.message);
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
    console.error("Critical Proxy Error:", err.message);

    // Kirim feedback yang jelas ke dashboard
    if (err.message.includes("FLOOD_WAIT"))
      return new Response("Flood Wait", { status: 429 });
    if (err.message.includes("AUTH_KEY"))
      return new Response("Session Expired", { status: 401 });

    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
