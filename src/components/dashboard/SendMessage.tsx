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
    <div className="rounded-lg bg-card p-6 border border-border">
      <div className="mb-6"><h3 className="text-lg font-semibold text-foreground">Kirim Pesan (Test)</h3></div>
      <form onSubmit={handleSendMessage} className="space-y-4">
        <input type="text" value={targetChat} onChange={(e) => setTargetChat(e.target.value)} placeholder="Target: @username atau me" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required />
        <textarea value={textMessage} onChange={(e) => setTextMessage(e.target.value)} placeholder="Isi pesan..." className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none" required />
        <button type="submit" disabled={isSending} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">{isSending ? "MENGIRIM..." : "KIRIM PESAN"}</button>
        {sendResult && <div className="mt-4 text-center text-sm font-medium text-foreground">{sendResult}</div>}
      </form>
    </div>
  );
}