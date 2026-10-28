import { useState, useMemo, useEffect, useRef } from "react";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { MarketSelector } from "@/components/market-selector";
import { playBuySound, playWarnSound } from "@/lib/sound";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Binary, Zap, Shield, AlertTriangle, CheckCircle2, Activity, TrendingUp } from "lucide-react";

const ACCENT = "#7c3aed";

type Signal = {
  type: "MATCHES" | "DIFFERS";
  digit: number;
  strategy: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  ticks?: number;
};

function getFrequencies(digits: number[], window = 100) {
  const last = digits.slice(-window);
  const counts = new Array(10).fill(0);
  last.forEach((d) => counts[d]++);
  const total = last.length || 1;
  const pcts = counts.map((c) => (c / total) * 100);
  const sorted = [...pcts.map((p, i) => ({ digit: i, pct: p }))].sort((a, b) => b.pct - a.pct);
  return { counts, pcts, sorted, total: last.length };
}

function analyzeSignals(digits: number[]): Signal[] {
  if (digits.length < 20) return [];
  const signals: Signal[] = [];
  const last = digits.slice(-50);

  // Most frequent digit → MATCHES signal
  const { sorted, pcts } = getFrequencies(digits, 100);
  const topDigit = sorted[0];
  if (topDigit.pct >= 14) {
    signals.push({
      type: "MATCHES",
      digit: topDigit.digit,
      strategy: "Frequency Dominance",
      confidence: topDigit.pct >= 18 ? "HIGH" : "MEDIUM",
      reason: `Digit ${topDigit.digit} is most frequent at ${topDigit.pct.toFixed(1)}% in last 100 ticks — statistically favoured to appear again`,
    });
  }
  void pcts;

  const ticksSince: number[] = Array.from({ length: 10 }, (_, d) => {
    const idx = [...last].reverse().findIndex((x) => x === d);
    return idx === -1 ? last.length : idx;
  });

  ticksSince.forEach((t, d) => {
    if (t >= 20) {
      signals.push({ type: "MATCHES", digit: d, strategy: "Digit Starvation", confidence: "HIGH", reason: `Digit ${d} missing ${t} ticks — statistical pressure building`, ticks: t });
    } else if (t >= 15) {
      signals.push({ type: "MATCHES", digit: d, strategy: "Delayed Exhaustion", confidence: "MEDIUM", reason: `Digit ${d} absent ${t} ticks — approaching reappearance zone`, ticks: t });
    }
  });

  const recent10 = last.slice(-10);
  const domCount: number[] = Array(10).fill(0);
  recent10.forEach((d) => domCount[d]++);
  domCount.forEach((cnt, d) => {
    if (cnt >= 4) {
      signals.push({ type: "DIFFERS", digit: d, strategy: "Burst Domination", confidence: "HIGH", reason: `Digit ${d} appeared ${cnt}× in last 10 ticks — rebalance expected` });
    }
  });

  if (last.length >= 3) {
    const [a, b, c] = last.slice(-3);
    if (a === b && b === c) {
      signals.push({ type: "DIFFERS", digit: c, strategy: "Triple Exhaustion", confidence: "HIGH", reason: `${c} ${c} ${c} — triple repetition exhausted, change imminent` });
    } else if (a === b) {
      signals.push({ type: "DIFFERS", digit: b, strategy: "Double Reversal", confidence: "MEDIUM", reason: `${a} ${b} — echo detected, break expected` });
    }
  }

  if (last.length >= 5) {
    const [a, b, c, d, e] = last.slice(-5);
    if (a === c && c === e && a !== b && b !== d) {
      signals.push({ type: "MATCHES", digit: e, strategy: "Fractal Return", confidence: "MEDIUM", reason: `Pattern ${a} ${b} ${a} ${d} ${a} — fractal continuation` });
    }
  }

  return signals.slice(0, 6);
}

