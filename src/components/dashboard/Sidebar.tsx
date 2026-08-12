"use client";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Smartphone,
  Send,
  Images,
  Music as MusicIcon,
  ChevronRight,
  X,
  Sun,
  Moon,
} from "lucide-react";
export default function Sidebar({
  activeMenu,
  setActiveMenu,
  session,
  isConnected,
  isOpen,
  setIsOpen,
}: any) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="absolute top-4 right-4 md:hidden">
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground p-2">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 md:p-8 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          NAOCLOUD.
        </h1>
        <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">
          SaaS Control Panel
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="text-xs font-medium text-muted-foreground mb-3 ml-4 mt-4 uppercase tracking-wider">
          Telegram Core
        </div>

        <button
          onClick={() => {
            setActiveMenu("auth");
            setIsOpen?.(false);
          }}
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all ${
            activeMenu === "auth"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <Smartphone
            size={18}
            className={
              activeMenu === "auth"
                ? "text-accent-foreground"
                : "text-muted-foreground group-hover:text-accent-foreground"
            }
          />
          <span>Akun & Telegram</span>
          {isConnected && (
            <span className="ml-auto flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </button>

        <button
          onClick={() => {
            if (isConnected) {
              setActiveMenu("send-msg");
              setIsOpen?.(false);
            } else {
              alert("Koneksikan Telegram dulu!");
            }
          }}
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all ${
            !isConnected ? "opacity-50 cursor-not-allowed" : ""
          } ${
            activeMenu === "send-msg"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <Send
            size={18}
            className={
              activeMenu === "send-msg"
                ? "text-accent-foreground"
                : "text-muted-foreground group-hover:text-accent-foreground"
            }
          />
          <span>Test Kirim Pesan</span>
        </button>

        <button
          onClick={() => {
            if (isConnected) {
              setActiveMenu("album");
              setIsOpen?.(false);
            } else {
              alert("Koneksikan Telegram dulu!");
            }
          }}
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all ${
            !isConnected ? "opacity-50 cursor-not-allowed" : ""
          } ${
            activeMenu === "album"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <Images
            size={18}
            className={
              activeMenu === "album"
                ? "text-accent-foreground"
                : "text-muted-foreground group-hover:text-accent-foreground"
            }
          />
          <span>Channel Album</span>
        </button>

        <button
          onClick={() => {
            if (isConnected) {
              setActiveMenu("music");
              setIsOpen?.(false);
            } else {
              alert("Koneksikan Telegram!");
            }
          }}
          className={`w-full group flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all ${
            !isConnected ? "opacity-50 cursor-not-allowed" : ""
          } ${
            activeMenu === "music"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <MusicIcon
            size={18}
            className={
              activeMenu === "music"
                ? "text-accent-foreground"
                : "text-muted-foreground group-hover:text-accent-foreground"
            }
          />
          <span>Channel Music</span>
        </button>
      </nav>

      <div className="p-6 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-medium uppercase">
            {session?.user?.name?.[0]}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">Administrator</p>
          </div>
        </div>

        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full mb-2 flex items-center justify-center gap-2 rounded-md border border-input bg-background py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        )}

        <button
          onClick={() => signOut()}
          className="w-full rounded-md border border-input bg-background py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          LOGOUT
        </button>
      </div>
    </aside>
    </>
  );
}
