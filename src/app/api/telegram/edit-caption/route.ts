import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { targetChat, messageId, newCaption } = await req.json();

    if (!targetChat || !messageId || !newCaption) {
      return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
    }

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";
    const client = new TelegramClient(new StringSession(userDB?.telegramSession as string), apiId, apiHash, { connectionRetries: 5 });

    await client.connect();

    // 🔥 FITUR EDIT CAPTION VIA GRAMJS
    await client.editMessage(targetChat, {
      message: messageId,
      text: newCaption
    });

    await client.disconnect();
    return NextResponse.json({ success: true, message: "Caption berhasil diubah (Soft Deleted)!" });

  } catch (error: any) {
    console.error("Edit Caption Error:", error);
    return NextResponse.json({ error: "Gagal mengubah caption pesan." }, { status: 500 });
  }
}