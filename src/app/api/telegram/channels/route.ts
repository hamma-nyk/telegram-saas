import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import { executeTelegramOperation } from "@/lib/telegramPool";

export async function GET(req: NextRequest) {
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id).select("telegramSession").lean();
    if (!userDB || !userDB.telegramSession) return NextResponse.json({ error: "Telegram belum terhubung." }, { status: 403 });

    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";

    // 🔥 OPTIMIZED: Gunakan connection pool
    const result = await executeTelegramOperation(
      userDB.telegramSession,
      apiId,
      apiHash,
      async (client) => {
        // 1. NAIKKAN LIMIT MENJADI 500
        const dialogs = await client.getDialogs({ limit: 500 });
        
        // 2. PERBAIKI FILTER (Menggunakan deteksi className bawaan Telegram)
        const channels = dialogs
          .filter((d: any) => {
            // Memastikan yang diambil hanyalah Channel atau MegaGroup
            return d.isChannel || d.isGroup || d.entity?.className === 'Channel';
          })
          .map((d: any) => ({
            id: d.id ? d.id.toString() : "",
            title: d.title || "Channel Tanpa Nama",
            accessHash: d.entity?.accessHash ? d.entity.accessHash.toString() : "0"
          }));

        return { success: true, channels };
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Get Channels Error:", error);
    return NextResponse.json({ error: "Gagal menarik daftar channel dari Telegram." }, { status: 500 });
  }
}