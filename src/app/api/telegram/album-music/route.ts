import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let client: TelegramClient | null = null;
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const channelId = req.nextUrl.searchParams.get("id");
    const offsetId = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    client = new TelegramClient(
      new StringSession(userDB?.telegramSession as string),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      { connectionRetries: 10, useWSS: true, timeout: 20000 },
    );

    await client.connect();

    // 🔥 ANTI-FLOOD & MULTI-DC HANDSHAKE
    try {
      await client.getMe();
    } catch (e) {}
    const entity = await client.getEntity(channelId as string);

    const messages = await client.getMessages(entity, {
      limit: 8, // Ambil 20 per batch
      offsetId: offsetId,
      filter: new Api.InputMessagesFilterMusic(),
    });

    const songs = messages
      .filter((msg) => !msg.message?.toLowerCase().includes("deleted"))
      .map((msg) => {
        const doc =
          msg.media instanceof Api.MessageMediaDocument
            ? (msg.media.document as Api.Document)
            : null;
        const attr = doc?.attributes.find(
          (a) => a instanceof Api.DocumentAttributeFilename,
        ) as any;
        const audioAttr = doc?.attributes.find(
          (a) => a instanceof Api.DocumentAttributeAudio,
        ) as any;

        return {
          id: msg.id,
          title: audioAttr?.title || attr?.fileName || "Unknown Track",
          size: doc
            ? (doc.size.toJSNumber() / (1024 * 1024)).toFixed(2) + " MB"
            : "0 MB",
          url: `/api/telegram/media/${msg.id}?chatId=${channelId}`,
        };
      });

    await client.disconnect();
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;

    return NextResponse.json({ success: true, songs, lastId });
  } catch (error: any) {
    if (client) await client.disconnect();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
