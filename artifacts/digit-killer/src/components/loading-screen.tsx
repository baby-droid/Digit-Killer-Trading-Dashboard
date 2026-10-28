import { useEffect, useState } from "react";

const PHASES = [
  "INITIALIZING NEURAL CORE",
  "SYNCING MARKET FEEDS",
  "CALIBRATING AI MODELS",
  "ESTABLISHING SECURE LINK",
  "SYSTEM READY",
];

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 6 + 2;
        if (next >= 100) { clearInterval(interval); setTimeout(onDone, 700); return 100; }
        return next;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [onDone]);

  const phaseIdx = Math.min(Math.floor(progress / 22), PHASES.length - 1);
  const phase    = PHASES[phaseIdx];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: "radial-gradient(ellipse at 50% 30%,#000d0d 0%,#050a12 55%,#000000 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: "linear-gradient(rgba(0,209,209,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(0,209,209,0.3) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Rotating rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[280, 380, 480].map((sz, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: sz, height: sz,
              border: `1px ${i === 1 ? "dashed" : "solid"} rgba(0,209,209,${0.06 + i * 0.02})`,
              animation: `spin ${7 + i * 4}s linear infinite ${i % 2 ? "reverse" : ""}`,
            }}
          />
        ))}
        {/* Corner decorations */}
        {[["top-4 left-4","0deg"],["top-4 right-4","90deg"],["bottom-4 left-4","270deg"],["bottom-4 right-4","180deg"]].map(([pos, rot], i) => (
          <div key={i} className={`absolute ${pos} w-12 h-12 pointer-events-none`} style={{ transform: `rotate(${rot})` }}>
            <div className="w-full h-0.5 bg-primary/30 rounded" />
            <div className="w-0.5 h-full bg-primary/30 rounded absolute top-0 left-0" />
          </div>
        ))}
      </div>

      {/* Scan line */}
      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none" style={{ animation: "scanline 2.5s ease-in-out infinite" }} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo with rings */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30" style={{ animation: "ping 1.8s ease-in-out infinite", transform: "scale(1.2)" }} />
          <div className="absolute inset-0 rounded-full border border-primary/15" style={{ animation: "ping 2.4s ease-in-out infinite 0.6s", transform: "scale(1.4)" }} />
          <img
            src={`${import.meta.env.BASE_URL}logo.png`.replace("//", "/")}
            alt="Digit Killer"
            className="w-32 h-32 rounded-full relative z-10"
            style={{ filter: "drop-shadow(0 0 30px rgba(0,209,209,0.7)) drop-shadow(0 0 60px rgba(0,209,209,0.3))", animation: "pulse-glow 2s ease-in-out infinite" }}
          />
        </div>

        {/* Title */}
        <div className="text-center">
          <div
            className="text-4xl font-black tracking-[0.3em] leading-none"
            style={{ fontFamily: "monospace", color: "#00d1d1", textShadow: "0 0 30px rgba(0,209,209,0.9), 0 0 60px rgba(0,209,209,0.4)" }}
          >
            DIGIT KILLER
          </div>
          <div className="text-[11px] tracking-[0.55em] text-primary/50 uppercase mt-2 font-mono">
            Ahmed Syntrader · AI Trading System
          </div>
        </div>

        {/* Progress */}
        <div className="w-80 space-y-3">
          {/* Phase text */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <span className="text-xs font-mono text-primary/80 tracking-widest">{phase}</span>
            <span className="ml-auto text-xs font-mono text-primary font-bold">{Math.round(progress)}%</span>
          </div>

          {/* Bar */}
          <div className="relative h-2 bg-primary/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(to right,#00d1d1,#00a0a0)",
                boxShadow: "0 0 12px rgba(0,209,209,0.8)",
              }}
            />
            {/* Shimmer */}
            <div
              className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              style={{ left: `calc(${progress}% - 32px)`, transition: "left 0.1s" }}
            />
          </div>

          {/* Segment indicators */}
          <div className="flex gap-1.5">
            {PHASES.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: progress >= (i + 1) * 20 ? "#00d1d1" : progress >= i * 20 ? "rgba(0,209,209,0.4)" : "rgba(255,255,255,0.06)",
                  boxShadow: progress >= (i + 1) * 20 ? "0 0 6px rgba(0,209,209,0.5)" : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Hex bars */}
        <div className="flex gap-1.5 items-end h-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full transition-all duration-300"
              style={{
                height: `${progress > (i / 9) * 100 ? 100 : 20}%`,
                backgroundColor: progress > (i / 9) * 100 ? "#00d1d1" : "rgba(0,209,209,0.1)",
                boxShadow: progress > (i / 9) * 100 ? "0 0 4px rgba(0,209,209,0.6)" : "none",
                animation: progress > (i / 9) * 100 ? `bar-pulse 1s ease-in-out infinite ${i * 0.1}s` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(-300px); opacity:0; }
          30%  { opacity:1; }
          70%  { opacity:1; }
          100% { transform: translateY(300px); opacity:0; }
        }
        @keyframes pulse-glow {
          0%,100% { filter: drop-shadow(0 0 20px rgba(0,209,209,0.5)) drop-shadow(0 0 50px rgba(0,209,209,0.2)); }
          50%      { filter: drop-shadow(0 0 40px rgba(0,209,209,0.9)) drop-shadow(0 0 80px rgba(0,209,209,0.4)); }
        }
        @keyframes bar-pulse {
          0%,100% { transform: scaleY(0.5); opacity:0.6; }
          50%      { transform: scaleY(1.5); opacity:1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
