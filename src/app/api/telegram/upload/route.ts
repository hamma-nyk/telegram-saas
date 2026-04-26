import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomFile } from "telegram/client/uploads";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  let client: TelegramClient | null = null;
  
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const targetChat = formData.get("targetChat") as string;
    const caption = formData.get("caption") as string || "";

    if (!file || !targetChat) return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });

    await connectMongoDB();
    const userDB = await User.findById(sessionApp.user.id);
    if (!userDB || !userDB.telegramSession) {
      return NextResponse.json({ error: "Akun Telegram belum terhubung." }, { status: 403 });
    }

    client = new TelegramClient(new StringSession(userDB.telegramSession), 
      parseInt(process.env.TELEGRAM_API_ID!), process.env.TELEGRAM_API_HASH!, { connectionRetries: 5 });

    await client.connect();

    const buffer = Buffer.from(await file.arrayBuffer());
    const isAudio = file.type.startsWith("audio/") || 
                    /\.(mp3|ogg|flac|m4a|wav)$/i.test(file.name);

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

    return NextResponse.json({ success: true, message: "File berhasil diunggah!" });

  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) await client.disconnect();
  }
}