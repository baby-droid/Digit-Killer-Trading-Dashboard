import { useState, useMemo } from "react";
import { useDerivWebSocket, MARKETS_BY_CATEGORY, CATEGORY_LABELS, MarketCategory } from "@/hooks/useDerivWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Activity, TrendingUp, TrendingDown, Zap, BarChart2, Target, GitBranch, AlertTriangle, CheckCircle2 } from "lucide-react";

const ACCENT = "#a855f7";

/* ── Signal engines ─────────────────────────────────────────────────────── */

function buildMarkovChain(digits: number[]): number[][] {
  const m: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  for (let i = 0; i < digits.length - 1; i++) m[digits[i]][digits[i + 1]]++;
  return m.map(row => {
    const s = row.reduce((a, b) => a + b, 0) || 1;
    return row.map(v => v / s);
  });
}

type DigitSignal = { digit: number; score: number; label: string; confidence: "HIGH" | "MEDIUM" | "LOW" };
type DirSignal   = { direction: "BUY" | "SELL" | "WAIT"; label: string; reason: string; confidence: number };

function freqEngine(digits: number[]): { pct: number[]; max: number; min: number; maxD: number; minD: number } {
  const counts = new Array(10).fill(0);
  digits.slice(-100).forEach(d => counts[d]++);
  const total = Math.min(digits.length, 100) || 1;
  const pct = counts.map(c => (c / total) * 100);
  const max = Math.max(...pct), min = Math.min(...pct);
  return { pct, max, min, maxD: pct.indexOf(max), minD: pct.indexOf(min) };
}

function markovSignal(matrix: number[][], lastDigit: number | null): DigitSignal[] {
  if (lastDigit === null) return [];
  const row = matrix[lastDigit];
  return row
    .map((p, d) => ({ digit: d, score: p, label: `${(p * 100).toFixed(1)}% after ${lastDigit}`, confidence: p > 0.2 ? "HIGH" : p > 0.12 ? "MEDIUM" : "LOW" as "HIGH" | "MEDIUM" | "LOW" }))
    .sort((a, b) => b.score - a.score);
}

function streakEngine(digits: number[]): { streak: number; type: "EVEN" | "ODD" | "MIXED"; reversal: number } {
  if (digits.length < 2) return { streak: 0, type: "MIXED", reversal: 0 };
  const last = digits[digits.length - 1];
  const isEven = last % 2 === 0;
  let streak = 1;
  for (let i = digits.length - 2; i >= 0; i--) {
    if ((digits[i] % 2 === 0) === isEven) streak++;
    else break;
  }
  const reversal = Math.min(95, 50 + streak * 8);
  return { streak, type: isEven ? "EVEN" : "ODD", reversal };
}

function momentumEngine(digits: number[]): { dir: "UP" | "DOWN" | "FLAT"; strength: number } {
  const last8 = digits.slice(-8);
  if (last8.length < 3) return { dir: "FLAT", strength: 0 };
  let rises = 0, falls = 0;
  for (let i = 1; i < last8.length; i++) {
    if (last8[i] > last8[i - 1]) rises++;
    else if (last8[i] < last8[i - 1]) falls++;
  }
  const n = last8.length - 1;
  if (rises > n * 0.65) return { dir: "UP",   strength: Math.round((rises / n) * 100) };
  if (falls > n * 0.65) return { dir: "DOWN", strength: Math.round((falls / n) * 100) };
  return { dir: "FLAT", strength: 50 };
}

function missingEngine(digits: number[]): { digit: number; since: number }[] {
  const last50 = digits.slice(-50);
  return Array.from({ length: 10 }, (_, d) => {
    const idx = [...last50].reverse().findIndex(x => x === d);
    return { digit: d, since: idx === -1 ? last50.length : idx };
  }).filter(x => x.since >= 10).sort((a, b) => b.since - a.since);
}

