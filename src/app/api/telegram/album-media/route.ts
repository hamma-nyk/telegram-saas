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

    // Tarik metadata pesan gambar (Ringan & Cepat)
    const messages = await client.getMessages(channelId, {
      limit: 50, // Bisa ambil lebih banyak karena cuma teks
      filter: new Api.InputMessagesFilterPhotos(),
    });

    const photos = messages
      .filter((msg) => !msg.message?.toLowerCase().includes("deleted"))
      .map((msg) => ({
        id: msg.id,
        caption: msg.message || "",
        // 🔥 Kirim URL Proxy, bukan datanya
        url: `/api/telegram/media/${msg.id}?chatId=${channelId}`,
      }));

    await client.disconnect();
    return NextResponse.json({ success: true, photos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
