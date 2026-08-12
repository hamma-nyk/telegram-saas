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
    <div className="min-h-screen bg-background text-foreground font-sans scroll-smooth">
      
      {/* --- NAVBAR --- */}
      <nav className={`fixed top-0 w-full z-[100] transition-colors duration-300 ${
        scrolled ? "bg-background/80 backdrop-blur-md border-b border-border py-4" : "bg-transparent py-6"
      }`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 flex items-center justify-center text-foreground transition-opacity hover:opacity-80">
              <Zap size={20} />
            </div>
            <span className="text-lg font-semibold tracking-tight">Naocloud</span>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            
            <div className="h-4 w-[1px] bg-border" />

            {status === "authenticated" ? (
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-foreground">{session.user?.name}</span>
                <Link href="/dashboard" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Login
                </Link>
                <Link href="/register" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                  <UserPlus size={16} />
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden p-2 text-foreground" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenu && (
        <div className="fixed inset-0 bg-background z-[90] flex flex-col p-8 pt-24 gap-6 md:hidden border-b border-border">
          <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-lg font-semibold text-foreground">Features</a>
          <Link href="/login" className="text-lg font-semibold text-foreground">Login</Link>
          <Link href="/register" className="text-lg font-semibold text-primary">Register</Link>
        </div>
      )}

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32">
        <div className="max-w-3xl mx-auto px-6 md:px-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-border bg-muted/50 text-muted-foreground text-xs font-medium">
            <ShieldCheck size={14} />
            <span>Secured by Telegram MTProto</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-8 text-foreground">
            Clean cloud storage <br className="hidden md:block" /> 
            for your assets.
          </h1>
          
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            Transform your private Telegram channels into a reliable cloud storage solution. 
            Unlimited space, end-to-end encrypted, and accessible anywhere.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={status === "authenticated" ? "/dashboard" : "/login"} className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              {status === "authenticated" ? "Go to Dashboard" : "Get Started"}
              <ChevronRight size={16} />
            </Link>
            
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className="w-full sm:w-auto px-8 py-3 rounded-md font-medium text-sm text-foreground border border-border hover:bg-muted transition-colors text-center"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section id="features" className="py-24 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4 text-foreground">
              Storage without compromise
            </h2>
            <p className="text-muted-foreground">Leverage Telegram's cloud infrastructure with a modern interface.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                icon: <ImageIcon size={24} />, 
                title: "Asset Management", 
                desc: "Clean, fast, and intuitive interface for all your private channel media." 
              },
              { 
                icon: <Calendar size={24} />, 
                title: "Auto Formatting", 
                desc: "Automatically organize metadata, dates, and media visibility intelligently." 
              },
              { 
                icon: <Trash2 size={24} />, 
                title: "Soft Delete", 
                desc: "Full privacy control. Hide media from the dashboard without deleting source files." 
              }
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-lg border border-border bg-background transition-colors hover:border-primary/50">
                <div className="mb-6 text-foreground">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-foreground">
              <Zap size={16} />
              <span className="font-semibold tracking-tight">Naocloud</span>
            </div>
            
            <div className="flex gap-6">
              <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Support</a>
            </div>

            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Naocloud
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}