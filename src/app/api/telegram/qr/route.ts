import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionApp = await getServerSession(authOptions);
  if (!sessionApp?.user?.id) return new Response("Unauthorized", { status: 401 });

  const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const encoder = new TextEncoder();
  let client: TelegramClient | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await connectMongoDB();
        // Bersihkan temp2FA lama agar tidak bentrok
        await User.findByIdAndUpdate(sessionApp.user.id, { temp2FA: null });

        client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();

        await client.signInUserWithQrCode(
          { apiId, apiHash },
          {
            qrCode: async (qr) => {
              const url = `tg://login?token=${qr.token.toString("base64url")}`;
              send("qr", { url });
            },
            password: async () => {
              // 1. Beritahu UI untuk memunculkan form 2FA
              send("require_2fa", { message: "Akun diproteksi 2FA. Masukkan Cloud Password Anda." });
              
              // 2. Polling Database: Tunggu UI mengirim password via API lain
              // Looping 60 kali x 2 detik = maksimal 2 menit menunggu
              for (let i = 0; i < 60; i++) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                
                const user = await User.findById(sessionApp.user.id);
                if (user && user.temp2FA) {
                  const pwd = user.temp2FA;
                  // Hapus password dari DB untuk keamanan, lalu lanjutkan proses login!
                  await User.findByIdAndUpdate(sessionApp.user.id, { temp2FA: null });
                  return pwd; 
                }
              }
              throw new Error("Waktu input 2FA habis.");
            },
            onError: (err) => console.log("GramJS Log:", err),
          }
        );

        // Jika sampai baris ini = LOGIN SUKSES 100%
        const sessionString = client.session.save() as unknown as string;
        await User.findByIdAndUpdate(sessionApp.user.id, {
          telegramSession: sessionString,
          telegramConnected: true,
        });

        send("success", { message: "Akun Berhasil Terhubung!" });

      } catch (err: any) {
        send("error", { message: err.message || "Gagal menghubungi Telegram." });
      } finally {
        controller.close();
        if (client) await client.disconnect();
      }
    },
    cancel() {
      if (client) client.disconnect();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
}