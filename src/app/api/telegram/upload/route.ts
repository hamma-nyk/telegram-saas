import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { Api } from "telegram";
import { CustomFile } from "telegram/client/uploads";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import { executeTelegramOperation } from "@/lib/telegramPool";
import { metadataCache } from "@/lib/mediaCache";

export async function POST(req: NextRequest) {
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const targetChat = formData.get("targetChat") as string;
    const caption = formData.get("caption") as string || "";

    if (!file || !targetChat) return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id).select("telegramSession").lean();
    if (!userDB || !userDB.telegramSession) {
      return NextResponse.json({ error: "Akun Telegram belum terhubung." }, { status: 403 });
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID!);
    const apiHash = process.env.TELEGRAM_API_HASH!;

    const buffer = Buffer.from(await file.arrayBuffer());
    const isAudio = file.type.startsWith("audio/") || 
                    /\.(mp3|ogg|flac|m4a|wav)$/i.test(file.name);

    // 🔥 UPLOAD menggunakan Connection Pool
    await executeTelegramOperation(
      userDB.telegramSession,
      apiId,
      apiHash,
      async (client) => {
        // Kirim File
        await client.sendFile(targetChat, {
          file: new CustomFile(file.name, file.size, "", buffer),
          caption: caption,
          // Jika file audio, tambahkan atribut agar dikenali sebagai Music
          attributes: isAudio ? [
            new Api.DocumentAttributeAudio({
              title: file.name.replace(/\.[^/.]+$/, ""),
              performer: "OmniAlbum Upload",
              duration: 0, // Biarkan Telegram menghitung durasi otomatis
            })
          ] : []
        });
      }
    );

    // 🔥 Invalidate cache for this channel (fix stale data issue)
    // Clear all cache entries that match this channel
    const cachePattern = `metadata:${sessionApp.user.id}:${targetChat}:`;
    // Note: MediaCache doesn't have pattern-based invalidation yet
    // For now, just clear all metadata cache
    metadataCache.clear();

    return NextResponse.json({ success: true, message: "File berhasil diunggah!" });

  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}