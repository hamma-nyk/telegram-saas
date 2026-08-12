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
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  useEffect(() => {
    if (session?.user?.telegramConnected) {
      fetch("/api/telegram/me")
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) setProfileData(data);
        })
        .catch(console.error);
    }
  }, [session?.user?.telegramConnected]);

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
    const initials = profileData
      ? `${profileData.firstName?.[0] || ""}${profileData.lastName?.[0] || ""}`
      : "TG";

    return (
      <div className="rounded-xl bg-card p-6 border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 w-full md:w-auto">
          {/* Avatar / Icon */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xl font-bold uppercase">
            {initials}
          </div>
          
          {/* Details */}
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              {profileData?.firstName} {profileData?.lastName || ""}
              <ShieldCheck className="h-5 w-5 text-primary" />
            </h2>
            
            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {profileData?.username && (
                <span className="flex items-center gap-1">
                  <span className="font-medium text-foreground">@</span>{profileData.username}
                </span>
              )}
              {profileData?.phone && (
                <span className="flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" /> +{profileData.phone}
                </span>
              )}
              {profileData?.id && (
                <span className="flex items-center gap-1">
                  ID: {profileData.id}
                </span>
              )}
            </div>
            
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground w-fit">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Sesi Aktif
            </div>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={handleLogoutTelegram}
          className="w-full md:w-auto px-4 py-2 h-10 rounded-md border border-input bg-background hover:bg-destructive hover:text-destructive-foreground transition-colors text-sm font-medium flex items-center justify-center gap-2 text-foreground whitespace-nowrap"
        >
          <LogOut size={16} />
          Putuskan Koneksi
        </button>
      </div>
    );
  }

  // --- TAMPILAN JIKA BELUM TERHUBUNG ---
  return (
    <div className="rounded-lg bg-card p-10 text-center border border-border shadow-sm overflow-hidden relative">
      {!qrUrl && !loadingQr && !requires2FA && (
        <div className="mx-auto max-w-sm">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-md bg-accent text-accent-foreground border border-border">
            <Smartphone size={40} strokeWidth={1.5} />
          </div>
          <h3 className="mb-3 text-2xl font-bold text-foreground tracking-tight">
            OTORISASI TELEGRAM
          </h3>
          <p className="mb-10 text-sm text-muted-foreground">
            Hubungkan akun Anda untuk mengaktifkan fitur sinkronisasi album
            otomatis.
          </p>
          <div className="space-y-4">
            <button
              onClick={handleGenerateQR}
              className="w-full flex items-center justify-center gap-3 rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <QrCode size={20} />
              KONEKSIKAN VIA QR
            </button>
            <button
              onClick={forceSync}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-input bg-background px-8 py-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <RefreshCw size={18} />
              SINKRONKAN MANUAL
            </button>
          </div>
        </div>
      )}

      {loadingQr && !requires2FA && !qrUrl && (
        <div className="py-20">
          <Loader2
            size={48}
            className="mx-auto mb-6 text-muted-foreground animate-spin"
          />
          <p className="text-sm font-medium text-muted-foreground">
            {statusText}
          </p>
        </div>
      )}

      {qrUrl && !requires2FA && (
        <div className="mx-auto max-w-xs py-4">
          <div className="overflow-hidden rounded-md bg-white p-6 border border-border mb-8">
            <QRCodeSVG value={qrUrl} size={256} className="w-full h-auto" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-6">
            <CheckCircle2 size={16} className="text-primary" />
            <p className="text-sm font-medium text-foreground">
              {statusText}
            </p>
          </div>
          <button
            onClick={() => {
              eventSourceRef.current?.close();
              setQrUrl("");
              setLoadingQr(false);
            }}
            className="flex items-center justify-center gap-2 mx-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle size={16} />
            BATALKAN PROSES
          </button>
        </div>
      )}

      {requires2FA && (
        <div className="mx-auto max-w-xs space-y-6 py-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-md bg-accent text-accent-foreground border border-border">
            <Lock size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">
              Cloud Password
            </h3>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <AlertCircle size={14} /> {statusText}
            </p>
          </div>
          <input
            type="password"
            value={cloudPassword}
            onChange={(e) => setCloudPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-input bg-background p-3 text-center text-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors text-foreground"
          />
          <button
            onClick={submit2FA}
            disabled={!cloudPassword}
            className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            VERIFIKASI SEKARANG
          </button>
        </div>
      )}
    </div>
  );
}
