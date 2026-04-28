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
      { connectionRetries: 5, useWSS: true, timeout: 20000 },
    );

    await client.connect();

    // 🔥 VALIDASI SESI (Cegah AUTH_BYTES_INVALID)
    try {
      const isAuth = await client.checkAuthorization();
      if (!isAuth) throw new Error("AUTH_KEY_UNREGISTERED");
      await client.getMe();
    } catch (e: any) {
      if (e.message.includes("FLOOD_WAIT")) throw e;
      await client.connect(); // Re-attempt sekali jika jabat tangan gagal
    }

    const entity = await client.getEntity(chatId);
    const [msg] = await client.getMessages(entity, { ids: [messageId] });

    if (!msg || !msg.media) {
      await client.disconnect();
      return new Response("Media not found", { status: 404 });
    }

    const mediaObj =
      (msg.media as any).document || (msg.media as any).photo || msg.media;
    const targetDC = mediaObj.dcId || 2;

    const stream = new ReadableStream({
      async start(controller) {
        if (!client) return;

        async function downloadManager(dc: number) {
          try {
            for await (const chunk of client!.iterDownload({
              file: msg.media,
              requestSize: 64 * 1024, // Diperkecil ke 64KB untuk stabilitas Node 22
              dcId: dc,
            })) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (e: any) {
            if (e.message.includes("FILE_MIGRATE_")) {
              const nextDC = parseInt(e.message.split("_").pop());
              return downloadManager(nextDC);
            }
            controller.error(e);
          }
        }
        await downloadManager(targetDC);
      },
      async cancel() {
        if (client) await client.disconnect();
      },
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
        "Cache-Control": "private, max-age=31536000, immutable", // Cache agresif anti-flood
      },
    });
  } catch (err: any) {
    if (client) await client.disconnect();
    console.error("Critical Proxy Error:", err.message);
    if (err.message.includes("FLOOD_WAIT"))
      return new Response("Flood Limit", { status: 429 });
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
