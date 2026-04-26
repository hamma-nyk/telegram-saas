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

  // Inisiasi client di luar agar bisa diakses oleh fungsi pembersih
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
      {
        connectionRetries: 3,
        useWSS: true,
      },
    );

    await client.connect();

    const [msg] = await client.getMessages(chatId, { ids: [messageId] });

    if (!msg || !msg.media) {
      await client.disconnect();
      return new Response("Media not found", { status: 404 });
    }

    // Ekstraksi Metadata File
    const doc = (msg.media as any).document;
    const photo = (msg.media as any).photo;

    // Tentukan MimeType dan Ukuran Total
    const mimeType = doc?.mimeType || "image/jpeg";
    const fileSize = doc?.size?.toJSNumber() || photo?.sizes?.at(-1)?.size || 0;

    // --- FULL STREAMING ENGINE ---
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (!client) return;

          // iterDownload akan menarik data per bagian (chunk)
          for await (const chunk of client.iterDownload({
            file: msg.media,
            requestSize: 256 * 1024, // 256KB per chunk agar lebih stabil di Vercel
          })) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (e) {
          console.error("Streaming interrupted:", e);
          controller.error(e);
        } finally {
          // DISCONNECT HANYA SETELAH STREAM SELESAI
          if (client) await client.disconnect();
        }
      },
      async cancel() {
        // Jika user menutup tab atau stop lagu, segera matikan koneksi Telegram
        if (client) await client.disconnect();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileSize > 0 ? fileSize.toString() : "",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="media-${id}"`,
      },
    });
  } catch (err: any) {
    if (client) await client.disconnect();
    console.error("Critical Proxy Error:", err.message);
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
