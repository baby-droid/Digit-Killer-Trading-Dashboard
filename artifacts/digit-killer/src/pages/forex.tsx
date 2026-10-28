import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useForexWebSocket } from "@/hooks/useDerivWebSocket";
import { calculateEMA, calculateSMA, calculateMACD, buildCandles } from "@/lib/indicators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart2, Zap } from "lucide-react";

const SYMBOL = "frxXAUUSD";

function formatTime(epoch: number) {
  const d = new Date(epoch * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

type CandleBarProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { open: number; high: number; low: number; close: number; isGreen: boolean; yMin: number; yMax: number };
};

function CandleBar(props: CandleBarProps) {
  const { x = 0, y = 0, width = 0, payload } = props;
  if (!payload) return null;
  const { open, high, low, close, isGreen } = payload;
  const range = payload.yMax - payload.yMin;
  if (range === 0) return null;

  const toY = (val: number) => y + ((payload.yMax - val) / range) * (props.height ?? 100);
  const openY = toY(open);
  const closeY = toY(close);
  const highY = toY(high);
  const lowY = toY(low);
  const bodyTop = Math.min(openY, closeY);
  const bodyH = Math.max(Math.abs(closeY - openY), 1);
  const midX = x + width / 2;
  const color = isGreen ? "#f59e0b" : "#ff6b6b";

  return (
    <g>
      <line x1={midX} y1={highY} x2={midX} y2={bodyTop} stroke={color} strokeWidth={1} />
      <rect x={x + 1} y={bodyTop} width={Math.max(width - 2, 1)} height={bodyH} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={0.5} />
      <line x1={midX} y1={bodyTop + bodyH} x2={midX} y2={lowY} stroke={color} strokeWidth={1} />
    </g>
  );
}

function StatCard({ label, value, sub, color = "" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase mb-1">{label}</div>
        <div className={`text-xl font-black font-mono ${color || "text-foreground"}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground font-mono mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function Forex() {
  const { prices, currentPrice, isConnected } = useForexWebSocket(SYMBOL);

  const rawPrices = prices.map((p) => p.price);

  const candles = useMemo(
    () => buildCandles(prices.map((p) => ({ price: p.price, time: p.time }))),
    [prices]
  );
  const closePrices = candles.map((c) => c.close);

  const ma20 = useMemo(() => calculateSMA(closePrices, 20), [closePrices]);
  const ma50 = useMemo(() => calculateSMA(closePrices, 50), [closePrices]);
  const ema9 = useMemo(() => calculateEMA(rawPrices, 9), [rawPrices]);
  const macd = useMemo(() => calculateMACD(rawPrices, 12, 26, 9), [rawPrices]);

  const chartData = useMemo(() => {
    if (candles.length < 2) return [];
    const allPrices = candles.flatMap((c) => [c.high, c.low]);
    const yMin = Math.min(...allPrices);
    const yMax = Math.max(...allPrices);
    return candles.slice(-60).map((c, i) => ({
      ...c,
      yMin,
      yMax,
      ma20: ma20[i] ?? null,
      ma50: ma50[i] ?? null,
      label: formatTime(c.time),
    }));
  }, [candles, ma20, ma50]);

  const macdChartData = useMemo(() => {
    if (!macd) return [];
    return macd.histogramHistory.map((h, i) => ({
      h,
      m: macd.macdHistory[i] ?? 0,
      s: macd.signalHistory[i] ?? 0,
    }));
  }, [macd]);

  const priceMin = rawPrices.length > 0 ? Math.min(...rawPrices) : 0;
  const priceMax = rawPrices.length > 0 ? Math.max(...rawPrices) : 0;
  const priceRange = priceMax - priceMin;
  const firstPrice = rawPrices[0] ?? 0;
  const change = currentPrice && firstPrice ? currentPrice - firstPrice : 0;
  const changePct = firstPrice ? (change / firstPrice) * 100 : 0;

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : null;

  const macdColorMap: Record<string, string> = {
    "dark-green": "bg-green-600 text-white",
    "faded-green": "bg-green-400/40 text-green-300",
    "dark-red": "bg-red-600 text-white",
    "faded-red": "bg-red-400/40 text-red-300",
  };

  let trendLabel = "NEUTRAL";
  let trendColor = "text-muted-foreground";
  let TrendIcon = Minus;
  if (change > 0) { trendLabel = "BULLISH"; trendColor = "text-yellow-400"; TrendIcon = TrendingUp; }
  if (change < 0) { trendLabel = "BEARISH"; trendColor = "text-red-400"; TrendIcon = TrendingDown; }

  const ema9Current = ema9.length > 0 ? ema9[ema9.length - 1] : null;
  const aboveEMA9 = currentPrice && ema9Current ? currentPrice > ema9Current : null;

  const priceData = useMemo(
    () => prices.slice(-200).map((p) => ({ v: p.price, t: formatTime(p.time) })),
    [prices]
  );

  return (
    <div className="space-y-4">
      <div className="h-0.5 rounded-full -mb-1" style={{ background: "linear-gradient(to right,#f59e0b,transparent)" }} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-yellow-400" />
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#f59e0b" }}>Gold / USD</h1>
          </div>
          <Badge variant="outline" className="font-mono text-xs gap-1 border-yellow-400/30 text-yellow-400">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-yellow-400 animate-pulse" : "bg-red-500"}`} />
            XAU/USD · {isConnected ? "LIVE" : "Connecting…"}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-2xl font-black text-yellow-400">
              {currentPrice ? currentPrice.toFixed(2) : "---"}
            </div>
            <div className={`font-mono text-xs font-bold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(3)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Session High"
          value={priceMax > 0 ? priceMax.toFixed(2) : "---"}
          color="text-green-400"
        />
        <StatCard
          label="Session Low"
          value={priceMin > 0 ? priceMin.toFixed(2) : "---"}
          color="text-red-400"
        />
        <StatCard
          label="Session Range"
          value={priceRange > 0 ? priceRange.toFixed(2) : "---"}
          sub="pips in session"
        />
        <StatCard
          label="Trend"
          value={trendLabel}
          sub={`EMA9: ${ema9Current ? ema9Current.toFixed(2) : "---"}`}
          color={trendColor}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Charts — 2/3 */}
        <div className="xl:col-span-2 space-y-3">
          {/* Candlestick */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                XAU/USD · 1-Min Candles · MA20 · MA50
              </CardTitle>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> MA20</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block" /> MA50</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400/70 inline-block rounded-sm" /> Bull</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-destructive/70 inline-block rounded-sm" /> Bear</span>
              </div>
            </CardHeader>
            <CardContent className="p-2 h-[260px]">
              {chartData.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                  <BarChart2 className="w-8 h-8 opacity-30" />
                  Collecting XAU/USD tick data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} width={60} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 10, fontFamily: "var(--font-mono)" }}
                      formatter={(val: number, name: string) => [val?.toFixed(2), name]}
                    />
                    <Bar dataKey="high" shape={<CandleBar />} isAnimationActive={false}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.isGreen ? "#f59e0b" : "#ff6b6b"} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="ma20" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="ma50" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Live price line */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Live Price Feed · EMA(9)</CardTitle>
              {ema9Current && (
                <Badge variant="outline" className={`text-[10px] ${aboveEMA9 ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
                  Price {aboveEMA9 ? "above" : "below"} EMA9
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-2 h-[130px]">
              {priceData.length < 2 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={priceData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="t" hide />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} axisLine={false} width={55} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 10 }}
                      formatter={(val: number) => [val?.toFixed(2), "Price"]}
                    />
                    <Line type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* MACD */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">MACD (12, 26, 9)</CardTitle>
              {macd && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${macdColorMap[macd.color] ?? ""}`}>
                  {macd.color.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              )}
            </CardHeader>
            <CardContent className="p-2 h-[110px]">
              {macdChartData.length < 2 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Collecting data...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={macdChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis hide />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 10 }} />
                    <Bar dataKey="h" isAnimationActive={false}>
                      {macdChartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.h > 0
                              ? entry.h >= (macdChartData[i - 1]?.h ?? 0) ? "#16a34a" : "#4ade80"
                              : entry.h <= (macdChartData[i - 1]?.h ?? 0) ? "#dc2626" : "#f87171"
                          }
                        />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="m" stroke="#f59e0b" strokeWidth={1} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="s" stroke="#a78bfa" strokeWidth={1} dot={false} strokeDasharray="3 2" isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Analysis Panel — 1/3 */}
        <div className="space-y-3">
          {/* Current candle analysis */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Current Candle</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {lastCandle ? (
                <>
                  <div className="flex items-center gap-2">
                    {lastCandle.isGreen ? (
                      <TrendingUp className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                    <span className={`font-bold text-lg ${lastCandle.isGreen ? "text-yellow-400" : "text-red-400"}`}>
                      {lastCandle.isGreen ? "BULLISH" : "BEARISH"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    {[
                      { l: "Open", v: lastCandle.open.toFixed(2) },
                      { l: "Close", v: lastCandle.close.toFixed(2) },
                      { l: "High", v: lastCandle.high.toFixed(2), c: "text-green-400" },
                      { l: "Low", v: lastCandle.low.toFixed(2), c: "text-red-400" },
                      { l: "Body", v: Math.abs(lastCandle.close - lastCandle.open).toFixed(2) },
                      { l: "Range", v: (lastCandle.high - lastCandle.low).toFixed(2) },
                    ].map((r) => (
                      <div key={r.l} className="bg-muted rounded p-2">
                        <div className="text-muted-foreground text-[10px]">{r.l}</div>
                        <div className={`font-bold ${r.c ?? ""}`}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                  {prevCandle && (
                    <div className="text-[10px] text-muted-foreground border-t border-border pt-2">
                      Prev candle: <span className={prevCandle.isGreen ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>
                        {prevCandle.isGreen ? "Bull" : "Bear"}
                      </span> · {prevCandle.close.toFixed(2)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground text-sm text-center py-4">Waiting for candle data…</div>
              )}
            </CardContent>
          </Card>

          {/* MACD summary */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">MACD Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {macd ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
                    <div className="bg-muted rounded p-2">
                      <div className="text-muted-foreground">MACD</div>
                      <div className={`font-bold ${macd.macdLine >= 0 ? "text-green-400" : "text-red-400"}`}>{macd.macdLine.toFixed(3)}</div>
                    </div>
                    <div className="bg-muted rounded p-2">
                      <div className="text-muted-foreground">Signal</div>
                      <div className="font-bold">{macd.signalLine.toFixed(3)}</div>
                    </div>
                    <div className="bg-muted rounded p-2">
                      <div className="text-muted-foreground">Hist</div>
                      <div className={`font-bold ${macd.histogram >= 0 ? "text-green-400" : "text-red-400"}`}>{macd.histogram.toFixed(3)}</div>
                    </div>
                  </div>
                  <div className="text-[11px] space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Histogram direction</span>
                      <span className={`font-bold ${macd.histogram > macd.histogramPrev ? "text-green-400" : "text-red-400"}`}>
                        {macd.histogram > macd.histogramPrev ? "Growing ▲" : "Shrinking ▼"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signal cross</span>
                      <span className="font-bold font-mono">
                        {macd.macdLine > macd.signalLine ? "MACD above" : "MACD below"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground text-sm text-center py-2">Collecting data…</div>
              )}
            </CardContent>
          </Card>

          {/* Market overview */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Deriv Live Chart</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              <iframe
                src="https://charts.deriv.com/deriv?symbol=frxXAUUSD&granularity=60&chartType=candles"
                className="w-full border-0"
                style={{ height: "280px" }}
                title="XAU/USD Chart"
                sandbox="allow-scripts allow-same-origin"
              />
            </CardContent>
          </Card>

          {/* Gold fundamentals note */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Gold Key Levels</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 text-[11px]">
              {currentPrice && [
                { label: "Resistance +0.5%", val: currentPrice * 1.005, cls: "text-red-400" },
                { label: "Resistance +0.25%", val: currentPrice * 1.0025, cls: "text-red-300" },
                { label: "Current Price", val: currentPrice, cls: "text-yellow-400 font-black" },
                { label: "Support −0.25%", val: currentPrice * 0.9975, cls: "text-green-300" },
                { label: "Support −0.5%", val: currentPrice * 0.995, cls: "text-green-400" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center border-b border-border/30 pb-1 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={`font-mono font-bold ${row.cls}`}>{row.val.toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
