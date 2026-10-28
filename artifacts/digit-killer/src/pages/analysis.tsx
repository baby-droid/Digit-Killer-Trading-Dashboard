import { useMemo } from "react";
import {
  useDerivWebSocket,
  MARKETS,
  MARKETS_BY_CATEGORY,
  CATEGORY_LABELS,
  MarketCategory,
  refreshMarketCatalog,
  useMarketList,
} from "@/hooks/useDerivWebSocket";
import { useMarket } from "@/lib/market-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from "recharts";
import { TrendingUp, TrendingDown, Target, Activity, Zap, AlertCircle } from "lucide-react";

const DIGIT_COLORS = [
  "#6366f1","#3b82f6","#06b6d4","#10b981","#84cc16",
  "#f59e0b","#f97316","#ef4444","#ec4899","#a855f7",
];

function pct(count: number, total: number) {
  return total > 0 ? (count / total) * 100 : 0;
}

export default function Analysis() {
  const { activeMarket, setActiveMarket } = useMarket();
  const {
    digits,
    lastDigit,
    currentPrice,
    isConnected,
    historyLoaded,
    historyPhase,
    error: historyError,
    refreshHistory,
  } = useDerivWebSocket(activeMarket);
  const marketCatalog = useMarketList();

  const mkt = MARKETS.find((m) => m.symbol === activeMarket);

  const last1000 = useMemo(() => digits.slice(-1000).map((d) => d.digit), [digits]);
  const last100  = useMemo(() => digits.slice(-100).map((d) => d.digit),  [digits]);

  const freqs1000 = useMemo(() => {
    const counts = new Array(10).fill(0);
    last1000.forEach((d) => counts[d]++);
    return counts.map((c) => ({ count: c, pct: pct(c, last1000.length) }));
  }, [last1000]);

  const freqs100 = useMemo(() => {
    const counts = new Array(10).fill(0);
    last100.forEach((d) => counts[d]++);
    return counts.map((c) => ({ count: c, pct: pct(c, last100.length) }));
  }, [last100]);

  const maxDigit1000 = freqs1000.reduce((mx, f, i) => (f.pct > freqs1000[mx].pct ? i : mx), 0);
  const minDigit1000 = freqs1000.reduce((mn, f, i) => (f.pct < freqs1000[mn].pct ? i : mn), 0);

  const maxDigit100 = freqs100.reduce((mx, f, i) => (f.pct > freqs100[mx].pct ? i : mx), 0);
  const minDigit100 = freqs100.reduce((mn, f, i) => (f.pct < freqs100[mn].pct ? i : mn), 0);

  const evenPct1000 = pct([0,2,4,6,8].reduce((s,d) => s + freqs1000[d].count, 0), last1000.length);
  const overPct1000 = pct([5,6,7,8,9].reduce((s,d) => s + freqs1000[d].count, 0), last1000.length);

  const donutData = [
    { name: "Even", value: [0,2,4,6,8].reduce((s,d) => s + freqs1000[d].count, 0), color: "#00d1d1" },
    { name: "Odd",  value: [1,3,5,7,9].reduce((s,d) => s + freqs1000[d].count, 0), color: "#a855f7" },
  ];

  const matchSignal  = freqs100[maxDigit100].pct > 13;
  const differSignal = freqs100[minDigit100].pct < 7;
  const overSignal   = overPct1000 > 55;
  const underSignal  = overPct1000 < 45;
  const evenSignal   = evenPct1000 > 53;
  const oddSignal    = evenPct1000 < 47;

  const isReady = last1000.length >= 100;
  const historyStatus = marketCatalog.error
    ?? historyError
    ?? (last1000.length >= 1000
      ? `1,000 tick history ready · ${isConnected ? "live" : "reconnecting"}`
      : historyPhase === "queued"
        ? `${last1000.length.toLocaleString()} / 1,000 ticks · queued for history`
        : historyPhase === "loading"
          ? `${last1000.length.toLocaleString()} / 1,000 ticks · requesting history`
          : historyLoaded
            ? `${last1000.length.toLocaleString()} / 1,000 ticks received · collecting live history`
            : isConnected
              ? `${last1000.length.toLocaleString()} / 1,000 ticks · waiting for history response`
              : "Connecting to Deriv’s public market feed…");

  return (
    <div className="space-y-5">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: "linear-gradient(to right,#06b6d4,transparent)" }} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "#06b6d4" }}>
            <Activity className="w-6 h-6" style={{ color: "#06b6d4" }} /> Digit Analysis
          </h1>
          <p className="text-muted-foreground text-sm">
            {last1000.length >= 1000 ? "1000" : last1000.length} ticks analysed · {mkt?.name ?? activeMarket}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {last1000.length < 1000 && (
            <Badge
              variant="outline"
              className={`max-w-[min(52vw,300px)] truncate text-xs ${historyError ? "border-amber-400/30 text-amber-300" : "border-yellow-400/30 text-yellow-400"}`}
              title={historyStatus}
            >
              {historyStatus}
            </Badge>
          )}
          {historyError && (
            <button
              type="button"
              onClick={marketCatalog.error ? refreshMarketCatalog : refreshHistory}
              className="rounded border border-amber-400/30 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-400/10"
            >
              Retry
            </button>
          )}
          {marketCatalog.error && !historyError && (
            <button
              type="button"
              onClick={refreshMarketCatalog}
              className="rounded border border-amber-400/30 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-400/10"
            >
              Retry symbols
            </button>
          )}
          <Badge variant="outline" className={`gap-1.5 text-xs ${isConnected ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {isConnected ? "Live" : "Reconnecting"}
          </Badge>
        </div>
      </div>

      {/* Market selector */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-52">
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Market</label>
              <select
                value={activeMarket}
                onChange={(e) => setActiveMarket(e.target.value)}
                className="w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              >
                {Object.entries(MARKETS_BY_CATEGORY).map(([cat, mkts]) => (
                  <optgroup key={cat} label={CATEGORY_LABELS[cat as MarketCategory]}>
                    {mkts.map((m) => (
                      <option key={m.symbol} value={m.symbol}>{m.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase">Price</div>
                <div className="font-mono font-bold text-primary">{currentPrice?.toFixed(4) ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Last digit</div>
                <div className="font-mono font-black text-xl" style={{ color: lastDigit !== null ? DIGIT_COLORS[lastDigit] : undefined }}>
                  {lastDigit ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Ticks loaded</div>
                <div className="font-mono font-bold">{last1000.length}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isReady && (
        <div className="flex flex-col items-center py-16 text-muted-foreground space-y-3">
          <AlertCircle className="w-10 h-10 opacity-30" />
          <p className="font-bold">{historyError ? "Market history needs attention" : "Preparing the live analysis"}</p>
          <p className="max-w-sm text-center text-xs">{historyStatus}</p>
          <div className="w-56 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (last1000.length / 1000) * 100)}%` }} />
          </div>
          <p className="text-xs font-mono">{last1000.length.toLocaleString()} / 1,000 history ticks · 100 ticks needed to start chart analysis</p>
        </div>
      )}

      {isReady && (
        <>
          {/* Live Entry Signals */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "MATCH",  active: matchSignal,  digit: maxDigit100, sub: `${freqs100[maxDigit100].pct.toFixed(1)}%`, color: "#00d1d1", desc: "Enter BEFORE next tick" },
              { label: "DIFFER", active: differSignal, digit: minDigit100, sub: `${freqs100[minDigit100].pct.toFixed(1)}%`, color: "#a855f7", desc: "Avoid this digit" },
              { label: "EVEN",   active: evenSignal,   digit: null, sub: `${evenPct1000.toFixed(1)}%`,             color: "#3b82f6",  desc: "Even dominant" },
              { label: "ODD",    active: oddSignal,    digit: null, sub: `${(100-evenPct1000).toFixed(1)}%`,       color: "#f97316",  desc: "Odd dominant" },
              { label: overSignal ? (overPct1000 > 60 ? "OVER 4" : "OVER 5") : "OVER",  active: overSignal,  digit: null, sub: `${overPct1000.toFixed(1)}%`,         color: "#10b981",  desc: "High digits 5–9 lead" },
              { label: underSignal ? (overPct1000 < 40 ? "UNDER 4" : "UNDER 5") : "UNDER", active: underSignal, digit: null, sub: `${(100-overPct1000).toFixed(1)}%`, color: "#ef4444",  desc: "Low digits 0–4 lead" },
            ].map((sig) => (
              <div
                key={sig.label}
                className={`rounded-lg border p-3 transition-all ${sig.active ? "border-2 shadow-lg" : "border-border opacity-50"}`}
                style={sig.active ? { borderColor: sig.color, boxShadow: `0 0 16px ${sig.color}30` } : {}}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase" style={{ color: sig.color }}>{sig.label}</span>
                  {sig.active && <span className="text-[9px] bg-green-500/20 text-green-400 px-1 rounded font-bold">ENTER NOW</span>}
                </div>
                {sig.digit !== null && (
                  <div className="text-3xl font-black font-mono my-1" style={{ color: sig.color }}>{sig.digit}</div>
                )}
                <div className="text-xl font-black font-mono" style={{ color: sig.color }}>{sig.sub}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{sig.desc}</div>
              </div>
            ))}
          </div>

          {/* Match / Differ highlight */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2" style={{ borderColor: "#00d1d1", boxShadow: "0 0 20px #00d1d130" }}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black border-2"
                  style={{ backgroundColor: DIGIT_COLORS[maxDigit100] + "22", borderColor: DIGIT_COLORS[maxDigit100], color: DIGIT_COLORS[maxDigit100] }}>
                  {maxDigit100}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-bold">Best MATCH digit (100 ticks)</div>
                  <div className="text-2xl font-black text-primary">Digit {maxDigit100}</div>
                  <div className="text-sm text-muted-foreground">Appeared {freqs100[maxDigit100].count}× · {freqs100[maxDigit100].pct.toFixed(1)}%</div>
                  {matchSignal && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-green-400 font-bold">
                      <Zap className="w-3 h-3" /> Enter NOW — match digit {maxDigit100} on next tick
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2" style={{ borderColor: "#a855f7", boxShadow: "0 0 20px #a855f730" }}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black border-2"
                  style={{ backgroundColor: DIGIT_COLORS[minDigit100] + "22", borderColor: DIGIT_COLORS[minDigit100], color: DIGIT_COLORS[minDigit100] }}>
                  {minDigit100}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-bold">Best DIFFER digit (100 ticks)</div>
                  <div className="text-2xl font-black" style={{ color: "#a855f7" }}>Differ {minDigit100}</div>
                  <div className="text-sm text-muted-foreground">Appeared {freqs100[minDigit100].count}× · {freqs100[minDigit100].pct.toFixed(1)}%</div>
                  {differSignal && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-purple-400 font-bold">
                      <Zap className="w-3 h-3" /> Enter NOW — differ digit {minDigit100} on next tick
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 1000-tick frequency */}
            <Card className="bg-card border-border lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center justify-between">
                  <span>Digit Frequency — {last1000.length} Ticks</span>
                  <span className="text-xs text-primary font-mono">{last1000.length >= 1000 ? "Full 1000" : `${last1000.length}/1000`}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {freqs1000.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center font-mono font-black text-sm flex-shrink-0 border"
                        style={{ backgroundColor: DIGIT_COLORS[i] + "22", borderColor: DIGIT_COLORS[i], color: DIGIT_COLORS[i] }}
                      >
                        {i}
                      </div>
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${f.pct}%`, backgroundColor: DIGIT_COLORS[i] }}
                        />
                      </div>
                      <div className="w-16 text-right font-mono text-xs text-muted-foreground">
                        {f.count}× <span className="text-foreground font-bold">{f.pct.toFixed(1)}%</span>
                      </div>
                      {i === maxDigit1000 && <Badge className="text-[9px] h-4 bg-green-500/20 text-green-400 border-green-500/30">HOT</Badge>}
                      {i === minDigit1000 && <Badge className="text-[9px] h-4 bg-red-500/20 text-red-400 border-red-500/30">COLD</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Even/Odd donut */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Even / Odd (1000 ticks)</CardTitle>
                </CardHeader>
                <CardContent className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                        {donutData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Over/Under */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Over / Under 5 (1000 ticks)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-1">
                  {[
                    { label: "Over 5 (6–9)", value: pct([6,7,8,9].reduce((s,d) => s + freqs1000[d].count,0), last1000.length), color: "#10b981" },
                    { label: "= 5",          value: freqs1000[5].pct, color: "#f59e0b" },
                    { label: "Under 5 (0–4)", value: pct([0,1,2,3,4].reduce((s,d) => s + freqs1000[d].count,0), last1000.length), color: "#ef4444" },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-mono font-bold" style={{ color: row.color }}>{row.value.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${row.value}%`, backgroundColor: row.color }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Summary signals for best over/under markets */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Trading Signals for {mkt?.name ?? activeMarket}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-green-400 uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Best OVER trade
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trade type</span>
                      <span className="font-bold text-green-400">{overPct1000 > 60 ? "OVER 4" : overPct1000 > 55 ? "OVER 5" : overPct1000 > 50 ? "OVER 6" : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry digit</span>
                      <span className="font-mono font-bold">{[2,3,4].includes(lastDigit ?? -1) ? "✓ ENTER NOW (1 tick)" : "Wait for digit 2–4"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">High digit % (5–9)</span>
                      <span className="font-mono">{overPct1000.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-bold text-red-400 uppercase flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" /> Best UNDER trade
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trade type</span>
                      <span className="font-bold text-red-400">{overPct1000 < 40 ? "UNDER 4" : overPct1000 < 45 ? "UNDER 5" : overPct1000 < 50 ? "UNDER 6" : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry digit</span>
                      <span className="font-mono font-bold">{[5,6,7].includes(lastDigit ?? -1) ? "✓ ENTER NOW (1 tick)" : "Wait for digit 5–7"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Low digit % (0–4)</span>
                      <span className="font-mono">{(100 - overPct1000).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Heatmap: last 100 */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Digit Heatmap — Last 100 Ticks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {last100.map((digit, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 flex items-center justify-center text-[10px] font-mono font-bold rounded-sm border transition-all ${i === last100.length - 1 ? "ring-2 ring-primary" : ""}`}
                    style={{ backgroundColor: DIGIT_COLORS[digit] + "33", borderColor: DIGIT_COLORS[digit] + "88", color: DIGIT_COLORS[digit] }}
                  >
                    {digit}
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
