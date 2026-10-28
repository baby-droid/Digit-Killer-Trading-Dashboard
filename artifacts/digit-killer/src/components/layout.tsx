import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { GlobalSignalMonitor } from "@/components/global-signal-monitor";
import { unlockAudio, getSoundEnabled, toggleSound } from "@/lib/sound";
import {
  LayoutDashboard, Activity, Zap, Binary, MonitorPlay,
  Lightbulb, BrainCircuit, TrendingUp, Settings, Cpu,
  BrainCog, TrendingDown, DollarSign, Sparkles, LogOut,
  Eye, Calculator, ChevronLeft, ChevronRight, Menu, X,
  ArrowUpDown, BarChart2, Volume2, VolumeX,
} from "lucide-react";
import {
  MARKETS, MARKETS_BY_CATEGORY, CATEGORY_LABELS, MarketCategory,
} from "@/hooks/useDerivWebSocket";
import { useMarket } from "@/lib/market-context";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { name: "Dashboard",       href: "/",               icon: LayoutDashboard },
  { name: "Smart Trade",     href: "/smart-trade",    icon: BrainCog },
  { name: "Smart Signals",   href: "/smart-signals",  icon: Sparkles,   badge: "HOT" },
  { name: "Mark Syn Trader Signal", href: "/mark-syn-trader-signal", icon: Activity, badge: "LIVE" },
  { name: "Wide Eye View",   href: "/wide-eye",       icon: Eye },
  { name: "Under 4 / Under 5 Analyser", href: "/under-4-under-5-analyser", icon: Binary, badge: "LIVE" },
  { name: "Market Scanner",  href: "/scanner",        icon: Activity },
  { name: "AI Signals",      href: "/signals",        icon: Zap },
  { name: "Tick Generator",  href: "/tick-generator", icon: Cpu },
  { name: "Matches & Differs", href: "/matches-differs", icon: Binary, badge: "AI" },
  { name: "Only Ups / Downs",  href: "/only-ups-downs",  icon: ArrowUpDown },
  { name: "Rise & Fall",     href: "/rise-fall",      icon: TrendingUp },
  { name: "High / Low Tick", href: "/high-low-tick",  icon: BarChart2 },
  { name: "Digit Analysis",  href: "/analysis",       icon: Binary },
  { name: "Trade Desk",      href: "/trade-desk",     icon: MonitorPlay },
  { name: "Strategies",      href: "/strategies",     icon: Lightbulb },
  { name: "Forex · Gold",    href: "/forex",          icon: DollarSign },
  { name: "Risk Calculator", href: "/risk-calculator",icon: Calculator },
  { name: "AI Learning",     href: "/learning",       icon: BrainCircuit },
  { name: "Performance",     href: "/performance",    icon: TrendingUp },
  { name: "Settings",        href: "/settings",       icon: Settings },
];

