import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id)
      return new Response("Unauthorized", { status: 401 });

    const { id } = await params;
    const messageId = parseInt(id);
    const chatId = req.nextUrl.searchParams.get("chatId");

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);
    const client = new TelegramClient(
      new StringSession(userDB?.telegramSession as string),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      { connectionRetries: 2 },
    );

    await client.connect();

    const [msg] = await client.getMessages(chatId as string, {
      ids: [messageId],
    });
    if (!msg || !msg.media) {
      await client.disconnect();
      return new Response("Media Not Found", { status: 404 });
    }

    // Ambil informasi file
    const doc = (msg.media as any).document;
    const size =
      doc?.size?.toNumber() ||
      (msg.media as any).photo?.sizes?.at(-1)?.size ||
      0;
    const mimeType = doc?.mimeType || "image/jpeg";

    // STREAMING: Gunakan iterDownload untuk menarik data per bagian
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of client.iterDownload({
          file: msg.media,
          requestSize: 1024 * 1024, // 1MB per chunk
        })) {
          controller.enqueue(chunk);
        }
        controller.close();
        await client.disconnect();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": size.toString(),
        "Accept-Ranges": "bytes", // Penting untuk seek music
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return new Response("Stream Error", { status: 500 });
  }
}
