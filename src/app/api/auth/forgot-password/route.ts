import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import { getBotClient } from "@/lib/telegramUtils";

export async function POST(req: NextRequest) {
  try {
    const { username, email, phone } = await req.json();

    if (!username || !email || !phone) {
      return NextResponse.json(
        { error: "Username, Email, dan No HP wajib diisi." },
        { status: 400 }
      );
    }

    await connectMongoDB();
    const user = await User.findOne({ username, email, phone });

    if (!user) {
      return NextResponse.json(
        { error: "Data tidak cocok dengan database kami." },
        { status: 404 }
      );
    }

    const message = `🚨 **PERMINTAAN RESET PASSWORD NAOCLOUD** 🚨\n\n` +
      `Seseorang meminta reset password dengan data berikut:\n` +
      `- Username: \`${username}\`\n` +
      `- Email: \`${email}\`\n` +
      `- No HP: \`${phone}\`\n\n` +
      `Jika ini valid, silakan balas ke user dengan password baru.`;

    try {
      const botClient = await getBotClient();
      await botClient.sendMessage("sengtress", { message });
    } catch (e) {
      console.warn("Gagal mengirim pesan via bot, pastikan BOT_TOKEN dan client terkonfigurasi:", e);
    }

    return NextResponse.json(
      { message: "Permintaan reset password berhasil dikirim." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}