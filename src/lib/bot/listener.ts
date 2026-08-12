import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { connectMongoDB } from "../mongodb";
import User from "../../models/User";
import bcrypt from "bcryptjs";

// Hanya owner yang diizinkan mereset
const OWNER_USERNAME = "sengtress";
// Password default jika admin menyetujui
const DEFAULT_RESET_PASSWORD = "naocloud";

export async function startBotListener() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH as string;
  const botToken = process.env.TELEGRAM_BOT_TOKEN as string;

  if (!apiId || !apiHash || !botToken) {
    console.warn("⚠️ Bot credentials tidak lengkap, listener bot dimatikan.");
    return;
  }

  // Gunakan session kosong untuk bot
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    botAuthToken: botToken,
  });

  console.log("🤖 Naocloud Helper Bot aktif dan mendengarkan pesan...");

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.text) return;

    // Pastikan pengirim adalah owner (@sengtress)
    const sender = await message.getSender();
    if (!sender || (sender as any).username !== OWNER_USERNAME) {
      return; // Abaikan pesan dari orang lain
    }

    // Command "/accept"
    if (message.text.trim().toLowerCase() === "/accept") {
      // Pastikan perintah ini adalah REPLY dari pesan permintaan reset
      if (!message.replyToMsgId) {
        await client.sendMessage(message.chatId!, {
          message: "⚠️ Silakan reply ke pesan permintaan reset password dengan `/accept`",
          replyTo: message.id,
        });
        return;
      }

      // Ambil pesan asli yang di-reply
      const originalMsgs = await client.getMessages(message.chatId, {
        ids: [message.replyToMsgId],
      });
      const originalMsg = originalMsgs[0];

      if (!originalMsg || !originalMsg.text) return;
      const text = originalMsg.text;

      // Ekstrak username menggunakan Regex
      // Format pesan asli: "- Username: `username_disini`"
      const usernameMatch = text.match(/- Username:\s*(?:`?)([^`\n]+)(?:`?)/);
      
      if (!usernameMatch || !usernameMatch[1]) {
        await client.sendMessage(message.chatId!, {
          message: "❌ Gagal mengekstrak username dari pesan ini. Pastikan format pesan valid.",
          replyTo: message.id,
        });
        return;
      }

      const targetUsername = usernameMatch[1].trim();

      try {
        await connectMongoDB();
        const user = await User.findOne({ username: targetUsername });

        if (!user) {
          await client.sendMessage(message.chatId!, {
            message: `❌ User dengan username **${targetUsername}** tidak ditemukan di database.`,
            replyTo: message.id,
          });
          return;
        }

        // Hash dan Update Password
        const hashedPassword = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10);
        user.password = hashedPassword;
        await user.save();

        await client.sendMessage(message.chatId!, {
          message: `✅ **BERHASIL!**\nPassword untuk akun \`${targetUsername}\` telah direset menjadi: \`${DEFAULT_RESET_PASSWORD}\`\n\nSilakan sampaikan ke pengguna.`,
          replyTo: message.id,
        });

      } catch (error) {
        console.error("Bot Reset Password Error:", error);
        await client.sendMessage(message.chatId!, {
          message: "❌ Terjadi kesalahan server saat mencoba mereset password.",
          replyTo: message.id,
        });
      }
    }
  }, new NewMessage({}));
}
