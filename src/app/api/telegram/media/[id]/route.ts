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

    client = new TelegramClient(
      new StringSession(userDB?.telegramSession as string),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      { connectionRetries: 3, useWSS: true },
    );

    await client.connect();
    const [msg] = await client.getMessages(chatId, { ids: [messageId] });

    if (!msg || !msg.media) {
      await client.disconnect();
      return new Response("Media not found", { status: 404 });
    }

    // --- LOGIKA PENANGANAN FOTO (REVISI) ---
    if (msg.media instanceof Api.MessageMediaPhoto) {
      // Untuk FOTO: Gunakan downloadMedia langsung (lebih stabil untuk gambar)
      const buffer = await client.downloadMedia(msg.media);
      await client.disconnect();

      return new Response(buffer as any, {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": buffer?.length.toString() || "",
          "Cache-Control": "public, max-age=31536000, s-maxage=2592000",
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
              requestSize: 512 * 1024,
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
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, s-maxage=2592000",
        },
      });
    }

    await client.disconnect();
    return new Response("Unsupported Media Type", { status: 400 });
  } catch (err: any) {
    if (client) await client.disconnect();
    console.error("Critical Proxy Error:", err.message);
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
