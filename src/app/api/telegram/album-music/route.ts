import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const channelId = req.nextUrl.searchParams.get("id");
    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    const client = new TelegramClient(
      new StringSession(userDB?.telegramSession as string),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      { connectionRetries: 5 },
    );

    await client.connect();

    const messages = await client.getMessages(channelId as string, {
      limit: 50,
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
          // 🔥 URL Proxy untuk streaming
          url: `/api/telegram/media/${msg.id}?chatId=${channelId}`,
        };
      });

    await client.disconnect();
    return NextResponse.json({ success: true, songs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
