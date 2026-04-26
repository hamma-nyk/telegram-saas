"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import AlbumManager from "@/components/dashboard/AlbumManager";
import SendMessage from "@/components/dashboard/SendMessage";
import TelegramAuth from "@/components/dashboard/TelegramAuth";
import MusicManager from "@/components/dashboard/MusicManager";
import {
  Repeat,
  Disc,
  X,
  Music,
  ChevronDown,
  SkipBack,
  SkipForward,
  Play,
  Pause,
} from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- UI & NAVIGATION STATES ---
  const [activeMenu, setActiveMenu] = useState("auth");
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);

  // --- MUSIC PLAYER STATES ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [playerState, setPlayerState] = useState<{
    playlist: any[];
    currentIndex: number;
  } | null>(null);

  // --- LOGIC: PLAYER CONTROLS ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (playerState) {
      if (playerState.currentIndex < playerState.playlist.length - 1) {
        setPlayerState({
          ...playerState,
          currentIndex: playerState.currentIndex + 1,
        });
      } else if (isRepeat) {
        setPlayerState({
          ...playerState,
          currentIndex: 0,
        });
      }
    }
  };

  const playPrev = () => {
    if (playerState && playerState.currentIndex > 0) {
      setPlayerState({
        ...playerState,
        currentIndex: playerState.currentIndex - 1,
      });
    }
  };

  // --- LOGIC: DRAGGABLE FUNCTION ---
  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLButtonElement
    )
      return;

    const el = e.currentTarget;
    const startX = e.clientX - el.offsetLeft;
    const startY = e.clientY - el.offsetTop;

    const onMouseMove = (event: MouseEvent) => {
      // Gunakan requestAnimationFrame agar gerakan super mulus
      requestAnimationFrame(() => {
        el.style.left = `${event.clientX - startX}px`;
        el.style.top = `${event.clientY - startY}px`;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // --- LOGIC: AUDIO HANDLERS ---
  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (audioRef.current) audioRef.current.volume = v;
    setVolume(v);
  };

  // --- AUTH PROTECTION ---
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const isConnected = session.user?.telegramConnected;

  return (
    <div className="flex h-screen bg-[#F7F9FC] font-sans text-gray-800 tracking-wide overflow-hidden relative">
      {/* SIDEBAR */}
      <Sidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        session={session}
        isConnected={isConnected}
      />

      {/* KONTEN UTAMA */}
      <main className="flex-1 overflow-y-auto p-8 md:p-12 relative">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 italic uppercase tracking-tighter">
              {activeMenu === "auth" && "System Authorization"}
              {activeMenu === "send-msg" && "Quick Message"}
              {activeMenu === "album" && "Cloud Photo Album"}
              {activeMenu === "music" && "Cloud Music Player"}
            </h2>
          </header>

          {activeMenu === "auth" && <TelegramAuth />}
          {activeMenu === "send-msg" && <SendMessage />}
          {activeMenu === "album" && <AlbumManager />}
          {activeMenu === "music" && (
            <MusicManager setPlayerState={setPlayerState} />
          )}
        </div>
      </main>

      {/* --- AUDIO ENGINE (ALWAYS ON) --- */}

      {playerState && (
        <audio
          ref={audioRef}
          autoPlay
          // src={`data:audio/mpeg;base64,${playerState.playlist[playerState.currentIndex].base64}`}
          src={playerState.playlist[playerState.currentIndex].url}
          onEnded={playNext}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)} // Tambahkan ini
          onPause={() => setIsPlaying(false)} // Tambahkan ini
        />
      )}

      {/* --- FLOATING BOX PLAYER --- */}
      {playerState && isPlayerVisible && (
        <div
          onMouseDown={handleDrag}
          className="fixed z-[999] w-80 bg-white/95 backdrop-blur-2xl border border-purple-100 shadow-2xl rounded-3xl overflow-hidden select-none animate-slide-up"
          style={{ top: "100px", right: "24px" }}
        >
          {/* Header */}
          <div className="bg-purple-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <Disc size={18} className="animate-spin-slow flex-shrink-0" />
              <p className="text-[11px] font-bold truncate">
                {playerState.playlist[playerState.currentIndex].title}
              </p>
            </div>
            <button
              onClick={() => setIsPlayerVisible(false)}
              className="hover:bg-white/20 p-1 rounded-lg transition"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Navigasi Utama */}
            <div className="flex justify-center items-center gap-6">
              {/* Tombol Previous */}
              <button
                onClick={playPrev}
                className="text-purple-400 hover:text-purple-600 transition-all"
              >
                <SkipBack size={22} fill="currentColor" />
              </button>

              {/* TOMBOL UTAMA: PLAY / PAUSE */}
              <button
                onClick={togglePlay}
                className="w-14 h-14 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-purple-200 hover:scale-110 active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause size={28} fill="currentColor" />
                ) : (
                  <Play size={28} fill="currentColor" className="ml-1" />
                )}
              </button>

              {/* Tombol Next */}
              <button
                onClick={playNext}
                className="text-purple-400 hover:text-purple-600 transition-all"
              >
                <SkipForward size={22} fill="currentColor" />
              </button>
            </div>

            {/* Repeat Button diletakkan di bawah atau samping secara proporsional */}
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setIsRepeat(!isRepeat)}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                  isRepeat
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <Repeat size={12} /> REPEAT {isRepeat ? "ON" : "OFF"}
              </button>
            </div>

            {/* CUSTOM SEEKBAR */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-[10px] font-bold text-gray-400">
                <span>
                  {new Date(currentTime * 1000).toISOString().substr(14, 5)}
                </span>
                <span>
                  {new Date(duration * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
            </div>

            {/* VOLUME CONTROL */}
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl">
              <Music size={14} className="text-purple-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTON (WHILE HIDDEN) */}
      {!isPlayerVisible && (
        <button
          onClick={() => setIsPlayerVisible(true)}
          className="fixed bottom-8 right-8 z-[1000] w-16 h-16 bg-purple-600 text-white rounded-full shadow-[0_20px_50px_rgba(147,51,234,0.3)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-white animate-bounce"
        >
          <Music size={28} />
        </button>
      )}
    </div>
  );
}
