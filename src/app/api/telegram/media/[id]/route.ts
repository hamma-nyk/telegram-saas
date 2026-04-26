import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

// Paksa Vercel menggunakan region terdekat dengan Telegram (biasanya Europe/Asia)
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

  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id)
      return new Response("Unauthorized", { status: 401 });

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    if (!userDB?.telegramSession) {
      return new Response("No Telegram Session Found", { status: 400 });
    }

    // Inisiasi Client dengan config minimalis agar cepat
    const client = new TelegramClient(
      new StringSession(userDB.telegramSession),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 3,
        useWSS: true, // Gunakan WebSocket agar lebih stabil di serverless
      },
    );

    await client.connect();

    // Gunakan try-finally agar client.disconnect() SELALU dijalankan
    try {
      const [msg] = await client.getMessages(chatId, { ids: [messageId] });

      if (!msg || !msg.media) {
        return new Response("Media not found", { status: 404 });
      }

      // Ambil metadata file
      const doc = (msg.media as any).document;
      const photo = (msg.media as any).photo;
      const mimeType = doc?.mimeType || "image/jpeg";
      const fileSize = doc?.size?.toNumber() || photo?.sizes?.at(-1)?.size || 0;

      // Strategi: Jika file < 5MB, gunakan downloadMedia biasa agar tidak ribet di Vercel
      // Jika > 5MB, gunakan iterDownload
      if (fileSize < 5 * 1024 * 1024) {
        const buffer = await client.downloadMedia(msg.media);
        if (buffer !== undefined) {
          return new Response(buffer as any, {
            headers: {
              "Content-Type": mimeType,
              "Content-Length": buffer?.length.toString(),
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=86400",
            },
          });
        } else {
          // Handle the case when buffer is undefined
          return new Response("Internal Server Error", { status: 500 });
        }
      } else {
        // Mode Streaming untuk file besar
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of client.iterDownload({
                file: msg.media,
                requestSize: 512 * 1024, // Chunk lebih kecil agar stabil
              })) {
                controller.enqueue(chunk);
              }
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": mimeType,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } finally {
      // SANGAT PENTING: Selalu matikan koneksi agar tidak memory leak di Vercel
      await client.disconnect();
    }
  } catch (err: any) {
    console.error("Critical Error Media API:", err.message);
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
