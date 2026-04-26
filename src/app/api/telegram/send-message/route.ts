import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    // 1. Cek sesi login Next.js
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Ambil sesi Telegram dari MongoDB
    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);
    if (!userDB || !userDB.telegramSession) {
      return NextResponse.json({ error: "Akun Telegram belum terhubung." }, { status: 403 });
    }

    // 3. Tangkap data dari frontend
    const { target, message } = await req.json();
    if (!target || !message) {
      return NextResponse.json({ error: "Target chat dan pesan wajib diisi." }, { status: 400 });
    }

    // 4. Konek GramJS dan Kirim Pesan
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";
    const client = new TelegramClient(new StringSession(userDB.telegramSession), apiId, apiHash, { connectionRetries: 5 });

    await client.connect();
    
    // Mengeksekusi pengiriman pesan teks
    await client.sendMessage(target, { message: message });
    
    await client.disconnect();

    return NextResponse.json({ success: true, message: "Pesan berhasil terkirim!" });
  } catch (error: any) {
    console.error("Send Message Error:", error);
    return NextResponse.json({ error: "Gagal mengirim pesan. Pastikan username target benar." }, { status: 500 });
  }
}