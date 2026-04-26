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
    if (!sessionApp?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const channelId = req.nextUrl.searchParams.get("id");
    if (!channelId) return NextResponse.json({ error: "ID Channel tidak valid" }, { status: 400 });

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);
    
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";
    const client = new TelegramClient(new StringSession(userDB?.telegramSession as string), apiId, apiHash, { connectionRetries: 5 });

    await client.connect();

    // Tarik 20 pesan gambar terakhir
    const messages = await client.getMessages(channelId, {
      limit: 20,
      filter: new Api.InputMessagesFilterPhotos()
    });

    const photos = [];
    for (const msg of messages) {
      const captionText = msg.message || "";
      
      // 🔥 FITUR SOFT DELETE: Lewati gambar jika captionnya ada kata "deleted"
      if (captionText.toLowerCase().includes("deleted")) {
        continue;
      }

      if (msg.media) {
        const buffer = await client.downloadMedia(msg.media, {});
        if (buffer) {
          photos.push({
            id: msg.id,
            caption: captionText,
            base64: Buffer.from(buffer).toString("base64")
          });
        }
      }
    }

    await client.disconnect();
    return NextResponse.json({ success: true, photos });

  } catch (error: any) {
    console.error("Fetch Media Error:", error);
    return NextResponse.json({ error: "Gagal menarik media dari Telegram." }, { status: 500 });
  }
}