import { useState, useMemo } from "react";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { MarketSelector } from "@/components/market-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";

const ACCENT = "#e879f9";

type TickDir = 1 | -1 | 0;

function getDirections(prices: number[]): TickDir[] {
  const dirs: TickDir[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) dirs.push(1);
    else if (prices[i] < prices[i - 1]) dirs.push(-1);
    else dirs.push(0);
  }
  return dirs;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0];
  for (const v of values) {
    prev = v * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function rsi(prices: number[], period = 7): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(-period - 1).map((p, i, a) => (i === 0 ? 0 : p - a[i - 1])).slice(1);
  const gains = changes.filter((c) => c > 0).reduce((s, c) => s + c, 0) / period;
  const losses = changes.filter((c) => c < 0).reduce((s, c) => s + Math.abs(c), 0) / period;
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export default function HighLowTick() {
  const [selectedMarket, setSelectedMarket] = useState("1HZ25V");
  const { digits, lastDigit, currentPrice, isConnected, historyLoaded } = useDerivWebSocket(selectedMarket);

  const prices = useMemo(() => digits.map((d) => d.price), [digits]);
  const dirs   = useMemo(() => getDirections(prices), [prices]);

  const recentPrices = prices.slice(-30);
  const ema3  = useMemo(() => (recentPrices.length >= 3  ? ema(recentPrices, 3)  : []), [recentPrices]);
  const ema5  = useMemo(() => (recentPrices.length >= 5  ? ema(recentPrices, 5)  : []), [recentPrices]);
  const ema9  = useMemo(() => (recentPrices.length >= 9  ? ema(recentPrices, 9)  : []), [recentPrices]);
  const rsiVal = useMemo(() => rsi(recentPrices, 7), [recentPrices]);

  const lastEma3 = ema3[ema3.length - 1] ?? 0;
  const lastEma5 = ema5[ema5.length - 1] ?? 0;
  const lastEma9 = ema9[ema9.length - 1] ?? 0;

  const emaStackUp   = lastEma3 > lastEma5 && lastEma5 > lastEma9;
  const emaStackDown = lastEma3 < lastEma5 && lastEma5 < lastEma9;

  const last4 = dirs.slice(-4);
  const consecutiveUp   = last4.length >= 3 && last4.slice(-3).every((d) => d === 1);
  const consecutiveDown = last4.length >= 3 && last4.slice(-3).every((d) => d === -1);

  const rsiUp   = rsiVal > 55;
  const rsiDown = rsiVal < 45;

  const last5 = dirs.slice(-5);
  const exhaustionUp   = last5.filter((d) => d === 1).length >= 5;
  const exhaustionDown = last5.filter((d) => d === -1).length >= 5;

  const highTickSignal = (consecutiveUp && emaStackUp) || (exhaustionDown && rsiDown);
  const lowTickSignal  = (consecutiveDown && emaStackDown) || (exhaustionUp && rsiUp);
  const highTickStrong = consecutiveUp && emaStackUp && rsiUp;
  const lowTickStrong  = consecutiveDown && emaStackDown && rsiDown;

  const recentDirs40 = dirs.slice(-40);

  const priceStr = currentPrice !== null
    ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })
    : "—";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: `linear-gradient(to right,${ACCENT},transparent)` }} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: ACCENT }}>
            <BarChart2 className="w-6 h-6" /> High Tick / Low Tick
          </h1>
          <p className="text-muted-foreground text-sm">Micro-momentum analysis · EMA stack + RSI filters</p>
        </div>
        <Badge variant="outline" className={`gap-1.5 font-mono text-xs ${isConnected ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          {isConnected ? "Live" : "Connecting..."}
        </Badge>
      </div>

      {/* Market selector */}
      <Card className="border" style={{ background: "linear-gradient(135deg,rgba(5,46,22,0.95),rgba(3,30,15,0.98))", borderColor: "#166534" }}>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-48">
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#4ade80" }}>Select Market:</label>
            <MarketSelector value={selectedMarket} onChange={setSelectedMarket} testId="select-market-high-low-tick" />
          </div>
          <div className="flex items-center gap-4">
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
          {/* Indicators row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "RSI (7)", value: rsiVal.toFixed(1), color: rsiUp ? "#22c55e" : rsiDown ? "#ef4444" : "rgba(255,255,255,0.7)", sub: rsiUp ? "Bullish" : rsiDown ? "Bearish" : "Neutral" },
              { label: "EMA Stack", value: emaStackUp ? "BULL ↑" : emaStackDown ? "BEAR ↓" : "MIXED", color: emaStackUp ? "#22c55e" : emaStackDown ? "#ef4444" : "rgba(255,255,255,0.5)", sub: "3/5/9" },
              { label: "EMA-3", value: lastEma3 > 0 ? lastEma3.toFixed(3) : "—", color: "#e879f9", sub: "Fast" },
              { label: "Momentum", value: consecutiveUp ? `↑×3` : consecutiveDown ? `↓×3` : last4.slice(-1)[0] === 1 ? "↑" : "↓", color: consecutiveUp ? "#22c55e" : consecutiveDown ? "#ef4444" : "rgba(255,255,255,0.5)", sub: "Last 3 ticks" },
            ].map(({ label, value, color, sub }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="p-3 text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
                  <div className="font-mono font-black text-base" style={{ color }}>{value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* HIGH / LOW TICK signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border transition-all" style={{
              background: highTickSignal ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
              borderColor: highTickSignal ? (highTickStrong ? "#22c55e" : "rgba(34,197,94,0.4)") : "rgba(255,255,255,0.08)",
              boxShadow: highTickStrong ? "0 0 24px rgba(34,197,94,0.25)" : "none",
            }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="font-bold text-green-400 text-lg">HIGH TICK</span>
                  </div>
                  {highTickSignal && (
                    <Badge className={`${highTickStrong ? "bg-green-500 text-white animate-pulse" : "bg-green-500/20 text-green-300"} border-0`}>
                      {highTickStrong ? <><Zap className="w-3 h-3 mr-1 inline" />STRONG</> : "SIGNAL"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5 text-xs">
                  {[
                    { label: "3+ Consecutive UP", ok: consecutiveUp },
                    { label: "EMA Stack Bullish", ok: emaStackUp },
                    { label: "RSI > 55", ok: rsiUp },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-bold ${ok ? "text-green-400" : "text-muted-foreground/40"}`}>{ok ? "✓" : "✗"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {highTickSignal
                    ? (highTickStrong ? "All conditions met — HIGH TICK entry recommended. Best tick: 1 tick duration." : "Partial signal — upward pressure detected. Watch for RSI confirmation.")
                    : "Wait for 3+ consecutive UP ticks with bullish EMA stack and RSI > 55."}
                </p>
              </CardContent>
            </Card>

            <Card className="border transition-all" style={{
              background: lowTickSignal ? "rgba(232,121,249,0.08)" : "rgba(255,255,255,0.02)",
              borderColor: lowTickSignal ? (lowTickStrong ? "#e879f9" : "rgba(232,121,249,0.4)") : "rgba(255,255,255,0.08)",
              boxShadow: lowTickStrong ? "0 0 24px rgba(232,121,249,0.2)" : "none",
            }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-fuchsia-400" />
                    <span className="font-bold text-fuchsia-400 text-lg">LOW TICK</span>
                  </div>
                  {lowTickSignal && (
                    <Badge className={`${lowTickStrong ? "bg-fuchsia-500 text-white animate-pulse" : "bg-fuchsia-500/20 text-fuchsia-300"} border-0`}>
                      {lowTickStrong ? <><Zap className="w-3 h-3 mr-1 inline" />STRONG</> : "SIGNAL"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5 text-xs">
                  {[
                    { label: "3+ Consecutive DOWN", ok: consecutiveDown },
                    { label: "EMA Stack Bearish", ok: emaStackDown },
                    { label: "RSI < 45", ok: rsiDown },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-bold ${ok ? "text-fuchsia-400" : "text-muted-foreground/40"}`}>{ok ? "✓" : "✗"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {lowTickSignal
                    ? (lowTickStrong ? "All conditions met — LOW TICK entry recommended. Best tick: 1 tick duration." : "Partial signal — downward pressure detected. Watch for RSI confirmation.")
                    : "Wait for 3+ consecutive DOWN ticks with bearish EMA stack and RSI < 45."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Direction stream */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Tick Momentum Stream · last 40</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center gap-0.5 h-12">
                {recentDirs40.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: d === 1 ? "100%" : d === -1 ? "40%" : "70%",
                      backgroundColor: d === 1 ? "rgba(34,197,94,0.7)" : d === -1 ? "rgba(232,121,249,0.7)" : "rgba(255,255,255,0.15)",
                      minWidth: 3,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1 text-green-400">↑ High tick</span>
                <span className="flex items-center gap-1 text-fuchsia-400">↓ Low tick</span>
              </div>
            </CardContent>
          </Card>

          {/* EMA Reference */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">EMA Micro Stack Reference</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                {[{ k: "EMA-3 (Fast)", v: lastEma3 }, { k: "EMA-5 (Med)", v: lastEma5 }, { k: "EMA-9 (Slow)", v: lastEma9 }].map(({ k, v }) => (
                  <div key={k} className="rounded-lg p-3 border border-border/30 bg-muted/20">
                    <div className="text-muted-foreground mb-1">{k}</div>
                    <div className="font-mono font-bold text-fuchsia-300">{v > 0 ? v.toFixed(4) : "—"}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-lg border border-border/30 bg-muted/20 text-xs">
                <div className="font-bold text-fuchsia-400 mb-1">Signal Logic:</div>
                <div className="text-muted-foreground space-y-0.5">
                  <div><span className="text-green-400">HIGH TICK:</span> EMA3 &gt; EMA5 &gt; EMA9 + RSI &gt; 55 + 3 consecutive UP ticks</div>
                  <div><span className="text-fuchsia-400">LOW TICK:</span> EMA3 &lt; EMA5 &lt; EMA9 + RSI &lt; 45 + 3 consecutive DOWN ticks</div>
                  <div><span className="text-yellow-400">Best duration:</span> 1 tick · Best markets: V10 1s, V25 1s, Step Index</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
