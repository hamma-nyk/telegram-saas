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
    // 1. Validasi Sesi Aplikasi
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Ambil Parameter
    const channelId = req.nextUrl.searchParams.get("id");
    const offsetId = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    if (!channelId) {
      return NextResponse.json(
        { error: "ID Channel diperlukan" },
        { status: 400 },
      );
    }

    // 3. Koneksi Database & Ambil Sesi Telegram
    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    if (!userDB?.telegramSession) {
      return NextResponse.json(
        { error: "Sesi Telegram tidak ditemukan" },
        { status: 404 },
      );
    }

    // 4. Inisialisasi Telegram Client
    client = new TelegramClient(
      new StringSession(userDB.telegramSession),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 3,
        useWSS: true,
        autoReconnect: false, // Serverless lebih aman tanpa auto-reconnect
        timeout: 20000,
      },
    );

    await client.connect();

    // 🔥 ANTI-FLOOD & MULTI-DC: Handshake awal agar sender internal siap
    try {
      await client.getMe();
    } catch (e: any) {
      if (e.message.includes("FLOOD_WAIT")) throw e;
    }

    // 5. Resolusi Entity & Ambil Metadata Pesan
    // Menggunakan getEntity memastikan jalur DC ke channel tersebut terbuka
    const entity = await client.getEntity(channelId);

    const messages = await client.getMessages(entity, {
      limit: 8, // Limit 20 agar tidak terlalu berat saat serial loading di frontend
      offsetId: offsetId,
      filter: new Api.InputMessagesFilterPhotos(),
    });

    // 6. Mapping Data Foto
    const photos = messages
      .filter((msg) => !msg.message?.toLowerCase().includes("deleted"))
      .map((msg) => ({
        id: msg.id,
        caption: msg.message || "",
        // Proxy URL mengarah ke api/telegram/media/[id]
        url: `/api/telegram/media/${msg.id}?chatId=${channelId}`,
        date: msg.date,
      }));

    // 7. Cleanup & Response
    await client.disconnect();

    const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;

    return NextResponse.json({
      success: true,
      photos,
      lastId,
    });
  } catch (error: any) {
    if (client) await client.disconnect();
    console.error("ALBUM MEDIA ERROR:", error.message);

    // Penanganan Error FLOOD
    if (error.message.includes("FLOOD_WAIT_")) {
      const seconds = error.message.split("_").pop();
      return NextResponse.json(
        { error: `Flood Limit. Tunggu ${seconds} detik.` },
        { status: 429 },
      );
    }

    // Penanganan Sesi Mati
    if (
      error.message.includes("AUTH_KEY_UNREGISTERED") ||
      error.message.includes("AUTH_BYTES_INVALID")
    ) {
      return NextResponse.json(
        { error: "Sesi Telegram kadaluarsa. Silakan login ulang." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Gagal mengambil data media." },
      { status: 500 },
    );
  }
}
