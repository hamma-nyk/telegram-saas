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

    // 2. Ambil Parameter (ID Channel & Offset untuk Load More)
    const channelId = req.nextUrl.searchParams.get("id");
    const offsetId = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    if (!channelId) {
      return NextResponse.json(
        { error: "ID Channel diperlukan" },
        { status: 400 },
      );
    }

    // 3. Koneksi Database & Verifikasi Sesi Telegram
    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);

    if (!userDB?.telegramSession) {
      return NextResponse.json(
        { error: "Sesi Telegram tidak ditemukan" },
        { status: 404 },
      );
    }

    // 4. Inisialisasi Telegram Client dengan Timeout yang Lebih Luas
    client = new TelegramClient(
      new StringSession(userDB.telegramSession),
      parseInt(process.env.TELEGRAM_API_ID!),
      process.env.TELEGRAM_API_HASH!,
      {
        connectionRetries: 10,
        useWSS: true,
        autoReconnect: false,
        timeout: 20000,
      },
    );

    await client.connect();

    // 🔥 ANTI-FLOOD HANDSHAKE: Memastikan receiver siap sebelum menarik media
    try {
      await client.getMe();
    } catch (e: any) {
      if (e.message.includes("FLOOD_WAIT")) throw e;
      // Jika hanya gangguan koneksi sesaat, coba lanjut
    }

    // 5. Resolusi Jalur DC (Data Center) ke Channel Tujuan
    const entity = await client.getEntity(channelId);

    // 6. Tarik Pesan Foto
    const messages = await client.getMessages(entity, {
      limit: 8, // Diturunkan agar lebih ringan di Vercel/Node 22
      offsetId: offsetId,
      filter: new Api.InputMessagesFilterPhotos(),
    });

    // 7. Mapping Data untuk Frontend
    const photos = messages
      .filter((msg) => !msg.message?.toLowerCase().includes("deleted"))
      .map((msg) => ({
        id: msg.id,
        caption: msg.message || "",
        // Mengarah ke Proxy Media yang mendukung Auto-DC
        url: `/api/telegram/media/${msg.id}?chatId=${channelId}`,
        date: msg.date,
      }));

    // 8. Tentukan ID Terakhir untuk fitur "Muat Lebih Banyak"
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;

    await client.disconnect();

    return NextResponse.json({
      success: true,
      photos,
      lastId,
    });
  } catch (error: any) {
    if (client) await client.disconnect();
    console.error("ALBUM MEDIA ERROR:", error.message);

    // Deteksi Spesifik: Flood Wait
    if (error.message.includes("FLOOD_WAIT_")) {
      const seconds = error.message.split("_").pop();
      return NextResponse.json(
        { error: `Batas tercapai. Tunggu ${seconds} detik.` },
        { status: 429 },
      );
    }

    // Deteksi Spesifik: Sesi Rusak/Kadaluarsa
    if (
      error.message.includes("AUTH_KEY_UNREGISTERED") ||
      error.message.includes("AUTH_BYTES_INVALID")
    ) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login ulang." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: `Gagal menarik media: ${error.message}` },
      { status: 500 },
    );
  }
}
