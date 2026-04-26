"use client";

import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  RefreshCw,
  ShieldCheck,
  LogOut,
  Smartphone,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function TelegramAuth() {
  const { data: session, update } = useSession();
  const eventSourceRef = useRef<EventSource | null>(null);

  const [qrUrl, setQrUrl] = useState("");
  const [loadingQr, setLoadingQr] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [cloudPassword, setCloudPassword] = useState("");

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  const handleLogoutTelegram = async () => {
    const isConfirm = confirm(
      "Yakin ingin memutuskan koneksi Telegram? Anda harus scan QR lagi nanti.",
    );
    if (!isConfirm) return;

    try {
      const res = await fetch("/api/telegram/logout", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await update();
        window.location.reload();
      }
    } catch (err) {
      alert("Gagal memutuskan koneksi.");
    }
  };

  const handleGenerateQR = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setLoadingQr(true);
    setRequires2FA(false);
    setQrUrl("");
    setStatusText("Meminta QR Code...");

    const eventSource = new EventSource("/api/telegram/qr");
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("qr", (e) => {
      const data = JSON.parse(e.data);
      setQrUrl(data.url);
      setStatusText("Scan QR ini melalui aplikasi Telegram di HP Anda.");
      setLoadingQr(false);
    });

    eventSource.addEventListener("require_2fa", (e) => {
      setStatusText(JSON.parse(e.data).message);
      setRequires2FA(true);
      setQrUrl("");
    });

    eventSource.addEventListener("success", async () => {
      setStatusText("✅ Berhasil! Menyinkronkan layar...");
      eventSource.close();
      await update();
      window.location.reload();
    });

    eventSource.addEventListener("error", (e) => {
      setStatusText(`Gagal: ${e || "Terjadi kesalahan."}`);
      setLoadingQr(false);
      setRequires2FA(false);
      eventSource.close();
    });
  };

  const submit2FA = async () => {
    if (!cloudPassword) return;
    setStatusText("Mengirim password... Tunggu hingga terkoneksi.");
    try {
      await fetch("/api/telegram/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: cloudPassword }),
      });
      setCloudPassword("");
    } catch (err) {
      setStatusText("❌ Gagal mengirim password.");
    }
  };

  const forceSync = async () => {
    setStatusText("Mengecek database...");
    await update();
    window.location.reload();
  };

  // --- TAMPILAN JIKA SUDAH TERHUBUNG ---
  if (session?.user?.telegramConnected) {
    return (
      <div className="rounded-3xl bg-white p-8 border border-gray-100 shadow-sm animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-50 text-emerald-600 shadow-inner border border-emerald-100">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Telegram Terhubung
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-emerald-700 text-xs font-bold uppercase tracking-widest">
                  Sesi Aktif & Aman
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogoutTelegram}
            className="group w-full md:w-auto px-6 py-3.5 rounded-2xl bg-rose-50 text-rose-600 text-xs font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all border border-rose-100 flex items-center justify-center gap-2"
          >
            <LogOut
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Putuskan Koneksi
          </button>
        </div>
      </div>
    );
  }

  // --- TAMPILAN JIKA BELUM TERHUBUNG ---
  return (
    <div className="rounded-[2.5rem] bg-white p-10 text-center border border-gray-100 shadow-sm overflow-hidden relative">
      {!qrUrl && !loadingQr && !requires2FA && (
        <div className="mx-auto max-w-sm animate-in zoom-in-95 duration-300">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-blue-50 text-blue-600 border border-blue-100 shadow-inner">
            <Smartphone size={40} strokeWidth={1.5} />
          </div>
          <h3 className="mb-3 text-2xl font-black text-slate-900 tracking-tighter">
            OTORISASI TELEGRAM
          </h3>
          <p className="mb-10 text-sm text-slate-400 font-medium leading-relaxed italic">
            Hubungkan akun Anda untuk mengaktifkan fitur sinkronisasi album
            otomatis.
          </p>
          <div className="space-y-4">
            <button
              onClick={handleGenerateQR}
              className="group w-full flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-8 py-5 text-sm font-black text-white hover:bg-slate-900 shadow-xl shadow-blue-100 transition-all active:scale-95"
            >
              <QrCode size={20} />
              KONEKSIKAN VIA QR
            </button>
            <button
              onClick={forceSync}
              className="group w-full flex items-center justify-center gap-3 rounded-2xl bg-slate-50 px-8 py-5 text-sm font-black text-slate-500 hover:bg-slate-100 transition border border-slate-200"
            >
              <RefreshCw
                size={18}
                className="group-hover:rotate-180 transition-transform duration-500"
              />
              SINKRONKAN MANUAL
            </button>
          </div>
        </div>
      )}

      {loadingQr && !requires2FA && !qrUrl && (
        <div className="py-20 animate-in fade-in">
          <Loader2
            size={48}
            className="mx-auto mb-6 text-blue-600 animate-spin"
          />
          <p className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] animate-pulse">
            {statusText}
          </p>
        </div>
      )}

      {qrUrl && !requires2FA && (
        <div className="mx-auto max-w-xs py-4 animate-in slide-in-from-bottom-5 duration-500">
          <div className="overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-2xl border border-slate-100 mb-8 ring-8 ring-slate-50">
            <QRCodeSVG value={qrUrl} size={256} className="w-full h-auto" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-6">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <p className="font-black text-[10px] text-blue-600 uppercase tracking-widest">
              {statusText}
            </p>
          </div>
          <button
            onClick={() => {
              eventSourceRef.current?.close();
              setQrUrl("");
              setLoadingQr(false);
            }}
            className="group flex items-center justify-center gap-2 mx-auto text-xs font-black text-slate-400 hover:text-rose-600 transition-colors uppercase tracking-widest"
          >
            <XCircle size={14} />
            BATALKAN PROSES
          </button>
        </div>
      )}

      {requires2FA && (
        <div className="mx-auto max-w-xs space-y-6 py-4 animate-in zoom-in-95">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-amber-50 text-amber-600 border border-amber-100 shadow-inner">
            <Lock size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              Cloud Password
            </h3>
            <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
              <AlertCircle size={12} /> {statusText}
            </p>
          </div>
          <input
            type="password"
            value={cloudPassword}
            onChange={(e) => setCloudPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center text-xl font-black tracking-[0.5em] focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner placeholder:tracking-normal placeholder:text-slate-300"
          />
          <button
            onClick={submit2FA}
            disabled={!cloudPassword}
            className="w-full rounded-2xl bg-slate-900 py-5 font-black text-xs text-white uppercase tracking-[0.2em] hover:bg-blue-600 disabled:bg-slate-200 shadow-xl transition-all active:scale-95"
          >
            VERIFIKASI SEKARANG
          </button>
        </div>
      )}
    </div>
  );
}
