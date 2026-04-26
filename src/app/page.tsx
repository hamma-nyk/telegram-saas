"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Image as ImageIcon, 
  Calendar, 
  Trash2, 
  ChevronRight, 
  LayoutDashboard, 
  LogIn, 
  UserPlus,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Menu,
  X
} from "lucide-react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // Efek Navbar & Scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth Scroll Function
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: "smooth",
      });
      setMobileMenu(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white scroll-smooth">
      
      {/* --- NAVBAR --- */}
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 ${
        scrolled ? "bg-white/70 backdrop-blur-xl shadow-sm py-3" : "bg-transparent py-6"
      }`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
          <div className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:rotate-12 transition-transform duration-300">
              <Zap size={20} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic">OmniAlbum</span>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-10">
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              Fitur Utama
            </a>
            
            <div className="h-4 w-[1px] bg-slate-200" />

            {status === "authenticated" ? (
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Session</span>
                  <span className="text-sm font-bold text-slate-900">{session.user?.name}</span>
                </div>
                <Link href="/dashboard" className="group flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all duration-300">
                  <LayoutDashboard size={16} />
                  Dashboard
                  <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-8">
                <Link href="/login" className="flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-blue-600 transition-all">
                  <LogIn size={16} />
                  Login
                </Link>
                <Link href="/register" className="flex items-center gap-2 bg-blue-600 text-white px-7 py-3.5 rounded-2xl text-sm font-bold shadow-xl shadow-blue-100 hover:bg-slate-900 hover:shadow-slate-200 transition-all duration-300">
                  <UserPlus size={16} />
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden p-2 text-slate-900" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenu && (
        <div className="fixed inset-0 bg-white z-[90] flex flex-col p-10 pt-32 gap-8 md:hidden">
          <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-3xl font-black italic">FITUR</a>
          <Link href="/login" className="text-3xl font-black italic">LOGIN</Link>
          <Link href="/register" className="text-3xl font-black italic text-blue-600">REGISTER</Link>
        </div>
      )}

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 md:pt-56 md:pb-40 overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/30 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-purple-200/20 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-2xl bg-white border border-slate-100 text-blue-600 shadow-sm shadow-blue-50">
            <ShieldCheck size={16} className="fill-blue-50" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">Secured by Telegram MTProto</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black leading-[0.9] tracking-tighter mb-10 text-slate-900">
            YOUR <span className="text-blue-600 italic">MEMORIES</span> <br /> 
            DESERVE BETTER.
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 mb-14 leading-relaxed font-medium">
            Ubah grup dan channel private Telegram Anda menjadi galeri foto premium. 
            Tanpa batas penyimpanan, terenkripsi, dan dapat diakses dari mana saja.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link href={status === "authenticated" ? "/dashboard" : "/login"} className="group w-full sm:w-auto bg-slate-900 text-white px-12 py-6 rounded-[2rem] font-bold text-lg shadow-2xl shadow-slate-300 hover:bg-blue-600 transition-all duration-500 flex items-center justify-center gap-3">
              {status === "authenticated" ? "Masuk ke Dashboard" : "Mulai Sekarang"}
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className="w-full sm:w-auto px-12 py-6 rounded-[2rem] font-bold text-lg text-slate-600 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 border border-transparent hover:border-slate-100"
            >
              Pelajari Fitur
            </a>
          </div>
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section id="features" className="py-32 bg-white relative">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-6">
            <div className="max-w-xl">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-none">
                SIMPAN MOMEN <br />TANPA KOMPROMI.
              </h2>
              <p className="text-slate-500 font-medium italic">Manfaatkan cloud Telegram dengan tampilan dashboard modern.</p>
            </div>
            <div className="text-blue-600 font-black text-8xl opacity-5 hidden md:block">01</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: <ImageIcon className="text-blue-600" size={32} />, 
                title: "Cloud Gallery", 
                desc: "Antarmuka galeri yang bersih, cepat, dan intuitif untuk semua foto channel private Anda." 
              },
              { 
                icon: <Calendar className="text-emerald-500" size={32} />, 
                title: "Auto Formatting", 
                desc: "Sistem otomatis mengatur metadata, tanggal, dan status tampilan media Anda secara cerdas." 
              },
              { 
                icon: <Trash2 className="text-rose-500" size={32} />, 
                title: "Soft Delete", 
                desc: "Kendali penuh atas privasi. Sembunyikan media dari gallery tanpa menghapus file aslinya." 
              }
            ].map((f, i) => (
              <div key={i} className="p-12 rounded-[3rem] bg-[#F7F9FC] border border-slate-50 hover:bg-white hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-500 group">
                <div className="mb-8 p-4 bg-white inline-block rounded-2xl shadow-sm group-hover:-rotate-6 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-black mb-4 tracking-tight">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-20 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <Zap size={16} fill="currentColor" />
              </div>
              <span className="font-black uppercase tracking-tighter italic">OmniAlbum</span>
            </div>
            
            <div className="flex gap-10">
              <a href="#" className="text-xs font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Privacy</a>
              <a href="#" className="text-xs font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Terms</a>
              <a href="#" className="text-xs font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Support</a>
            </div>

            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              © 2026 Crafted for Professional
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}