function DigitMissing({ digits }: { digits: number[] }) {
  const last = digits.slice(-100);
  const ticksSince: number[] = Array.from({ length: 10 }, (_, d) => {
    const idx = [...last].reverse().findIndex((x) => x === d);
    return idx === -1 ? last.length : idx;
  });

  return (
    <div className="grid grid-cols-5 gap-2">
      {ticksSince.map((t, d) => {
        const isStarved = t >= 15;
        const isWarning = t >= 10 && t < 15;
        return (
          <div
            key={d}
            className="rounded-lg p-2 text-center border transition-all"
            style={{
              background: isStarved ? "rgba(124,58,237,0.15)" : isWarning ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.03)",
              borderColor: isStarved ? "#7c3aed" : isWarning ? "#eab308" : "rgba(255,255,255,0.08)",
              boxShadow: isStarved ? "0 0 12px rgba(124,58,237,0.3)" : "none",
            }}
          >
            <div
              className="text-xl font-black font-mono"
              style={{ color: isStarved ? "#a78bfa" : isWarning ? "#fbbf24" : "rgba(255,255,255,0.5)" }}
            >
              {d}
            </div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: isStarved ? "#7c3aed" : "rgba(255,255,255,0.35)" }}>
              {t === last.length ? "100+" : t} tk
            </div>
            {isStarved && (
              <div className="text-[8px] font-black text-purple-400 mt-0.5 animate-pulse">STARVED</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecentStream({ digits }: { digits: number[] }) {
  const recent = digits.slice(-30);
  return (
    <div className="flex flex-wrap gap-1">
      {recent.map((d, i) => (
        <div
          key={i}
          className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black font-mono border"
          style={{
            background: i === recent.length - 1 ? "rgba(0,209,209,0.2)" : "rgba(255,255,255,0.04)",
            borderColor: i === recent.length - 1 ? "#00d1d1" : "rgba(255,255,255,0.08)",
            color: i === recent.length - 1 ? "#00d1d1" : "rgba(255,255,255,0.55)",
          }}
        >
          {d}
        </div>
      ))}
    </div>
  );
}

export default function MatchesDiffers() {
  const [selectedMarket, setSelectedMarket] = useState("R_25");
  const { digits, lastDigit, currentPrice, isConnected, historyLoaded } = useDerivWebSocket(selectedMarket);

  const displayDigits = useMemo(() => digits.map((d) => d.digit), [digits]);
  const signals = useMemo(() => analyzeSignals(displayDigits), [displayDigits]);

  const prevHighRef = useRef(0);
  useEffect(() => {
    const high = signals.filter(s => s.confidence === "HIGH").length;
    if (high > prevHighRef.current) playBuySound();
    else if (high === 0 && prevHighRef.current > 0) playWarnSound();
    prevHighRef.current = high;
  }, [signals]);
  const matchSignals = signals.filter((s) => s.type === "MATCHES");
  const differSignals = signals.filter((s) => s.type === "DIFFERS");
  const freq = useMemo(() => getFrequencies(displayDigits, 100), [displayDigits]);

  const priceStr = currentPrice !== null
    ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })
    : "—";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: `linear-gradient(to right,${ACCENT},transparent)` }} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: ACCENT }}>
            <Binary className="w-6 h-6" /> Matches & Differs
          </h1>
          <p className="text-muted-foreground text-sm">AI-powered digit pattern detection · {displayDigits.length} ticks</p>
        </div>
        <Badge variant="outline" className={`gap-1.5 font-mono text-xs ${isConnected ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          {isConnected ? "Live" : "Connecting..."}
        </Badge>
      </div>

      {/* Market selector */}
      <Card className="border" style={{ background: "linear-gradient(135deg,rgba(5,46,22,0.95),rgba(3,30,15,0.98))", borderColor: "#166534" }}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-48">
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#4ade80" }}>Select Market:</label>
              <MarketSelector value={selectedMarket} onChange={setSelectedMarket} testId="select-market-matches-differs" />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xs text-green-600 mb-1">Price</div>
                <div className="font-mono font-bold text-white text-lg">{priceStr}</div>
              </div>
              {lastDigit !== null && (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-black text-2xl border-2"
                  style={{ backgroundColor: "#00d1d1", borderColor: "#00d1d1", color: "#000", boxShadow: "0 0 20px rgba(0,209,209,0.5)" }}
                >
                  {lastDigit}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Most Frequent Digit banner */}
      {historyLoaded && freq.total > 0 && (
        <Card className="border overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(124,58,237,0.06))", borderColor: "rgba(124,58,237,0.5)" }}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Big digit callout */}
              <div className="flex items-center gap-4 shrink-0">
                <div
                  className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-black border-2 shrink-0"
                  style={{ background: "rgba(124,58,237,0.3)", borderColor: "#a78bfa", boxShadow: "0 0 28px rgba(124,58,237,0.5)" }}
                >
                  <span className="text-4xl text-white leading-none">{freq.sorted[0].digit}</span>
                  <span className="text-[10px] text-purple-300 mt-0.5 font-semibold tracking-wide">MATCH IT</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-purple-200">Most Frequent Digit</span>
                  </div>
                  <div className="text-3xl font-black text-white leading-none">{freq.sorted[0].pct.toFixed(1)}<span className="text-base text-purple-300 ml-1">%</span></div>
                  <div className="text-xs text-purple-300 mt-0.5">{freq.counts[freq.sorted[0].digit]} times in last {freq.total} ticks</div>
                  <div className="mt-2">
                    <Badge style={{ background: "rgba(124,58,237,0.35)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.4)" }} className="text-[10px]">
                      ⚡ MATCHES {freq.sorted[0].digit} — Frequency Dominance
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Mini frequency bar chart */}
              <div className="flex-1 w-full">
                <div className="text-[10px] text-purple-300/60 uppercase tracking-wider mb-2 font-semibold">Digit Frequency · Last {freq.total} Ticks</div>
                <div className="flex items-end gap-1 h-12">
                  {freq.pcts.map((p, d) => {
                    const isTop = d === freq.sorted[0].digit;
                    const isSecond = d === freq.sorted[1].digit;
                    return (
                      <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${Math.max((p / (freq.sorted[0].pct || 1)) * 44, 4)}px`,
                            background: isTop
                              ? "linear-gradient(to top,#7c3aed,#a78bfa)"
                              : isSecond
                              ? "rgba(124,58,237,0.4)"
                              : "rgba(255,255,255,0.08)",
                            boxShadow: isTop ? "0 0 8px rgba(167,139,250,0.6)" : "none",
                          }}
                        />
                        <span
                          className="text-[9px] font-mono font-bold"
                          style={{ color: isTop ? "#c4b5fd" : "rgba(255,255,255,0.3)" }}
                        >
                          {d}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Top 3 label row */}
                <div className="flex gap-3 mt-2 flex-wrap">
                  {freq.sorted.slice(0, 3).map((item, rank) => (
                    <span key={item.digit} className="text-[10px] font-mono" style={{ color: rank === 0 ? "#a78bfa" : rank === 1 ? "#818cf8" : "rgba(255,255,255,0.35)" }}>
                      #{rank + 1} · Digit {item.digit} · {item.pct.toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!historyLoaded ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <Activity className="w-8 h-8 opacity-20 animate-spin" />
            <p className="text-sm">Loading market data…</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* AI Signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* MATCHES signals */}
            <Card className="bg-card border-border">
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-xs font-bold uppercase flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-400">MATCHES Signals</span>
                  <Badge className="ml-auto bg-purple-500/20 text-purple-300 border-0 text-[10px]">{matchSignals.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {matchSignals.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No MATCHES conditions detected</p>
                ) : matchSignals.map((s, i) => (
                  <div key={i} className="rounded-lg p-3 border" style={{ background: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.3)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-2" style={{ backgroundColor: "#7c3aed", borderColor: "#a78bfa", color: "#fff" }}>{s.digit}</div>
                        <div>
                          <div className="text-xs font-bold text-purple-300">MATCHES {s.digit}</div>
                          <div className="text-[10px] text-muted-foreground">{s.strategy}</div>
                        </div>
                      </div>
                      <Badge className={`text-[9px] border-0 ${s.confidence === "HIGH" ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>{s.confidence}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                    {s.ticks && <div className="mt-1 text-[10px] font-mono text-purple-400">Absent: {s.ticks} ticks · Enter: 1 tick</div>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* DIFFERS signals */}
            <Card className="bg-card border-border">
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-xs font-bold uppercase flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400">DIFFERS Signals</span>
                  <Badge className="ml-auto bg-cyan-500/20 text-cyan-300 border-0 text-[10px]">{differSignals.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {differSignals.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No DIFFERS conditions detected</p>
                ) : differSignals.map((s, i) => (
                  <div key={i} className="rounded-lg p-3 border" style={{ background: "rgba(0,209,209,0.05)", borderColor: "rgba(0,209,209,0.25)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-2" style={{ backgroundColor: "#0e7490", borderColor: "#00d1d1", color: "#fff" }}>{s.digit}</div>
                        <div>
                          <div className="text-xs font-bold text-cyan-300">DIFFERS {s.digit}</div>
                          <div className="text-[10px] text-muted-foreground">{s.strategy}</div>
                        </div>
                      </div>
                      <Badge className={`text-[9px] border-0 ${s.confidence === "HIGH" ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>{s.confidence}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Digit missing tracker */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                Digit Absence Tracker · last 100 ticks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <DigitMissing digits={displayDigits} />
              <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-purple-500" /> Starved ≥15 → MATCHES</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-yellow-500" /> Warning 10–14</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent digit stream */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Recent Digit Stream · last 30</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <RecentStream digits={displayDigits} />
            </CardContent>
          </Card>

          {/* Logic guide */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> Entry Logic Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="font-bold text-purple-400 mb-2">MATCHES Conditions</div>
                  {[
                    ["Digit Starvation", "Absent 15–25 ticks → HIGH confidence"],
                    ["Double Echo Return", "XX pattern, wait 1–2 ticks → MATCHES X"],
                    ["Compression Release", "Few digits dominate 8–12 ticks → missing digit"],
                    ["Fractal Return", "Partial sequence repeats → complete it"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border/30 pb-1">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-purple-300 text-right max-w-48">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="font-bold text-cyan-400 mb-2">DIFFERS Conditions</div>
                  {[
                    ["Double Repetition", "Same digit 2× → DIFFERS that digit"],
                    ["Triple Exhaustion", "Same digit 3× rapidly → HIGH probability"],
                    ["Burst Domination", "4+ times in 10 ticks → rebalance"],
                    ["Cluster Rejection", "Clustered digit breaks after overexpansion"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border/30 pb-1">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-cyan-300 text-right max-w-48">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