const CATEGORY_ICONS: Partial<Record<MarketCategory, React.ReactNode>> = {
  volatility: <Activity className="w-3 h-3" />,
  crash_boom: <TrendingDown className="w-3 h-3" />,
  jump:       <Zap className="w-3 h-3" />,
  bear_bull:  <TrendingUp className="w-3 h-3" />,
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location]          = useLocation();
  const { activeMarket, setActiveMarket } = useMarket();
  const { session, isAdmin, logout }      = useAuth();
  const [activeCategory, setActiveCategory] = useState<MarketCategory>("volatility");
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt?: () => void } | null>(null);
  const [showInstall,    setShowInstall]    = useState(false);
  const [soundOn,        setSoundOn]        = useState(() => getSoundEnabled());

  useEffect(() => { setMobileOpen(false); }, [location]);

  useEffect(() => {
    const unlock = () => { unlockAudio(); document.removeEventListener("click", unlock); };
    document.addEventListener("click", unlock, { once: true });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt?: () => void });
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    await deferredPrompt?.prompt?.();
    setDeferredPrompt(null);
    setShowInstall(false);
  };

  const handleSoundToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = toggleSound();
    setSoundOn(next);
  };

  const activeMkt         = MARKETS.find((m) => m.symbol === activeMarket);
  const activeMarketName  = activeMkt?.name ?? activeMarket;
  const isForexPage       = location === "/forex";

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* ── Global AI signal sound monitor (active on all pages) ── */}
      <GlobalSignalMonitor />

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50",
          "md:relative md:z-auto md:translate-x-0",
          "flex flex-col flex-shrink-0",
          "bg-sidebar border-r border-sidebar-border",
          "transition-all duration-300 ease-in-out",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          collapsed ? "md:w-16" : "w-64",
        ].join(" ")}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-sidebar-border gap-3 flex-shrink-0 ${collapsed ? "px-3 justify-center" : "px-4"}`}>
          <img
            src={`${import.meta.env.BASE_URL}logo.png`.replace("//", "/")}
            alt="Logo"
            className="w-9 h-9 rounded-full flex-shrink-0"
            style={{ filter: "drop-shadow(0 0 8px rgba(0,209,209,0.6))" }}
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-[11px] tracking-widest text-primary truncate">AHMED SYNTRADER</div>
              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                <span className="truncate">{isForexPage ? "XAU/USD" : activeMarketName} Live</span>
              </div>
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Session badge */}
        {!collapsed && (
          <div className="px-4 py-2 border-b border-sidebar-border/50 flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {isAdmin ? "👑 ADMIN" : `👤 ${session?.userName ?? "User"}`}
            </span>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {/* Sound toggle (sidebar) */}
              <button
                onClick={handleSoundToggle}
                title={soundOn ? "Sound ON — click to mute" : "Sound OFF — click to unmute"}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {soundOn
                  ? <Volume2 className="w-3.5 h-3.5 text-primary" />
                  : <VolumeX className="w-3.5 h-3.5 text-red-400" />}
              </button>
              <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors" title="Logout">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="py-2 border-b border-sidebar-border/50 flex flex-col items-center gap-2">
            <button
              onClick={handleSoundToggle}
              title={soundOn ? "Sound ON" : "Sound OFF"}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {soundOn
                ? <Volume2 className="w-3.5 h-3.5 text-primary" />
                : <VolumeX className="w-3.5 h-3.5 text-red-400" />}
            </button>
            <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors" title="Logout">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5 scrollbar-thin">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={[
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/20 shadow-[0_0_8px_rgba(0,209,209,0.1)]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground border border-transparent",
                ].join(" ")}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/60"}`} />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.name}</span>
                    {"badge" in item && item.badge && (
                      <span className="text-[8px] font-black bg-primary/20 text-primary rounded px-1 py-0.5 flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden md:flex items-center justify-center gap-2 mx-2 my-2 p-2 rounded-md border border-sidebar-border/50 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30 transition-all text-[10px] font-mono"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>}
        </button>

        {/* Footer */}
        {!collapsed && (
          <div className="px-3 py-2 border-t border-sidebar-border text-[9px] text-muted-foreground/50 text-center font-mono tracking-wider">
            DK v2.1 · ahmedsyntrader.site
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Header ── */}
        {isForexPage ? (
          <header
            className="h-12 flex items-center px-4 gap-3 flex-shrink-0 border-b"
            style={{ background: "linear-gradient(135deg,rgba(5,46,22,0.95),rgba(3,30,15,0.98))", borderColor: "#166534" }}
          >
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(true)} className="md:hidden mr-1 text-green-400">
              <Menu className="w-5 h-5" />
            </button>
            <DollarSign className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <span className="font-bold text-sm tracking-wide" style={{ color: "#4ade80" }}>FOREX ANALYSIS</span>
            <span className="text-green-700 text-xs">|</span>
            <span className="font-mono text-sm font-bold text-white">Gold / USD · XAU/USD</span>
            <div className="ml-auto flex items-center gap-3 text-xs text-green-500 font-mono">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Live Spot
              {/* Sound toggle in header (forex page) */}
              <button
                onClick={handleSoundToggle}
                title={soundOn ? "Sound ON" : "Sound OFF"}
                className="ml-2 text-green-500 hover:text-green-300 transition-colors"
              >
                {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
              </button>
            </div>
          </header>
        ) : (
          <header className="flex-shrink-0 border-b" style={{ background: "linear-gradient(180deg,rgba(5,46,22,0.9) 0%,rgba(3,25,12,0.95) 100%)", borderColor: "#166534" }}>
            {/* Row 1: hamburger + categories + sound toggle */}
            <div className="flex items-center px-3 gap-1 h-10 border-b overflow-x-auto hide-scrollbar" style={{ borderColor: "#14532d" }}>
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden mr-2 flex-shrink-0 text-green-400 hover:text-green-300"
              >
                <Menu className="w-5 h-5" />
              </button>
              {(Object.keys(MARKETS_BY_CATEGORY) as MarketCategory[])
                .filter((cat) => MARKETS_BY_CATEGORY[cat].length > 0)
                .map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    const first = MARKETS_BY_CATEGORY[cat][0];
                    if (first) setActiveMarket(first.symbol);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                    activeCategory === cat
                      ? "text-white border border-green-500/50"
                      : "text-green-600 hover:text-green-300 hover:bg-green-900/30 border border-transparent"
                  }`}
                  style={activeCategory === cat ? { backgroundColor: "#15803d", boxShadow: "0 0 8px rgba(34,197,94,0.25)" } : {}}
                >
                  {CATEGORY_ICONS[cat] ?? <Activity className="w-3 h-3" />}
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
              {/* Sound toggle — always visible in header */}
              <button
                onClick={handleSoundToggle}
                title={soundOn ? "Sound ON — click to mute" : "Sound OFF — click to unmute"}
                className="ml-auto flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded border transition-all text-[10px] font-bold"
                style={{
                  borderColor: soundOn ? "#22c55e55" : "#ef444455",
                  color:       soundOn ? "#22c55e"   : "#ef4444",
                  background:  soundOn ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                }}
              >
                {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{soundOn ? "Sound ON" : "MUTED"}</span>
              </button>
            </div>
            {/* Row 2: market pills */}
            <div className="flex items-center px-3 gap-1.5 h-11 overflow-x-auto hide-scrollbar">
              {MARKETS_BY_CATEGORY[activeCategory].map((m) => (
                <button
                  key={m.symbol}
                  onClick={() => setActiveMarket(m.symbol)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 border ${
                    activeMarket === m.symbol
                      ? "text-white border-green-500/60"
                      : "text-green-600 border-green-900/40 hover:text-green-300 hover:border-green-700/60"
                  }`}
                  style={activeMarket === m.symbol
                    ? { backgroundColor: "#166534", boxShadow: "0 0 12px rgba(22,163,74,0.35)" }
                    : { backgroundColor: "rgba(5,46,22,0.4)" }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </header>
        )}

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-20 md:pb-6 relative">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 70% 0%,rgba(0,209,209,0.04),transparent 60%)" }}
          />
          <div className="relative z-10 h-full">{children}</div>
        </main>
      </div>

      {/* ── Mobile bottom navigation bar (portrait) ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t"
        style={{
          background: "linear-gradient(180deg,rgba(3,25,12,0.98) 0%,rgba(1,15,7,1) 100%)",
          borderColor: "#166534",
          height: 60,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {[
          { href: "/",          icon: LayoutDashboard, label: "Home"     },
          { href: "/wide-eye",  icon: Eye,             label: "Wide Eye" },
          { href: "/scanner",   icon: Activity,        label: "Scanner"  },
          { href: "/smart-signals", icon: Sparkles,    label: "Signals"  },
          { href: "/settings",  icon: Settings,        label: "Settings" },
        ].map(({ href, icon: Icon, label }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-all"
              style={{ color: active ? "#00d1d1" : "#4b7a56" }}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[9px] font-bold tracking-wide">{label}</span>
            </Link>
          );
        })}
        {/* Sound toggle in mobile bottom bar */}
        <button
          onClick={handleSoundToggle}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-all"
          style={{ color: soundOn ? "#00d1d1" : "#ef4444" }}
        >
          {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          <span className="text-[9px] font-bold tracking-wide">{soundOn ? "Sound" : "Muted"}</span>
        </button>
        {/* Hamburger to open full sidebar */}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-all"
          style={{ color: "#4b7a56" }}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-bold tracking-wide">More</span>
        </button>
      </nav>

      {/* ── PWA Install prompt banner ── */}
      {showInstall && (
        <div
          className="md:hidden fixed bottom-16 inset-x-3 z-50 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
          style={{
            background: "linear-gradient(135deg,rgba(0,30,15,0.98) 0%,rgba(0,50,25,0.98) 100%)",
            borderColor: "#00d1d1",
            boxShadow: "0 0 20px rgba(0,209,209,0.3)",
          }}
        >
          <div>
            <div className="text-xs font-black text-primary">Install Digit Killer</div>
            <div className="text-[10px] text-muted-foreground">Add to your home screen for offline access</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 rounded-lg text-xs font-black"
              style={{ backgroundColor: "#00d1d1", color: "#000" }}
            >
              Install
            </button>
            <button
              onClick={() => setShowInstall(false)}
              className="text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
