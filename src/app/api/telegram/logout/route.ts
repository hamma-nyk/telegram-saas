import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    if (userDB?.telegramSession) {
      try {
        const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
        const apiHash = process.env.TELEGRAM_API_HASH || "";
        const client = new TelegramClient(
          new StringSession(userDB.telegramSession),
          apiId,
          apiHash,
          { connectionRetries: 1 }
        );
        
        await client.connect();
        // Beri tahu server Telegram untuk menghancurkan sesi ini
        await client.invoke(new Api.auth.LogOut());
        await client.disconnect();
      } catch (e) {
        console.log("Sesi mungkin sudah expired di Telegram, lanjut hapus di DB.");
      }
    }

    // Hapus data di MongoDB
    await User.findByIdAndUpdate(sessionApp.user.id, {
      $set: {
        telegramSession: null,
        telegramConnected: false,
        savedAlbums: [] // Opsional: hapus album jika ingin benar-benar bersih
      }
    });

    return NextResponse.json({ success: true, message: "Koneksi Telegram berhasil diputus." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}