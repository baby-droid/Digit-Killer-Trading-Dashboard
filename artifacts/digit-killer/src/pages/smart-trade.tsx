import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { useSmartTrade } from "@/hooks/useSmartTrade";
import { useMarket } from "@/lib/market-context";
import { MARKETS } from "@/hooks/useDerivWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Zap, Target, Shuffle, AlertCircle, CheckCircle2 } from "lucide-react";

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

  const toY = (val: number) => y + (payload.yMax - val) / range * (props.height ?? 100);

  const openY = toY(open);
  const closeY = toY(close);
  const highY = toY(high);
  const lowY = toY(low);

  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
  const midX = x + width / 2;
  const color = isGreen ? "#00d1d1" : "#ff6b6b";

  return (
    <g>
      <line x1={midX} y1={highY} x2={midX} y2={bodyTop} stroke={color} strokeWidth={1} />
      <rect x={x + 1} y={bodyTop} width={Math.max(width - 2, 1)} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} />
      <line x1={midX} y1={bodyTop + bodyHeight} x2={midX} y2={lowY} stroke={color} strokeWidth={1} />
    </g>
  );
}

function MacdColorLabel({ color }: { color: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    "dark-green": { label: "Dark Green", cls: "bg-green-600 text-white" },
    "faded-green": { label: "Faded Green", cls: "bg-green-400/40 text-green-300" },
    "dark-red": { label: "Dark Red", cls: "bg-red-600 text-white" },
    "faded-red": { label: "Faded Red", cls: "bg-red-400/40 text-red-300" },
  };
  const item = map[color] ?? { label: color, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${item.cls}`}>{item.label}</span>
  );
}

export default function SmartTrade() {
  const { activeMarket } = useMarket();
  const activeMarketName = MARKETS.find((m) => m.symbol === activeMarket)?.name ?? activeMarket;
  const { digits, isConnected, currentPrice } = useDerivWebSocket(activeMarket);
  const { candles, currentCandle, macd, tsi, ma20, signal, freqs } = useSmartTrade(digits);

  const chartData = useMemo(() => {
    if (candles.length === 0) return [];
    const allPrices = candles.flatMap((c) => [c.high, c.low]);
    const yMin = Math.min(...allPrices);
    const yMax = Math.max(...allPrices);
    return candles.map((c, i) => ({
      ...c,
      yMin,
      yMax,
      ma: ma20[i] ?? null,
      label: formatTime(c.time),
    }));
  }, [candles, ma20]);

  const macdChartData = useMemo(() => {
    if (!macd) return [];
    return macd.histogramHistory.map((h, i) => ({
      h,
      m: macd.macdHistory[i] ?? 0,
      s: macd.signalHistory[i] ?? 0,
    }));
  }, [macd]);

  const tsiChartData = useMemo(() => {
    if (!tsi) return [];
    return tsi.history.map((v) => ({ v }));
  }, [tsi]);

  const tsiVal = tsi?.value ?? 0;
  const tsiStrong = tsiVal >= 0.8;
  const tsiColor = tsiStrong ? "text-green-400" : tsiVal >= 0.6 ? "text-yellow-400" : "text-red-400";

  const signalColor =
    signal && signal.confidence > 0
      ? signal.overUnder === "over"
        ? "border-primary/50 bg-primary/5"
        : "border-orange-500/50 bg-orange-500/5"
      : "border-border";

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Smart Trade</h1>
          <Badge variant="outline" className="font-mono text-xs gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {activeMarketName}
          </Badge>
        </div>
        <div className="font-mono text-xl font-bold text-primary">
          {currentPrice ? currentPrice.toFixed(3) : "---"}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Chart Area — 2/3 width */}
        <div className="xl:col-span-2 space-y-3">
          {/* Candlestick + MA */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                1-Min Candles · MA(20)
              </CardTitle>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" /> MA20</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary/70 inline-block rounded-sm" /> Green</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-destructive/70 inline-block rounded-sm" /> Red</span>
              </div>
            </CardHeader>
            <CardContent className="p-2 h-[240px]">
              {chartData.length < 2 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Collecting 1-min candle data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} width={55} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 10, fontFamily: "var(--font-mono)" }}
                      formatter={(val: number, name: string) => [val?.toFixed(4), name]}
                    />
                    <Bar dataKey="high" shape={<CandleBar />} isAnimationActive={false}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.isGreen ? "#00d1d1" : "#ff6b6b"} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="ma" stroke="#facc15" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* MACD Chart */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">MACD (12, 26, 9)</CardTitle>
              {macd && <MacdColorLabel color={macd.color} />}
            </CardHeader>
            <CardContent className="p-2 h-[120px]">
              {macdChartData.length < 2 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Collecting data...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={macdChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis hide />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 10 }}
                    />
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
                    <Line type="monotone" dataKey="m" stroke="#00d1d1" strokeWidth={1} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="s" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="3 2" isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* TSI Chart */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">TSI — Trend Strength Index</CardTitle>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className={`font-bold ${tsiColor}`}>
                  {tsi ? tsiVal.toFixed(3) : "---"}
                </span>
                {tsi?.isFlat && <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-[10px]">FLAT</Badge>}
                {tsiStrong && <Badge variant="outline" className="text-green-400 border-green-400/30 text-[10px]">STRONG ≥0.8</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-2 h-[100px]">
              {tsiChartData.length < 2 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Collecting data...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={tsiChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis hide />
                    <YAxis domain={[0, 1]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} axisLine={false} width={30} />
                    <ReferenceLine y={0.8} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "0.8", position: "right", fontSize: 9, fill: "#22c55e" }} />
                    <ReferenceLine y={0.9} stroke="#16a34a" strokeDasharray="4 2" label={{ value: "0.9", position: "right", fontSize: 9, fill: "#16a34a" }} />
                    <Line type="monotone" dataKey="v" stroke={tsiStrong ? "#22c55e" : "#94a3b8"} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Signal Panel — 1/3 width */}
        <div className="space-y-3">
          {/* Indicator Summary */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Indicator State</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Candle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Current Candle</span>
                {currentCandle ? (
                  currentCandle.isGreen ? (
                    <div className="flex items-center gap-1 text-primary text-xs font-bold">
                      <TrendingUp className="w-3 h-3" /> GREEN
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-destructive text-xs font-bold">
                      <TrendingDown className="w-3 h-3" /> RED
                    </div>
                  )
                ) : (
                  <span className="text-muted-foreground text-xs">---</span>
                )}
              </div>

              {/* MACD */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">MACD Color</span>
                {macd ? <MacdColorLabel color={macd.color} /> : <span className="text-muted-foreground text-xs">---</span>}
              </div>
              {macd && (
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="bg-muted rounded p-1">
                    <div className="text-muted-foreground">Line</div>
                    <div className="font-mono font-bold">{macd.macdLine.toFixed(4)}</div>
                  </div>
                  <div className="bg-muted rounded p-1">
                    <div className="text-muted-foreground">Signal</div>
                    <div className="font-mono font-bold">{macd.signalLine.toFixed(4)}</div>
                  </div>
                  <div className="bg-muted rounded p-1">
                    <div className="text-muted-foreground">Hist</div>
                    <div className={`font-mono font-bold ${macd.histogram >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {macd.histogram.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}

              {/* TSI */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">TSI Value</span>
                <span className={`font-mono font-bold text-sm ${tsiColor}`}>
                  {tsi ? tsiVal.toFixed(3) : "---"}
                </span>
              </div>
              {tsi && (
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${tsiStrong ? "bg-green-500" : tsiVal >= 0.6 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${tsiVal * 100}%` }}
                  />
                </div>
              )}
              <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                <span>0</span>
                <span className="text-yellow-500">0.8</span>
                <span className="text-green-500">0.9</span>
                <span>1.0</span>
              </div>
            </CardContent>
          </Card>

          {/* Main Signal */}
          <Card className={`border-2 transition-all ${signalColor}`}>
            <CardHeader className="py-2 px-4 border-b border-border flex flex-row items-center gap-2">
              {signal && signal.confidence > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
              )}
              <CardTitle className="text-xs font-medium uppercase">AI Signal</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {signal ? (
                <>
                  <div className="text-center">
                    <div className={`text-xl font-black font-mono ${signal.confidence > 0 ? (signal.overUnder === "over" ? "text-primary" : "text-orange-400") : "text-muted-foreground"}`}>
                      {signal.prediction}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{signal.scenario}</div>
                  </div>

                  {signal.confidence > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] text-muted-foreground uppercase w-20 shrink-0">Confidence</div>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${signal.confidence}%` }}
                          />
                        </div>
                        <div className="font-mono text-xs font-bold text-primary">{signal.confidence}%</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-muted rounded p-2">
                          <div className="text-muted-foreground mb-1">Entry Digits</div>
                          <div className="font-mono font-bold text-primary">
                            {signal.entryDigit.length > 0 ? signal.entryDigit.join(", ") : "Any"}
                          </div>
                        </div>
                        <div className="bg-muted rounded p-2">
                          <div className="text-muted-foreground mb-1 flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> Duration</div>
                          <div className="font-mono font-bold">{signal.ticks}</div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-2">Waiting for data...</div>
              )}
            </CardContent>
          </Card>

          {/* Digit Signals */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Digit Strategy</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Match */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase">Match Digits</span>
                  <span className="text-[10px] text-muted-foreground">(Most frequent)</span>
                </div>
                <div className="flex gap-2">
                  {signal?.matchDigits.map((d) => (
                    <div key={d} className="flex-1 bg-primary/20 border border-primary/30 rounded p-2 text-center">
                      <div className="font-mono text-xl font-black text-primary">{d}</div>
                      <div className="font-mono text-[10px] text-primary/70">{freqs[d]?.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Differ */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shuffle className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-xs font-bold text-destructive uppercase">Differ Digits</span>
                  <span className="text-[10px] text-muted-foreground">(Least frequent)</span>
                </div>
                <div className="flex gap-2">
                  {signal?.differDigits.map((d) => (
                    <div key={d} className="flex-1 bg-destructive/10 border border-destructive/20 rounded p-2 text-center">
                      <div className="font-mono text-xl font-black text-destructive">{d}</div>
                      <div className="font-mono text-[10px] text-destructive/70">{freqs[d]?.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Freq mini bars */}
              <div>
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Live Digit Frequency (0–9)</div>
                <div className="flex h-12 gap-0.5 items-end">
                  {freqs.map((f, i) => {
                    const isMatch = signal?.matchDigits.includes(i);
                    const isDiffer = signal?.differDigits.includes(i);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className={`w-full rounded-t-sm transition-all duration-500 ${isMatch ? "bg-primary" : isDiffer ? "bg-destructive" : "bg-muted-foreground/30"}`}
                          style={{ height: `${Math.max(f * 3.5, 4)}%` }}
                          title={`${i}: ${f.toFixed(1)}%`}
                        />
                        <span className="text-[8px] text-muted-foreground font-mono">{i}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strategy Rules Quick Ref */}
          <Card className="bg-card border-border">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Signal Rules Reference</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1.5 text-[10px]">
              {[
                { cond: "Green + Faded Green + TSI≥0.8", pred: "Over 4/5", col: "text-primary" },
                { cond: "Red + Faded Green + TSI≥0.8", pred: "Over 5", col: "text-primary" },
                { cond: "Red + Faded Red + TSI≥0.8", pred: "Over 4", col: "text-primary" },
                { cond: "TSI Flat + Dark Red + Red", pred: "Over 6", col: "text-primary" },
                { cond: "TSI Flat + Dark Green + Green", pred: "Over 4/5", col: "text-primary" },
                { cond: "Green + Dark Green + TSI≥0.8", pred: "Under 5", col: "text-orange-400" },
                { cond: "Faded ± MACD + TSI 0.8/0.9", pred: "Under 3", col: "text-orange-400" },
              ].map((r, i) => (
                <div key={i} className="flex justify-between gap-2 py-0.5 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground leading-tight">{r.cond}</span>
                  <span className={`font-bold shrink-0 ${r.col}`}>{r.pred}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
