"use client";
import { signOut } from "next-auth/react";
import {
  Smartphone,
  Send,
  Images,
  Music as MusicIcon,
  ChevronRight,
} from "lucide-react";
export default function Sidebar({
  activeMenu,
  setActiveMenu,
  session,
  isConnected,
}: any) {
  return (
    <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shadow-sm z-10">
      <div className="p-8 border-b border-gray-50">
        <h1 className="text-2xl font-black text-gray-900 tracking-tighter">
          OMNICHANNEL.
        </h1>
        <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">
          SaaS Control Panel
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="text-xs font-bold text-gray-400 mb-3 ml-4 mt-4 uppercase tracking-widest">
          Telegram Core
        </div>

        <button
          onClick={() => setActiveMenu("auth")}
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
            activeMenu === "auth"
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Smartphone
            size={18}
            className={
              activeMenu === "auth"
                ? "text-blue-600"
                : "text-gray-400 group-hover:text-gray-600"
            }
          />
          <span>Status & Koneksi</span>
          {isConnected && (
            <span className="ml-auto flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>

        <button
          onClick={() =>
            isConnected
              ? setActiveMenu("send-msg")
              : alert("Koneksikan Telegram dulu!")
          }
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
            !isConnected ? "opacity-50 cursor-not-allowed" : ""
          } ${
            activeMenu === "send-msg"
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Send
            size={18}
            className={
              activeMenu === "send-msg"
                ? "text-blue-600"
                : "text-gray-400 group-hover:text-gray-600"
            }
          />
          <span>Test Kirim Pesan</span>
        </button>

        <button
          onClick={() =>
            isConnected
              ? setActiveMenu("album")
              : alert("Koneksikan Telegram dulu!")
          }
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
            !isConnected ? "opacity-50 cursor-not-allowed" : ""
          } ${
            activeMenu === "album"
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Images
            size={18}
            className={
              activeMenu === "album"
                ? "text-blue-600"
                : "text-gray-400 group-hover:text-gray-600"
            }
          />
          <span>Channel Album</span>
        </button>

        <button
          onClick={() =>
            isConnected ? setActiveMenu("music") : alert("Koneksikan Telegram!")
          }
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
            !isConnected ? "opacity-50 cursor-not-allowed" : ""
          } ${
            activeMenu === "music"
              ? "bg-purple-50 text-purple-600"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <MusicIcon
            size={18}
            className={
              activeMenu === "music"
                ? "text-purple-600"
                : "text-gray-400 group-hover:text-gray-600"
            }
          />
          <span>Channel Music</span>
        </button>
      </nav>

      <div className="p-6 border-t border-gray-50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold uppercase">
            {session?.user?.name?.[0]}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-gray-900 truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs text-gray-400 truncate">Administrator</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full rounded-xl bg-red-50 py-3 text-xs font-bold text-red-600 hover:bg-red-100 transition"
        >
          LOGOUT SISTEM
        </button>
      </div>
    </aside>
  );
}
