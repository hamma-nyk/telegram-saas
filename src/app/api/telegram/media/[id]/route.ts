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

  if (!chatId || isNaN(messageId))
    return new Response("Missing Params", { status: 400 });

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
        connectionRetries: 5, // Jangan terlalu banyak retry agar tidak dianggap spam
        useWSS: true,
        autoReconnect: false,
        timeout: 20000,
      },
    );

    await client.connect();

    // 🔥 ANTI-FLOOD: Lakukan handshake awal yang ringan
    try {
      await client.getMe();
    } catch (e: any) {
      if (e.message.includes("FLOOD_WAIT")) throw e;
    }

    const entity = await client.getEntity(chatId);
    const [msg] = await client.getMessages(entity, { ids: [messageId] });

    if (!msg || !msg.media) {
      await client.disconnect();
      return new Response("Media not found", { status: 404 });
    }

    // Deteksi DC Awal dari metadata
    const mediaObj =
      (msg.media as any).document || (msg.media as any).photo || msg.media;
    const initialDC = mediaObj.dcId || 2;

    const stream = new ReadableStream({
      async start(controller) {
        if (!client) return;

        // 🔥 RECURSIVE DOWNLOAD: Hanya pindah DC jika diminta Telegram (FILE_MIGRATE)
        async function downloadManager(targetDC: number) {
          try {
            for await (const chunk of client!.iterDownload({
              file: msg.media,
              // 🔥 ANTI-FLOOD: Chunk lebih besar (512KB) mengurangi jumlah request ke Telegram
              requestSize: 512 * 1024,
              dcId: targetDC,
            })) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (e: any) {
            if (e.message.includes("FILE_MIGRATE_")) {
              const nextDC = parseInt(e.message.split("_").pop());
              console.log(`📡 Migrating to DC: ${nextDC}`);
              return downloadManager(nextDC); // Pindah jalur secara resmi
            } else if (e.message.includes("FLOOD_WAIT_")) {
              controller.error(e); // Beritahu frontend ada flood
            } else {
              controller.error(e);
            }
          }
        }

        await downloadManager(initialDC);
      },
      async cancel() {
        if (client) await client.disconnect();
      },
      // Penting untuk cleanup di Vercel
      async pull() {},
    });

    const mimeType = (msg.media as any).document?.mimeType || "image/jpeg";
    const fileSize =
      (msg.media as any).document?.size?.toJSNumber() ||
      (msg.media as any).photo?.sizes?.at(-1)?.size ||
      0;

    return new Response(stream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileSize > 0 ? fileSize.toString() : "",
        "Accept-Ranges": "bytes",
        // 🔥 CACHE AGRESIF: Mencegah user download ulang yang memicu Flood
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    if (client) await client.disconnect();

    if (err.message.includes("FLOOD_WAIT_")) {
      const seconds = err.message.split("_").pop();
      return new Response(`Flood Limit: Silakan tunggu ${seconds} detik.`, {
        status: 429,
      });
    }

    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
