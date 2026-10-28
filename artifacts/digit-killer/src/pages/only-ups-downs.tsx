import { useState, useMemo } from "react";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { MarketSelector } from "@/components/market-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, TrendingUp, TrendingDown, Activity } from "lucide-react";

const ACCENT = "#f59e0b";

type Direction = "up" | "down" | "flat";

function getDirections(prices: number[]): Direction[] {
  const dirs: Direction[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) dirs.push("up");
    else if (prices[i] < prices[i - 1]) dirs.push("down");
    else dirs.push("flat");
  }
  return dirs;
}

function getStreak(dirs: Direction[]): { dir: Direction; count: number } {
  if (!dirs.length) return { dir: "flat", count: 0 };
  const last = dirs[dirs.length - 1];
  let count = 0;
  for (let i = dirs.length - 1; i >= 0; i--) {
    if (dirs[i] === last) count++;
    else break;
  }
  return { dir: last, count };
}

function DirectionBubble({ dir }: { dir: Direction }) {
  if (dir === "up")   return <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: "rgba(34,197,94,0.2)", border: "1px solid #22c55e", color: "#22c55e" }}>↑</div>;
  if (dir === "down") return <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: "rgba(239,68,68,0.2)", border: "1px solid #ef4444", color: "#ef4444" }}>↓</div>;
  return <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}>—</div>;
}

export default function OnlyUpsDowns() {
  const [selectedMarket, setSelectedMarket] = useState("R_10");
  const { digits, lastDigit, currentPrice, isConnected, historyLoaded } = useDerivWebSocket(selectedMarket);

  const prices      = useMemo(() => digits.map((d) => d.price), [digits]);
  const directions  = useMemo(() => getDirections(prices), [prices]);
  const recent30    = directions.slice(-30);
  const streak      = useMemo(() => getStreak(directions), [directions]);
  const last50      = directions.slice(-50);
  const upCount50   = last50.filter((d) => d === "up").length;
  const downCount50 = last50.filter((d) => d === "down").length;

  const onlyUpsSignal   = streak.dir === "up"   && streak.count >= 3;
  const onlyDownsSignal = streak.dir === "down"  && streak.count >= 3;
  const strongUp        = streak.dir === "up"    && streak.count >= 5;
  const strongDown      = streak.dir === "down"  && streak.count >= 5;

  const priceStr = currentPrice !== null
    ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })
    : "—";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: `linear-gradient(to right,${ACCENT},transparent)` }} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: ACCENT }}>
            <ArrowUpDown className="w-6 h-6" /> Only Ups / Only Downs
          </h1>
          <p className="text-muted-foreground text-sm">Real-time momentum direction · every tick must move in one direction</p>
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
            <MarketSelector value={selectedMarket} onChange={setSelectedMarket} testId="select-market-only-ups-downs" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-green-600 mb-1">Price</div>
              <div className="font-mono font-bold text-white text-lg">{priceStr}</div>
            </div>
            {lastDigit !== null && (
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl border-2" style={{ backgroundColor: "#00d1d1", borderColor: "#00d1d1", color: "#000", boxShadow: "0 0 20px rgba(0,209,209,0.5)" }}>
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
          {/* Signal cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Only Ups */}
            <Card className="border transition-all" style={{
              background: onlyUpsSignal ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
              borderColor: onlyUpsSignal ? (strongUp ? "#22c55e" : "rgba(34,197,94,0.4)") : "rgba(255,255,255,0.08)",
              boxShadow: strongUp ? "0 0 24px rgba(34,197,94,0.2)" : "none",
            }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="font-bold text-green-400">ONLY UPS</span>
                  </div>
                  {onlyUpsSignal && (
                    <Badge className={`${strongUp ? "bg-green-500 text-white animate-pulse" : "bg-green-500/20 text-green-300"} border-0 text-xs`}>
                      {strongUp ? "⚡ STRONG" : "SIGNAL"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current streak</span>
                    <span className="font-mono font-bold text-green-400">
                      {streak.dir === "up" ? `↑ ${streak.count} ticks` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Up ticks (last 50)</span>
                    <span className="font-mono font-bold">{upCount50} / 50</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(upCount50 / 50) * 100}%` }} />
                  </div>
                  {onlyUpsSignal ? (
                    <p className="text-xs text-green-300 mt-2">
                      {strongUp
                        ? `Strong upward momentum — ${streak.count} consecutive UP ticks. Enter ONLY UPS.`
                        : `Upward momentum building — ${streak.count} consecutive UP ticks. Watch for continuation.`}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">Wait for 3+ consecutive UP ticks before entry.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Only Downs */}
            <Card className="border transition-all" style={{
              background: onlyDownsSignal ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)",
              borderColor: onlyDownsSignal ? (strongDown ? "#ef4444" : "rgba(239,68,68,0.4)") : "rgba(255,255,255,0.08)",
              boxShadow: strongDown ? "0 0 24px rgba(239,68,68,0.2)" : "none",
            }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    <span className="font-bold text-red-400">ONLY DOWNS</span>
                  </div>
                  {onlyDownsSignal && (
                    <Badge className={`${strongDown ? "bg-red-500 text-white animate-pulse" : "bg-red-500/20 text-red-300"} border-0 text-xs`}>
                      {strongDown ? "⚡ STRONG" : "SIGNAL"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current streak</span>
                    <span className="font-mono font-bold text-red-400">
                      {streak.dir === "down" ? `↓ ${streak.count} ticks` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Down ticks (last 50)</span>
                    <span className="font-mono font-bold">{downCount50} / 50</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${(downCount50 / 50) * 100}%` }} />
                  </div>
                  {onlyDownsSignal ? (
                    <p className="text-xs text-red-300 mt-2">
                      {strongDown
                        ? `Strong bearish momentum — ${streak.count} consecutive DOWN ticks. Enter ONLY DOWNS.`
                        : `Bearish pressure building — ${streak.count} consecutive DOWN ticks. Watch for continuation.`}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">Wait for 3+ consecutive DOWN ticks before entry.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent direction stream */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Recent Tick Directions · last 30</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-1">
                {recent30.map((d, i) => <DirectionBubble key={i} dir={d} />)}
              </div>
              <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1 text-green-400">↑ Up tick</span>
                <span className="flex items-center gap-1 text-red-400">↓ Down tick</span>
                <span className="flex items-center gap-1 text-muted-foreground">— Flat</span>
              </div>
            </CardContent>
          </Card>

          {/* Entry rules */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Entry Rules</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {[
                  { label: "ONLY UPS entry", value: "3–4 consecutive UP ticks, tick speed accelerating, no downward hesitation" },
                  { label: "ONLY DOWNS entry", value: "3–4 consecutive DOWN ticks, downward acceleration strong, no bullish interruption" },
                  { label: "Strong signal (⚡)", value: "5+ consecutive ticks in one direction — highest probability entry" },
                  { label: "Avoid", value: "Sideways alternating ticks, random spikes, laggy execution, weak momentum" },
                ].map(({ label, value }) => (
                  <div key={label} className="border-b border-border/30 pb-2">
                    <div className="font-bold text-amber-400 mb-0.5">{label}</div>
                    <div className="text-muted-foreground">{value}</div>
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