function evenOddEngine(digits: number[]): DirSignal {
  const last100 = digits.slice(-100);
  const total   = last100.length || 1;
  const evenPct = (last100.filter(d => d % 2 === 0).length / total) * 100;
  const oddPct  = 100 - evenPct;
  const last10  = digits.slice(-10);
  const r10Even = (last10.filter(d => d % 2 === 0).length / last10.length) * 100;

  if (r10Even >= 80) return { direction: "WAIT", label: "⚠️ EXTREME EVEN STREAK", reason: `${Math.round(r10Even)}% even in last 10 — wait`, confidence: 30 };
  if (r10Even <= 20) return { direction: "WAIT", label: "⚠️ EXTREME ODD STREAK",  reason: `${Math.round(100 - r10Even)}% odd in last 10 — wait`, confidence: 30 };
  if (evenPct >= 48 && evenPct <= 52) return { direction: "WAIT", label: "⏳ Balanced", reason: `Even ${evenPct.toFixed(1)}% / Odd ${oddPct.toFixed(1)}% — no edge`, confidence: 40 };
  const dom = evenPct > oddPct ? "BUY EVEN" : "BUY ODD";
  const pct = Math.max(evenPct, oddPct);
  const zone = pct >= 65 ? "EXTREME" : pct >= 60 ? "STRONG" : "MODERATE";
  return {
    direction: "BUY",
    label: `🎯 ${dom}`,
    reason: `${pct.toFixed(1)}% ${dom.split(" ")[1]} — ${zone} imbalance`,
    confidence: Math.min(90, 50 + (pct - 50) * 3),
  };
}

function overUnderEngine(digits: number[], threshold: number): DirSignal {
  const last100 = digits.slice(-100);
  const total   = last100.length || 1;
  const overPct  = (last100.filter(d => d > threshold).length / total) * 100;
  const underPct = (last100.filter(d => d < threshold).length / total) * 100;
  if (overPct >= 57) return { direction: "BUY", label: `🎯 BUY OVER ${threshold}`, reason: `Over-${threshold} rate ${overPct.toFixed(1)}%`, confidence: Math.min(90, 55 + (overPct - 57) * 2) };
  if (underPct >= 57) return { direction: "BUY", label: `🎯 BUY UNDER ${threshold}`, reason: `Under-${threshold} rate ${underPct.toFixed(1)}%`, confidence: Math.min(90, 55 + (underPct - 57) * 2) };
  return { direction: "WAIT", label: "⏳ No edge", reason: `O:${overPct.toFixed(1)}% U:${underPct.toFixed(1)}%`, confidence: 40 };
}

function upsDownsEngine(digits: number[]): DirSignal {
  const mom = momentumEngine(digits);
  if (mom.dir === "UP"   && mom.strength >= 70) return { direction: "BUY",  label: "🎯 BUY ONLY UPS",   reason: `${mom.strength}% rising momentum in last 8 ticks`,  confidence: mom.strength };
  if (mom.dir === "DOWN" && mom.strength >= 70) return { direction: "BUY",  label: "🎯 BUY ONLY DOWNS", reason: `${mom.strength}% falling momentum in last 8 ticks`, confidence: mom.strength };
  if (mom.dir === "FLAT") return { direction: "WAIT", label: "⏳ Sideways", reason: "No clear up/down trend", confidence: 30 };
  return { direction: "WAIT", label: "⏳ Moderate trend", reason: `${mom.strength}% ${mom.dir} — needs 70%+ for signal`, confidence: 45 };
}

function highLowTickEngine(digits: number[], matrix: number[][], lastDigit: number | null): { high: DigitSignal; low: DigitSignal } {
  const { pct } = freqEngine(digits);
  const markov  = lastDigit !== null ? markovSignal(matrix, lastDigit) : [];
  const highScores = digits.slice(-50).length > 0
    ? pct.map((p, d) => ({ digit: d, score: (p / 10) * 0.5 + (markov[d]?.score ?? 0) * 0.5, label: `Freq ${p.toFixed(1)}%`, confidence: p >= 13 ? "HIGH" : p >= 10 ? "MEDIUM" : "LOW" as "HIGH" | "MEDIUM" | "LOW" }))
    : [];
  const sorted = [...highScores].sort((a, b) => b.score - a.score);
  return { high: sorted[0] ?? { digit: 9, score: 0, label: "—", confidence: "LOW" }, low: sorted[sorted.length - 1] ?? { digit: 0, score: 0, label: "—", confidence: "LOW" } };
}

