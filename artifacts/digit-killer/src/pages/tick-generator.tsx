import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDerivWebSocket, MARKETS } from "@/hooks/useDerivWebSocket";
import { MarketSelector } from "@/components/market-selector";
import {
  Cpu, TrendingUp, TrendingDown, Activity, Zap,
  ArrowUpDown, BarChart2, Layers, Target, RefreshCw, Timer,
} from "lucide-react";

const TABS = [
  { id: "over-under",   label: "Over / Under",              icon: ArrowUpDown },
  { id: "rise-fall",    label: "Rise / Fall",               icon: TrendingUp  },
  { id: "in-out",       label: "In / Out",                  icon: Layers      },
  { id: "high-low",     label: "High / Low Tick",           icon: BarChart2   },
  { id: "matches",      label: "Matches",                   icon: Target      },
  { id: "even-odd",     label: "Even / Odd",                icon: Activity    },
  { id: "accumulators", label: "Accumulators",              icon: RefreshCw   },
  { id: "asians",       label: "Asians",                    icon: Timer       },
] as const;

type TabId = typeof TABS[number]["id"];

const DIGIT_COLORS = [
  "#6366f1","#3b82f6","#06b6d4","#10b981","#84cc16",
  "#f59e0b","#f97316","#ef4444","#ec4899","#a855f7",
];

type Signal = {
  type: string;
  subLabel?: string;
  confidence: number;
  entryDigit: string;
  ticks: string;
  risk: "Low" | "Medium" | "High";
  enterNow: boolean;
  reason: string;
  freqs?: number[];
};

