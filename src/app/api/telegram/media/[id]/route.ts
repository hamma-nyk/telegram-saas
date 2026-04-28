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

    // ✅ Inisialisasi dengan timeout lebih panjang untuk Cloud
    client = new TelegramClient(
      new StringSession(userDB.telegramSession),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 5,
        useWSS: true,
        timeout: 30000, // Naik ke 30 detik
        autoReconnect: false,
      },
    );

    // 🔥 STRATEGI KONEKSI BERLAPIS (KHUSUS VERCEL)
    await client.connect();

    // Pastikan benar-benar terhubung sebelum lanjut
    const me = await client.getMe();
    if (!me) {
      // Jika getMe gagal/null, paksa reconnect sekali lagi
      await client.disconnect();
      await client.connect();
    }

    const entity = await client.getEntity(chatId);
    const [msg] = await client.getMessages(entity, { ids: [messageId] });

    if (!msg || !msg.media) {
      if (client) await client.disconnect();
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
            // ✅ Gunakan requestSize ultra kecil untuk stabilitas sin1
            for await (const chunk of client!.iterDownload({
              file: msg.media,
              requestSize: 32 * 1024, // 32KB lebih lambat tapi jauh lebih stabil
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

    return new Response(stream, {
      headers: {
        "Content-Type": (msg.media as any).document?.mimeType || "image/jpeg",
        "Content-Length":
          (msg.media as any).document?.size?.toJSNumber().toString() ||
          (msg.media as any).photo?.sizes?.at(-1)?.size?.toString() ||
          "",
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    if (client) {
      try {
        await client.disconnect();
      } catch {}
    }
    console.error("Vercel Critical Error:", err.message);

    // Kirim response status yang tepat agar Vercel tidak bingung
    if (
      err.message.includes("AUTH_KEY_UNREGISTERED") ||
      err.message.includes("AUTH_BYTES_INVALID")
    ) {
      return new Response("Session Expired", { status: 401 });
    }
    if (err.message.includes("FLOOD_WAIT")) {
      return new Response("Flood Wait", { status: 429 });
    }
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
