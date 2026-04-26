"use client";
import { useState } from "react";

export default function SendMessage() {
  const [targetChat, setTargetChat] = useState("me");
  const [textMessage, setTextMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState("");

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true); setSendResult("Sedang mengirim...");
    try {
      const res = await fetch("/api/telegram/send-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: targetChat, message: textMessage }) });
      const data = await res.json();
      if (data.success) { setSendResult("✅ Pesan terkirim!"); setTextMessage(""); } else setSendResult(`❌ Error: ${data.error}`);
    } catch (err) { setSendResult("❌ Kesalahan jaringan."); } 
    finally { setIsSending(false); }
  };

  return (
    <div className="rounded-3xl bg-white p-8 border border-gray-100 shadow-sm">
      <div className="mb-6 border-b border-gray-100 pb-4"><h3 className="text-lg font-bold text-gray-900">Kirim Pesan (Test)</h3></div>
      <form onSubmit={handleSendMessage} className="space-y-5">
        <input type="text" value={targetChat} onChange={(e) => setTargetChat(e.target.value)} placeholder="Target: @username atau me" className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none focus:border-blue-500" required />
        <textarea value={textMessage} onChange={(e) => setTextMessage(e.target.value)} placeholder="Isi pesan..." className="h-32 w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none resize-none focus:border-blue-500" required />
        <button type="submit" disabled={isSending} className="w-full rounded-2xl bg-gray-900 py-4 text-sm font-bold text-white hover:bg-black">{isSending ? "MENGIRIM..." : "KIRIM PESAN"}</button>
        {sendResult && <div className="mt-4 text-center text-sm font-bold">{sendResult}</div>}
      </form>
    </div>
  );
}