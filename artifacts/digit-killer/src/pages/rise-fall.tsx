import { useState, useMemo } from "react";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { MarketSelector } from "@/components/market-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, BarChart2 } from "lucide-react";

const ACCENT = "#06b6d4";

export default function RiseFall() {
  const [selectedMarket, setSelectedMarket] = useState("R_25");
  const [window, setWindow] = useState(20);
  const { digits, lastDigit, currentPrice, isConnected, historyLoaded } = useDerivWebSocket(selectedMarket);

  const prices = useMemo(() => digits.map((d) => d.price), [digits]);

  const recentPrices = prices.slice(-window);
  const ups   = recentPrices.length > 1 ? recentPrices.filter((p, i) => i > 0 && p > recentPrices[i - 1]).length : 0;
  const downs = recentPrices.length > 1 ? recentPrices.filter((p, i) => i > 0 && p < recentPrices[i - 1]).length : 0;
  const total = ups + downs;

  const riseScore = total > 0 ? (ups / total) * 100 : 50;
  const fallScore = total > 0 ? (downs / total) * 100 : 50;

  const riseSignal = riseScore >= 65;
  const fallSignal = fallScore >= 65;
  const strongRise = riseScore >= 75;
  const strongFall = fallScore >= 75;

  const firstPrice = recentPrices[0] ?? null;
  const lastPrice  = recentPrices[recentPrices.length - 1] ?? null;
  const netChange  = firstPrice && lastPrice ? lastPrice - firstPrice : null;
  const netPct     = firstPrice && netChange !== null ? ((netChange / firstPrice) * 100).toFixed(4) : null;

  const priceStr = currentPrice !== null
    ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })
    : "—";

  const recentDirs = useMemo(() => {
    const dirs: boolean[] = [];
    for (let i = 1; i < Math.min(prices.length, 40); i++) {
      dirs.push(prices[prices.length - 40 + i] > prices[prices.length - 40 + i - 1]);
    }
    return dirs;
  }, [prices]);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: `linear-gradient(to right,${ACCENT},transparent)` }} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: ACCENT }}>
            <BarChart2 className="w-6 h-6" /> Rise & Fall
          </h1>
          <p className="text-muted-foreground text-sm">Trend direction analysis · predict next price movement</p>
        </div>
        <Badge variant="outline" className={`gap-1.5 font-mono text-xs ${isConnected ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          {isConnected ? "Live" : "Connecting..."}
        </Badge>
      </div>

      {/* Market selector */}
      <Card className="border" style={{ background: "linear-gradient(135deg,rgba(5,46,22,0.95),rgba(3,30,15,0.98))", borderColor: "#166534" }}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-48">
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#4ade80" }}>Select Market:</label>
              <MarketSelector value={selectedMarket} onChange={setSelectedMarket} testId="select-market-rise-fall" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#4ade80" }}>Analysis window:</label>
              <div className="flex gap-1.5">
                {[10, 20, 50, 100].map((n) => (
                  <button key={n} onClick={() => setWindow(n)}
                    className="px-3 py-1.5 rounded text-xs font-bold border transition-all"
                    style={window === n ? { backgroundColor: "#16a34a", borderColor: "#16a34a", color: "#fff" } : { backgroundColor: "rgba(22,163,74,0.1)", borderColor: "#166534", color: "#4ade80" }}
                  >{n}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xs text-green-600">Price</div>
                <div className="font-mono font-bold text-white">{priceStr}</div>
              </div>
              {lastDigit !== null && (
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-lg border-2" style={{ backgroundColor: "#00d1d1", borderColor: "#00d1d1", color: "#000", boxShadow: "0 0 16px rgba(0,209,209,0.5)" }}>
                  {lastDigit}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!historyLoaded ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <Activity className="w-8 h-8 opacity-20 animate-spin" />
            <p className="text-sm">Loading market data…</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Net change */}
          {netChange !== null && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Net Change", value: `${netChange > 0 ? "+" : ""}${netChange.toFixed(5)}`, color: netChange > 0 ? "#22c55e" : "#ef4444" },
                { label: "Change %", value: `${netChange > 0 ? "+" : ""}${netPct}%`, color: netChange > 0 ? "#22c55e" : "#ef4444" },
                { label: "Direction", value: netChange > 0 ? "↑ RISING" : netChange < 0 ? "↓ FALLING" : "→ FLAT", color: netChange > 0 ? "#22c55e" : netChange < 0 ? "#ef4444" : "rgba(255,255,255,0.5)" },
              ].map(({ label, value, color }) => (
                <Card key={label} className="bg-card border-border">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{label}</div>
                    <div className="font-mono font-black text-lg" style={{ color }}>{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Rise / Fall signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border transition-all" style={{
              background: riseSignal ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
              borderColor: riseSignal ? (strongRise ? "#22c55e" : "rgba(34,197,94,0.4)") : "rgba(255,255,255,0.08)",
              boxShadow: strongRise ? "0 0 24px rgba(34,197,94,0.2)" : "none",
            }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="font-bold text-green-400 text-lg">RISE</span>
                  </div>
                  {riseSignal && (
                    <Badge className={`${strongRise ? "bg-green-500 text-white animate-pulse" : "bg-green-500/20 text-green-300"} border-0`}>
                      {strongRise ? "⚡ STRONG" : "SIGNAL"}
                    </Badge>
                  )}
                </div>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${riseScore}%`, boxShadow: "0 0 8px rgba(34,197,94,0.5)" }} />
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Up ticks</span>
                  <span className="font-mono font-bold text-green-400">{ups} / {total} ({riseScore.toFixed(0)}%)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {riseSignal ? (strongRise ? `Strong bullish trend — ${riseScore.toFixed(0)}% up ticks. High probability RISE entry.` : `Bullish bias detected — ${riseScore.toFixed(0)}% up ticks. Consider RISE entry.`) : "Insufficient bullish momentum. Wait for 65%+ up ticks."}
                </p>
              </CardContent>
            </Card>

            <Card className="border transition-all" style={{
              background: fallSignal ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)",
              borderColor: fallSignal ? (strongFall ? "#ef4444" : "rgba(239,68,68,0.4)") : "rgba(255,255,255,0.08)",
              boxShadow: strongFall ? "0 0 24px rgba(239,68,68,0.2)" : "none",
            }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    <span className="font-bold text-red-400 text-lg">FALL</span>
                  </div>
                  {fallSignal && (
                    <Badge className={`${strongFall ? "bg-red-500 text-white animate-pulse" : "bg-red-500/20 text-red-300"} border-0`}>
                      {strongFall ? "⚡ STRONG" : "SIGNAL"}
                    </Badge>
                  )}
                </div>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${fallScore}%`, boxShadow: "0 0 8px rgba(239,68,68,0.5)" }} />
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Down ticks</span>
                  <span className="font-mono font-bold text-red-400">{downs} / {total} ({fallScore.toFixed(0)}%)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fallSignal ? (strongFall ? `Strong bearish trend — ${fallScore.toFixed(0)}% down ticks. High probability FALL entry.` : `Bearish bias detected — ${fallScore.toFixed(0)}% down ticks. Consider FALL entry.`) : "Insufficient bearish momentum. Wait for 65%+ down ticks."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Mini chart - direction stream */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Tick Direction Stream · last 40</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-end gap-0.5 h-16">
                {recentDirs.map((up, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: up ? "100%" : "40%",
                      backgroundColor: up ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
                      minWidth: 4,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-1 inline-block rounded" style={{ backgroundColor: "rgba(34,197,94,0.6)" }} /> Rise tick</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1 inline-block rounded" style={{ backgroundColor: "rgba(239,68,68,0.6)" }} /> Fall tick</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