function matchesDiffersEngine(digits: number[], matrix: number[][], lastDigit: number | null): { matches: DigitSignal; differs: DigitSignal } {
  const { pct } = freqEngine(digits);
  const markov  = lastDigit !== null ? markovSignal(matrix, lastDigit) : pct.map((p, d) => ({ digit: d, score: p / 100, label: "", confidence: "LOW" as "HIGH"|"MEDIUM"|"LOW" }));
  const missing = missingEngine(digits);

  const matchScores = pct.map((p, d) => {
    const mk = markov.find(m => m.digit === d)?.score ?? 0;
    const miss = missing.find(m => m.digit === d);
    const pressureBoost = miss ? Math.min(0.15, miss.since * 0.008) : 0;
    return { digit: d, score: mk * 0.5 + (p / 100) * 0.35 + pressureBoost * 0.15, label: `${p.toFixed(1)}% freq`, confidence: (p >= 13 || mk > 0.2) ? "HIGH" : p >= 10 ? "MEDIUM" : "LOW" as "HIGH"|"MEDIUM"|"LOW" };
  });
  const sortedMatch = [...matchScores].sort((a, b) => b.score - a.score);
  const sortedDiffer = [...matchScores].sort((a, b) => a.score - b.score);

  return {
    matches: sortedMatch[0] ?? { digit: 0, score: 0, label: "", confidence: "LOW" },
    differs: sortedDiffer[0] ?? { digit: 9, score: 0, label: "", confidence: "LOW" },
  };
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function ConfBadge({ conf }: { conf: "HIGH" | "MEDIUM" | "LOW" }) {
  const map = { HIGH: "text-green-400 border-green-400/30 bg-green-400/10", MEDIUM: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", LOW: "text-gray-400 border-gray-400/20 bg-gray-400/5" };
  return <Badge variant="outline" className={`text-[9px] font-black px-1.5 py-0 ${map[conf]}`}>{conf}</Badge>;
}

function DirCard({ sig, title, icon: Icon }: { sig: DirSignal; title: string; icon: React.ElementType }) {
  const isBuy  = sig.direction === "BUY";
  const isWait = sig.direction === "WAIT";
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-1.5"
      style={{
        borderColor: isBuy ? "#22c55e55" : isWait ? "#374151" : "#ef444455",
        background:  isBuy ? "rgba(34,197,94,0.08)" : "rgba(0,0,0,0.3)",
        boxShadow:   isBuy ? "0 0 12px rgba(34,197,94,0.15)" : "none",
      }}>
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" style={{ color: isBuy ? "#22c55e" : "#6b7280" }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="ml-auto text-[10px] font-black" style={{ color: isBuy ? "#22c55e" : "#9ca3af" }}>{sig.confidence}%</span>
      </div>
      <div className="font-bold text-sm" style={{ color: isBuy ? "#22c55e" : "#9ca3af" }}>{sig.label}</div>
      <div className="text-[10px] text-muted-foreground">{sig.reason}</div>
    </div>
  );
}

function MarkovTable({ matrix, lastDigit }: { matrix: number[][]; lastDigit: number | null }) {
  const top = lastDigit !== null ? markovSignal(matrix, lastDigit).slice(0, 5) : [];
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">
        {lastDigit !== null ? `Markov → After digit ${lastDigit}` : "Markov Chain (waiting for digit…)"}
      </div>
      {top.map(s => (
        <div key={s.digit} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black border"
            style={{ backgroundColor: `hsl(${120 * s.score * 5}, 70%, 30%)`, borderColor: `hsl(${120 * s.score * 5}, 70%, 55%)`, color: "#fff" }}>
            {s.digit}
          </div>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${s.score * 100}%`, background: `hsl(${120 * s.score * 5}, 70%, 50%)` }} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground w-9 text-right">{(s.score * 100).toFixed(1)}%</span>
          <ConfBadge conf={s.confidence} />
        </div>
      ))}
    </div>
  );
}

function DigitHeatmap({ pct }: { pct: number[] }) {
  const max = Math.max(...pct);
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Digit Frequency Heatmap (last 100)</div>
      <div className="grid grid-cols-5 gap-1.5">
        {pct.map((p, d) => {
          const hot = p / max;
          return (
            <div key={d} className="rounded-lg p-2 text-center border"
              style={{ backgroundColor: `rgba(168,85,247,${hot * 0.55})`, borderColor: `rgba(168,85,247,${hot * 0.7})` }}>
              <div className="text-lg font-black" style={{ color: hot > 0.6 ? "#e9d5ff" : "#9ca3af" }}>{d}</div>
              <div className="text-[10px] font-bold" style={{ color: hot > 0.6 ? "#c084fc" : "#6b7280" }}>{p.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissingPanel({ missing }: { missing: { digit: number; since: number }[] }) {
  if (missing.length === 0) return (
    <div className="text-center py-4 text-xs text-muted-foreground">All digits appeared in last 50 ticks</div>
  );
  return (
    <div className="space-y-1.5">
      {missing.map(({ digit, since }) => (
        <div key={digit} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border"
            style={{ backgroundColor: since >= 20 ? "#7f1d1d" : "#713f12", borderColor: since >= 20 ? "#ef4444" : "#eab308", color: "#fff" }}>
            {digit}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[10px]">
              <span className="font-bold" style={{ color: since >= 20 ? "#ef4444" : "#eab308" }}>
                {since >= 20 ? "🔥 HIGH PRESSURE" : "⚠️ Building pressure"}
              </span>
              <span className="text-muted-foreground">{since} ticks ago</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, since * 3.5)}%`, backgroundColor: since >= 20 ? "#ef4444" : "#eab308" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function Performance() {
  const [selectedMarket, setSelectedMarket] = useState("R_10");
  const [ouThreshold,    setOuThreshold]    = useState(4);

  const { digits: rawDigits, lastDigit, isConnected, historyLoaded } = useDerivWebSocket(selectedMarket);
  const digits = useMemo(() => rawDigits.map(d => d.digit), [rawDigits]);

  const matrix   = useMemo(() => buildMarkovChain(digits), [digits]);
  const { pct }  = useMemo(() => freqEngine(digits), [digits]);
  const streak   = useMemo(() => streakEngine(digits), [digits]);
  const momentum = useMemo(() => momentumEngine(digits), [digits]);
  const missing  = useMemo(() => missingEngine(digits), [digits]);

  const mdSignal  = useMemo(() => matchesDiffersEngine(digits, matrix, lastDigit), [digits, matrix, lastDigit]);
  const eoSignal  = useMemo(() => evenOddEngine(digits), [digits]);
  const ouSignal  = useMemo(() => overUnderEngine(digits, ouThreshold), [digits, ouThreshold]);
  const udSignal  = useMemo(() => upsDownsEngine(digits), [digits]);
  const hlSignal  = useMemo(() => highLowTickEngine(digits, matrix, lastDigit), [digits, matrix, lastDigit]);

  const allMarkets = Object.entries(MARKETS_BY_CATEGORY);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="h-0.5 rounded-full -mb-3" style={{ background: `linear-gradient(to right,${ACCENT},transparent)` }} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: ACCENT }}>
            <BrainCircuit className="w-6 h-6" /> AI Signal Centre
          </h1>
          <p className="text-muted-foreground text-sm">Multi-engine analysis · Markov Chain · Pattern AI · Momentum</p>
        </div>
        <Badge variant="outline" className={`gap-1.5 font-mono text-xs ${isConnected ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          {isConnected ? (historyLoaded ? `Live · ${digits.length} ticks` : "Loading…") : "Connecting…"}
        </Badge>
      </div>

      {/* Market selector */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase">Market:</span>
          <select
            value={selectedMarket}
            onChange={e => setSelectedMarket(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary flex-1"
          >
            {allMarkets.map(([cat, mkts]) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat as MarketCategory]}>
                {mkts.map(m => <option key={m.symbol} value={m.symbol}>{m.name}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="text-xs font-bold text-muted-foreground uppercase">O/U Threshold:</span>
          <select
            value={ouThreshold}
            onChange={e => setOuThreshold(+e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary w-16"
          >
            {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </CardContent>
      </Card>

      {digits.length < 30 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <div className="font-bold">Collecting data…</div>
          <div className="text-xs mt-1">{digits.length} / 30 ticks loaded</div>
        </div>
      ) : (
        <>
          {/* ── Contract Signal Grid ── */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> Contract Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Matches */}
              <div className="rounded-lg border p-3 space-y-2"
                style={{ borderColor: "#7c3aed55", background: "rgba(124,58,237,0.06)" }}>
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Matches</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border"
                    style={{ backgroundColor: "#4c1d95", borderColor: "#7c3aed", color: "#e9d5ff" }}>
                    {mdSignal.matches.digit}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-purple-300">🎯 Digit {mdSignal.matches.digit}</div>
                    <div className="text-[10px] text-muted-foreground">{mdSignal.matches.label}</div>
                  </div>
                  <ConfBadge conf={mdSignal.matches.confidence} />
                </div>
              </div>

              {/* Differs */}
              <div className="rounded-lg border p-3 space-y-2"
                style={{ borderColor: "#0369a155", background: "rgba(3,105,161,0.06)" }}>
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Differs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border"
                    style={{ backgroundColor: "#0c4a6e", borderColor: "#0369a1", color: "#bae6fd" }}>
                    {mdSignal.differs.digit}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-sky-300">🚫 Digit {mdSignal.differs.digit}</div>
                    <div className="text-[10px] text-muted-foreground">{mdSignal.differs.label}</div>
                  </div>
                  <ConfBadge conf={mdSignal.differs.confidence} />
                </div>
              </div>

              {/* Even/Odd */}
              <DirCard sig={eoSignal}  title="Even / Odd"    icon={BarChart2} />
              {/* Over/Under */}
              <DirCard sig={ouSignal}  title={`Over / Under ${ouThreshold}`} icon={TrendingUp} />
              {/* Only Ups / Downs */}
              <DirCard sig={udSignal}  title="Only Ups / Downs" icon={momentum.dir === "UP" ? TrendingUp : TrendingDown} />

              {/* High Tick */}
              <div className="rounded-lg border p-3 space-y-2"
                style={{ borderColor: "#15803d55", background: "rgba(21,128,61,0.06)" }}>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">High Tick / Low Tick</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-black border"
                      style={{ backgroundColor: "#14532d", borderColor: "#22c55e", color: "#bbf7d0" }}>
                      {hlSignal.high.digit}
                    </div>
                    <div>
                      <div className="text-[10px] text-green-300 font-bold">HIGH TICK</div>
                      <div className="text-[10px] text-muted-foreground">Digit {hlSignal.high.digit}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-black border"
                      style={{ backgroundColor: "#7f1d1d", borderColor: "#ef4444", color: "#fecaca" }}>
                      {hlSignal.low.digit}
                    </div>
                    <div>
                      <div className="text-[10px] text-red-300 font-bold">LOW TICK</div>
                      <div className="text-[10px] text-muted-foreground">Digit {hlSignal.low.digit}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Markov Chain ── */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5" /> Markov Chain Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <MarkovTable matrix={matrix} lastDigit={lastDigit} />
              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Current Streak</div>
                <div className="rounded-lg border p-3"
                  style={{ borderColor: streak.type === "EVEN" ? "#22c55e55" : "#ef444455", background: "rgba(0,0,0,0.3)" }}>
                  <div className="font-black text-2xl" style={{ color: streak.type === "EVEN" ? "#22c55e" : "#ef4444" }}>
                    {streak.streak}× {streak.type}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Reversal probability: <span className="font-bold" style={{ color: streak.reversal >= 80 ? "#ef4444" : "#f59e0b" }}>{streak.reversal}%</span>
                  </div>
                  {streak.reversal >= 70 && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-orange-400 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> High reversal risk — wait for confirmation
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Momentum</div>
                <div className="rounded-lg border p-3"
                  style={{ borderColor: momentum.dir === "UP" ? "#22c55e55" : momentum.dir === "DOWN" ? "#ef444455" : "#37415155", background: "rgba(0,0,0,0.3)" }}>
                  <div className="flex items-center gap-2">
                    {momentum.dir === "UP" ? <TrendingUp className="w-4 h-4 text-green-400" /> : momentum.dir === "DOWN" ? <TrendingDown className="w-4 h-4 text-red-400" /> : <Activity className="w-4 h-4 text-gray-400" />}
                    <span className="font-black" style={{ color: momentum.dir === "UP" ? "#22c55e" : momentum.dir === "DOWN" ? "#ef4444" : "#9ca3af" }}>
                      {momentum.dir === "FLAT" ? "SIDEWAYS" : momentum.dir} · {momentum.strength}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${momentum.strength}%`,
                      backgroundColor: momentum.dir === "UP" ? "#22c55e" : momentum.dir === "DOWN" ? "#ef4444" : "#6b7280"
                    }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Frequency Heatmap ── */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5" /> Frequency & Missing Digit Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <DigitHeatmap pct={pct} />
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Digital Pressure (Missing Digits)</div>
                <MissingPanel missing={missing} />
              </div>
            </CardContent>
          </Card>

          {/* ── Tick count guide ── */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Recommended Tick Counts per Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { type: "Matches",     ticks: "1 tick",     note: "Next digit prediction" },
                  { type: "Differs",     ticks: "1 tick",     note: "Avoid predicted digit" },
                  { type: "Even / Odd",  ticks: "1 tick",     note: "Single tick outcome" },
                  { type: "Over / Under",ticks: "1–2 ticks",  note: "Short barrier play" },
                  { type: "Only Ups",    ticks: "5–10 ticks", note: "Needs sustained rise" },
                  { type: "Only Downs",  ticks: "5–10 ticks", note: "Needs sustained fall" },
                  { type: "High Tick",   ticks: "5 ticks",    note: "Best over 5 ticks" },
                  { type: "Low Tick",    ticks: "5 ticks",    note: "Best over 5 ticks" },
                ].map(({ type, ticks, note }) => (
                  <div key={type} className="rounded-lg bg-muted/50 p-3 border border-border/40">
                    <div className="font-bold text-xs text-primary">{type}</div>
                    <div className="font-black text-lg font-mono" style={{ color: ACCENT }}>{ticks}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{note}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