function buildSignals(digits: number[], lastDigit: number | null, tab: TabId): Signal[] {
  if (digits.length < 30) return [];
  const results: Signal[] = [];

  const last100 = digits.slice(-100);
  const counts = new Array(10).fill(0);
  last100.forEach((d) => counts[d]++);
  const total = last100.length || 1;
  const pct = counts.map((c) => (c / total) * 100);

  const maxD = pct.indexOf(Math.max(...pct));
  const minD = pct.indexOf(Math.min(...pct));
  const maxPct = pct[maxD];
  const minPct = pct[minD];
  const overPct = [5,6,7,8,9].reduce((s,d) => s + pct[d], 0);
  const evenPct = [0,2,4,6,8].reduce((s,d) => s + pct[d], 0);
  const oddPct  = [1,3,5,7,9].reduce((s,d) => s + pct[d], 0);

  const push = (s: Signal) => results.push({ ...s, freqs: pct });

  if (tab === "over-under") {
    if (overPct > 60) push({ type: "OVER 4", confidence: Math.min(88, 55 + overPct - 55), entryDigit: "Enter at digit 2–4", ticks: "2–3 ticks", risk: "Medium", enterNow: [2,3,4].includes(lastDigit ?? -1), reason: `High digits 5–9 very dominant at ${overPct.toFixed(1)}%` });
    else if (overPct > 55) push({ type: "OVER 5", confidence: Math.min(82, 55 + overPct - 55), entryDigit: "Enter at digit 2–4", ticks: "2–3 ticks", risk: "Medium", enterNow: [2,3,4].includes(lastDigit ?? -1), reason: `High digits 5–9 dominant at ${overPct.toFixed(1)}%` });
    if (overPct < 40) push({ type: "UNDER 4", confidence: Math.min(88, 55 + (45 - overPct)), entryDigit: "Enter at digit 5–7", ticks: "2–3 ticks", risk: "Medium", enterNow: [5,6,7].includes(lastDigit ?? -1), reason: `Low digits 0–4 very dominant` });
    else if (overPct < 45) push({ type: "UNDER 5", confidence: Math.min(82, 55 + (45 - overPct)), entryDigit: "Enter at digit 5–7", ticks: "2–3 ticks", risk: "Medium", enterNow: [5,6,7].includes(lastDigit ?? -1), reason: `Low digits 0–4 dominant` });
    if (pct[0] < 7 && pct[1] < 7) push({ type: "OVER 1", confidence: 72, entryDigit: "Enter at digit 0–1", ticks: "1–2 ticks", risk: "Low", enterNow: [0,1].includes(lastDigit ?? -1), reason: `Digits 0–1 at only ${(pct[0]+pct[1]).toFixed(1)}%` });
    if (pct[8] < 7 && pct[9] < 7) push({ type: "UNDER 9", confidence: 70, entryDigit: "Enter at digit 8–9", ticks: "1–2 ticks", risk: "Low", enterNow: [8,9].includes(lastDigit ?? -1), reason: `Digits 8–9 at only ${(pct[8]+pct[9]).toFixed(1)}%` });
    if (pct[9] > 14) push({ type: "OVER 8", confidence: Math.min(82, 55 + (pct[9]-10)*2), entryDigit: "Enter at digit 6–7", ticks: "1–2 ticks", risk: "Low", enterNow: [6,7].includes(lastDigit ?? -1), reason: `Digit 9 at ${pct[9].toFixed(1)}% — very high` });
  }

  if (tab === "rise-fall") {
    const recent8 = digits.slice(-8);
    let rise = 0;
    recent8.forEach((d, i) => { if (i > 0 && d >= recent8[i-1]) rise++; });
    const fall = recent8.length - 1 - rise;
    if (rise >= 6) push({ type: "RISE", confidence: Math.min(80, 60 + rise*3), entryDigit: "Current price", ticks: "5 ticks", risk: "Medium", enterNow: true, reason: `${rise}/7 last digits rising — bullish momentum` });
    if (fall >= 6) push({ type: "FALL", confidence: Math.min(80, 60 + fall*3), entryDigit: "Current price", ticks: "5 ticks", risk: "Medium", enterNow: true, reason: `${fall}/7 last digits falling — bearish momentum` });
    const recent5 = digits.slice(-5);
    const rCount = recent5.filter((d,i) => i > 0 && d >= recent5[i-1]).length;
    if (rCount >= 4) push({ type: "RISE", subLabel: "Short-term", confidence: 70, entryDigit: "Current price", ticks: "3 ticks", risk: "Medium", enterNow: true, reason: `4/4 of last 5 digits rising` });
    else if (rCount <= 1) push({ type: "FALL", subLabel: "Short-term", confidence: 70, entryDigit: "Current price", ticks: "3 ticks", risk: "Medium", enterNow: true, reason: `4/4 of last 5 digits falling` });
  }

  if (tab === "in-out") {
    const recent20 = digits.slice(-20);
    if (recent20.length >= 20) {
      const spread = Math.max(...recent20) - Math.min(...recent20);
      const midPct = [3,4,5,6].reduce((s,d) => s + pct[d], 0);
      if (spread <= 4) push({ type: "IN (Stay In)", confidence: 72, entryDigit: "Current barrier", ticks: "5 ticks", risk: "Low", enterNow: true, reason: `Last 20 digits in tight range (${Math.min(...recent20)}–${Math.max(...recent20)})` });
      if (spread >= 8) push({ type: "OUT (Exit)", confidence: 70, entryDigit: "Current barrier", ticks: "5 ticks", risk: "Medium", enterNow: true, reason: `Volatile — last 20 digits span ${spread}` });
      if (midPct > 44) push({ type: "IN (Mid Range)", confidence: Math.min(76, 50 + midPct - 40), entryDigit: "Mid barrier", ticks: "3 ticks", risk: "Low", enterNow: [3,4,5,6].includes(lastDigit ?? -1), reason: `Mid digits 3–6 at ${midPct.toFixed(1)}%` });
    }
  }

  if (tab === "high-low") {
    const recent5 = digits.slice(-5);
    if (recent5.length === 5) {
      const maxR = Math.max(...recent5);
      const minR = Math.min(...recent5);
      push({ type: "HIGH TICK", confidence: Math.min(75, 60 + (pct[maxR] > 12 ? 15 : 8)), entryDigit: `Digit ${maxR}`, ticks: "5 ticks", risk: "Medium", enterNow: lastDigit === maxR, reason: `Digit ${maxR} is period high — ${pct[maxR].toFixed(1)}% frequency` });
      push({ type: "LOW TICK",  confidence: Math.min(75, 60 + (pct[minR] > 12 ? 15 : 8)), entryDigit: `Digit ${minR}`, ticks: "5 ticks", risk: "Medium", enterNow: lastDigit === minR, reason: `Digit ${minR} is period low — ${pct[minR].toFixed(1)}% frequency` });
    }
  }

  if (tab === "matches") {
    if (maxPct > 13) push({ type: "MATCHES", confidence: Math.min(88, 55 + (maxPct-10)*2), entryDigit: `Enter BEFORE digit ${maxD} appears`, ticks: "1 tick", risk: "Low", enterNow: lastDigit !== null && lastDigit !== maxD, reason: `Digit ${maxD} at ${maxPct.toFixed(1)}% — statistically hot. Enter on any other digit.` });
    if (maxPct > 10) push({ type: "MATCHES", subLabel: `Digit ${maxD}`, confidence: Math.min(80, 55 + (maxPct-10)*1.5), entryDigit: `Match digit ${maxD}`, ticks: "1 tick", risk: "Low", enterNow: lastDigit !== null && lastDigit !== maxD, reason: `Digit ${maxD} appeared ${Math.round(maxPct/100 * last100.length)}× in last 100 ticks` });
  }

  if (tab === "even-odd") {
    if (evenPct > 54) push({ type: "EVEN", confidence: Math.min(80, 50 + evenPct - 50), entryDigit: "Enter on any even digit", ticks: "1 tick", risk: "Low", enterNow: lastDigit !== null && lastDigit % 2 === 0, reason: `Even digits at ${evenPct.toFixed(1)}% frequency` });
    else if (oddPct > 54) push({ type: "ODD", confidence: Math.min(80, 50 + oddPct - 50), entryDigit: "Enter on any odd digit", ticks: "1 tick", risk: "Low", enterNow: lastDigit !== null && lastDigit % 2 !== 0, reason: `Odd digits at ${oddPct.toFixed(1)}% frequency` });
    if (minPct < 7) push({ type: "DIFFERS", confidence: Math.min(85, 55 + (10-minPct)*2), entryDigit: `Differ digit ${minD}`, ticks: "1 tick", risk: "Low", enterNow: lastDigit !== null && lastDigit !== minD, reason: `Digit ${minD} only ${minPct.toFixed(1)}% — cold. Enter on any digit to differ it.` });
  }

  if (tab === "accumulators") {
    const recent10 = digits.slice(-10);
    if (recent10.length >= 10) {
      const variance = recent10.reduce((s,d) => s + Math.abs(d-5), 0) / recent10.length;
      if (variance < 2.5) push({ type: "ACCUMULATOR", subLabel: "Growth 1%", confidence: 74, entryDigit: "±0.01% barrier", ticks: "5–20 ticks", risk: "Low", enterNow: true, reason: `Low digit variance ${variance.toFixed(2)} — stable, accumulate growth` });
      if (maxPct > 12 && maxPct < 18) push({ type: "ACCUMULATOR", subLabel: "Steady trend", confidence: 70, entryDigit: "Current barrier", ticks: "10–30 ticks", risk: "Low", enterNow: true, reason: `Consistent digit pattern — accumulate safely` });
    }
  }

  if (tab === "asians") {
    const last20 = digits.slice(-20);
    if (last20.length >= 20) {
      const avg = last20.reduce((s,d) => s + d, 0) / last20.length;
      const avgDigit = Math.round(avg) % 10;
      if (avg > 5.2) push({ type: "ASIAN OVER", confidence: Math.min(78, 68 + Math.round((avg-5)*5)), entryDigit: `Avg ${avg.toFixed(2)}`, ticks: "End of period", risk: "Medium", enterNow: lastDigit !== null && lastDigit > 5, reason: `20-tick avg digit = ${avg.toFixed(2)} (above 5)` });
      if (avg < 4.8) push({ type: "ASIAN UNDER", confidence: Math.min(78, 68 + Math.round((5-avg)*5)), entryDigit: `Avg ${avg.toFixed(2)}`, ticks: "End of period", risk: "Medium", enterNow: lastDigit !== null && lastDigit < 5, reason: `20-tick avg digit = ${avg.toFixed(2)} (below 5)` });
      const evenAvg = avg % 1 < 0.3 || avg % 1 > 0.7;
      if (evenAvg && avgDigit % 2 === 0) push({ type: "ASIAN EVEN", confidence: 66, entryDigit: `Digit ${avgDigit}`, ticks: "End of period", risk: "Medium", enterNow: lastDigit !== null && lastDigit % 2 === 0, reason: `Average rounds to ${avgDigit} (even)` });
    }
  }

  return results.sort((a, b) => (b.enterNow ? 1 : 0) - (a.enterNow ? 1 : 0) || b.confidence - a.confidence);
}

