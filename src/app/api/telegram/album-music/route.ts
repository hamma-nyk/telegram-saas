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
    if (!channelId)
      return NextResponse.json(
        { error: "ID Channel tidak valid" },
        { status: 400 },
      );

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    const client = new TelegramClient(
      new StringSession(userDB?.telegramSession as string),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      { connectionRetries: 5 },
    );

    await client.connect();

    // 🔥 Filter khusus AUDIO
    const messages = await client.getMessages(channelId, {
      limit: 20,
      filter: new Api.InputMessagesFilterMusic(),
    });

    const songs = [];
    for (const msg of messages) {
      if (msg.media && msg.media instanceof Api.MessageMediaDocument) {
        const doc = msg.media.document as Api.Document;

        // Ambil judul dari atribut audio atau nama file
        const audioAttr = doc.attributes.find(
          (a) => a instanceof Api.DocumentAttributeAudio,
        ) as any;
        const fileAttr = doc.attributes.find(
          (a) => a instanceof Api.DocumentAttributeFilename,
        ) as any;

        const rawTitle =
          audioAttr?.title || fileAttr?.fileName || "Unknown Track";

        // 🔥 LOGIKA SOFT DELETE: Lewati jika ada tag 'deleted'
        if (
          rawTitle.toLowerCase().includes("deleted") ||
          (msg.message && msg.message.includes("deleted"))
        ) {
          continue;
        }

        const buffer = await client.downloadMedia(msg.media, {});
        if (buffer) {
          songs.push({
            id: msg.id,
            title: rawTitle,
            size: (doc.size.toJSNumber() / (1024 * 1024)).toFixed(2) + " MB",
            base64: Buffer.from(buffer).toString("base64"),
          });
        }
      }
    }

    await client.disconnect();
    return NextResponse.json({ success: true, songs });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Gagal menarik musik." },
      { status: 500 },
    );
  }
}