const TYPE_COLORS: Record<string, string> = {
  RISE: "text-green-400", FALL: "text-red-400",
  EVEN: "text-blue-400", ODD: "text-orange-400",
  MATCHES: "text-primary", DIFFERS: "text-purple-400",
  ACCUMULATOR: "text-yellow-400", "HIGH TICK": "text-green-300", "LOW TICK": "text-red-300",
  "IN (Stay In)": "text-primary", "IN (Mid Range)": "text-primary", "OUT (Exit)": "text-orange-400",
  "ASIAN OVER": "text-green-400", "ASIAN UNDER": "text-red-400", "ASIAN EVEN": "text-blue-300",
  "OVER": "text-primary", "UNDER": "text-orange-400",
};

function typeColor(t: string) {
  return Object.entries(TYPE_COLORS).find(([k]) => t.startsWith(k) || t === k)?.[1] ?? "text-primary";
}

const RISK_DOT: Record<string, string> = { Low: "bg-green-500", Medium: "bg-yellow-500", High: "bg-red-500" };

export default function TickGenerator() {
  const [activeTab, setActiveTab] = useState<TabId>("over-under");
  const [selectedMarket, setSelectedMarket] = useState("R_50");

  const { digits, lastDigit, currentPrice, isConnected, historyLoaded } = useDerivWebSocket(selectedMarket);
  const mkt = MARKETS.find((m) => m.symbol === selectedMarket);

  const signals = useMemo(
    () => buildSignals(digits.map((d) => d.digit), lastDigit, activeTab),
    [digits, lastDigit, activeTab]
  );

  const enterNowCount = signals.filter((s) => s.enterNow).length;

  return (
    <div className="space-y-5">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: "linear-gradient(to right,#f97316,transparent)" }} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "#f97316" }}>
            <Cpu className="w-6 h-6" style={{ color: "#f97316" }} /> Signal Generator
          </h1>
          <p className="text-muted-foreground text-sm">
            Real-time signals for {mkt?.name ?? selectedMarket} · {digits.length} ticks loaded
          </p>
        </div>
        <div className="flex items-center gap-2">
          {enterNowCount > 0 && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
              <Zap className="w-3 h-3 mr-1" /> {enterNowCount} ENTER NOW
            </Badge>
          )}
          <Badge variant="outline" className={`gap-1.5 text-xs ${isConnected ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {isConnected ? "Live" : "Connecting"}
          </Badge>
        </div>
      </div>

      {/* Market selector + live stats */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Select Market</label>
              <MarketSelector value={selectedMarket} onChange={setSelectedMarket} testId="select-market-tick-generator" />
            </div>
            <div className="flex gap-5 text-sm">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Price</div>
                <div className="font-mono font-bold text-primary">{currentPrice?.toFixed(4) ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Current digit</div>
                <div
                  className="font-mono font-black text-2xl"
                  style={{ color: lastDigit !== null ? DIGIT_COLORS[lastDigit] : undefined }}
                >
                  {lastDigit ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Ticks</div>
                <div className="font-mono font-bold">{digits.length}{!historyLoaded && <span className="text-yellow-400 ml-1 text-[10px]">loading…</span>}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Digit frequency mini-bar for selected market */}
      {digits.length >= 30 && (
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-end h-10 gap-0.5">
              {(() => {
                const last100 = digits.slice(-100).map(d => d.digit);
                const counts = new Array(10).fill(0);
                last100.forEach(d => counts[d]++);
                const pcts = counts.map(c => last100.length > 0 ? (c / last100.length) * 100 : 0);
                const maxP = Math.max(...pcts);
                const minP = Math.min(...pcts);
                return pcts.map((p, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
                    <span className="text-[8px] font-mono text-muted-foreground">{p.toFixed(0)}</span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(p * 2.5, 8)}%`,
                        backgroundColor: p === maxP ? "#10b981" : p === minP ? "#ef4444" : DIGIT_COLORS[i],
                        opacity: 0.8,
                      }}
                    />
                    <span className="text-[8px] font-mono" style={{ color: DIGIT_COLORS[i] }}>{i}</span>
                  </div>
                ));
              })()}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
              <span>Digit frequency — last 100 ticks</span>
              <span className="text-green-400">■ hottest &nbsp;</span>
              <span className="text-red-400">■ coldest</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-muted/30 rounded-lg border border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Signals */}
      {digits.length < 30 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground space-y-3">
          <Activity className="w-12 h-12 opacity-20" />
          <p className="font-bold">Collecting tick data…</p>
          <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(digits.length / 30) * 100}%` }} />
          </div>
          <p className="text-xs font-mono">{digits.length} / 30 ticks needed</p>
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground space-y-2">
          <Activity className="w-12 h-12 opacity-20" />
          <p className="font-bold">No signals for this tab yet</p>
          <p className="text-sm">Market conditions don't meet the thresholds — check another tab</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {signals.map((sig, idx) => (
            <Card
              key={`${sig.type}-${idx}`}
              className={`relative overflow-hidden border-2 transition-all ${
                sig.enterNow
                  ? "border-primary shadow-[0_0_20px_rgba(0,209,209,0.15)] scale-[1.01]"
                  : "border-border hover:border-border/80"
              }`}
            >
              {sig.enterNow && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-pulse" />}
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="text-xs font-mono text-muted-foreground">{mkt?.name}</CardTitle>
                    <div className={`text-xl font-black font-mono ${typeColor(sig.type)}`}>
                      {sig.type}
                      {sig.subLabel && <span className="text-xs ml-2 font-normal opacity-70">{sig.subLabel}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {sig.enterNow
                      ? <Badge className="bg-primary text-primary-foreground text-[10px] animate-pulse">ENTER NOW</Badge>
                      : <Badge variant="outline" className="text-[10px]">WATCHING</Badge>}
                    <div className="text-xl font-black text-primary font-mono mt-1">{sig.confidence}%</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {/* Freq mini-bars */}
                {sig.freqs && (
                  <div className="flex h-7 gap-0.5 items-end bg-muted/30 rounded p-1">
                    {sig.freqs.map((f, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(f * 2.5, 8)}%`,
                          backgroundColor: i === sig.freqs!.indexOf(Math.max(...sig.freqs!)) ? "#10b981"
                            : i === sig.freqs!.indexOf(Math.min(...sig.freqs!)) ? "#ef4444"
                            : DIGIT_COLORS[i],
                          opacity: 0.7,
                        }}
                        title={`${i}: ${f.toFixed(1)}%`}
                      />
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2 leading-relaxed">
                  {sig.reason}
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-muted rounded p-2">
                    <div className="text-muted-foreground">Entry</div>
                    <div className="font-bold font-mono">{sig.entryDigit}</div>
                  </div>
                  <div className="bg-muted rounded p-2">
                    <div className="text-muted-foreground flex items-center gap-1"><Zap className="w-2.5 h-2.5" />Ticks</div>
                    <div className="font-bold font-mono">{sig.ticks}</div>
                  </div>
                  <div className="bg-muted rounded p-2">
                    <div className="text-muted-foreground">Risk</div>
                    <div className="flex items-center gap-1 font-bold">
                      <div className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[sig.risk]}`} />
                      {sig.risk}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-muted-foreground">
                    Current: <strong className="text-foreground" style={{ color: lastDigit !== null ? DIGIT_COLORS[lastDigit] : undefined }}>{lastDigit ?? "—"}</strong>
                  </span>
                  <span className="text-muted-foreground">Valid: 2–5 min</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
