import { useDerivMultiMarket } from "@/hooks/useDerivMultiMarket";
import { MARKETS, MARKETS_BY_CATEGORY, CATEGORY_LABELS, MarketCategory } from "@/hooks/useDerivWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { Brain, Search, Zap, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STRATEGIES = [
  { key: "over0", label: "Over 0", description: "Digit last > 0", match: (f: number[]) => f[0] < 10 },
  { key: "over1", label: "Over 1", description: "Digits 0–1 both < 10%", match: (f: number[]) => f[0] < 10 && f[1] < 10 },
  { key: "over2", label: "Over 2", description: "Digits 0–2 all < 10%", match: (f: number[]) => f[0] < 10 && f[1] < 10 && f[2] < 10 },
  { key: "over3", label: "Over 3", description: "Digits 0–3 all < 10%", match: (f: number[]) => f[0] < 10 && f[1] < 10 && f[2] < 10 && f[3] < 10 },
  { key: "over4", label: "Over 4", description: "Digits 0–4 all < 10%", match: (f: number[]) => [0,1,2,3,4].every(d => f[d] < 10) },
  { key: "over5", label: "Over 5", description: "High-digit (5–9) > 55%", match: (f: number[]) => [5,6,7,8,9].reduce((s,d)=>s+f[d],0) > 55 },
  { key: "over6", label: "Over 6", description: "Digits 7–9 dominant", match: (f: number[]) => [7,8,9].reduce((s,d)=>s+f[d],0) > 35 },
  { key: "over7", label: "Over 7", description: "Digits 8–9 > 22%", match: (f: number[]) => f[8]+f[9] > 22 },
  { key: "over8", label: "Over 8", description: "Digit 9 > 14%", match: (f: number[]) => f[9] > 14 },
  { key: "under1", label: "Under 1", description: "Digit 0 < 8%", match: (f: number[]) => f[0] < 8 },
  { key: "under2", label: "Under 2", description: "Digits 0–1 low, digit 2 present", match: (f: number[]) => f[0] < 10 && f[1] < 8 },
  { key: "under3", label: "Under 3", description: "Digits 3–9 all < 10%", match: (f: number[]) => [3,4,5,6,7,8,9].every(d => f[d] < 15) },
  { key: "under4", label: "Under 4", description: "Digits 4–9 all < 14%", match: (f: number[]) => [4,5,6,7,8,9].every(d => f[d] < 14) },
  { key: "under5", label: "Under 5", description: "Low-digit (0–4) > 55%", match: (f: number[]) => [0,1,2,3,4].reduce((s,d)=>s+f[d],0) > 55 },
  { key: "under6", label: "Under 6", description: "Digits 0–5 dominant", match: (f: number[]) => [0,1,2,3,4,5].reduce((s,d)=>s+f[d],0) > 62 },
  { key: "under7", label: "Under 7", description: "Digits 7–9 < 22%", match: (f: number[]) => f[7]+f[8]+f[9] < 22 },
  { key: "under8", label: "Under 8", description: "Digits 8–9 < 16%", match: (f: number[]) => f[8]+f[9] < 16 },
  { key: "under9", label: "Under 9", description: "Digit 9 < 8%", match: (f: number[]) => f[9] < 8 },
  { key: "even",   label: "Even",    description: "Even digits (0,2,4,6,8) > 55%", match: (f: number[]) => [0,2,4,6,8].reduce((s,d)=>s+f[d],0) > 55 },
  { key: "odd",    label: "Odd",     description: "Odd digits (1,3,5,7,9) > 55%",  match: (f: number[]) => [1,3,5,7,9].reduce((s,d)=>s+f[d],0) > 55 },
  { key: "match",  label: "Matches", description: "Any digit > 13%",               match: (f: number[]) => Math.max(...f) > 13 },
  { key: "differ", label: "Differs", description: "Any digit < 7%",                match: (f: number[]) => Math.min(...f) < 7 },
];

function entryInstruction(key: string, freqs: number[], lastDigit: number | null): { text: string; enterNow: boolean } {
  const isOver  = key.startsWith("over");
  const isUnder = key.startsWith("under");
  const n       = parseInt(key.replace(/\D/g, ""));

  if (isOver) {
    const enterNow = lastDigit !== null && lastDigit <= n;
    return { text: enterNow ? `✓ Enter NOW — last digit ${lastDigit} ≤ ${n}` : `Wait for digit ≤ ${n}`, enterNow };
  }
  if (isUnder) {
    const enterNow = lastDigit !== null && lastDigit >= n;
    return { text: enterNow ? `✓ Enter NOW — last digit ${lastDigit} ≥ ${n}` : `Wait for digit ≥ ${n}`, enterNow };
  }
  if (key === "even") {
    const enterNow = lastDigit !== null && lastDigit % 2 !== 0;
    return { text: enterNow ? "✓ Enter NOW (current digit is odd)" : "Wait for odd digit to appear", enterNow };
  }
  if (key === "odd") {
    const enterNow = lastDigit !== null && lastDigit % 2 === 0;
    return { text: enterNow ? "✓ Enter NOW (current digit is even)" : "Wait for even digit to appear", enterNow };
  }
  if (key === "match") {
    const hotDigit = freqs.indexOf(Math.max(...freqs));
    const enterNow = lastDigit !== null && lastDigit !== hotDigit;
    return { text: enterNow ? `✓ Enter NOW — match digit ${hotDigit} next tick` : `Wait for digit before ${hotDigit}`, enterNow };
  }
  if (key === "differ") {
    const coldDigit = freqs.indexOf(Math.min(...freqs));
    const enterNow = lastDigit !== null && lastDigit === coldDigit;
    return { text: enterNow ? `✓ Differ ${coldDigit} — enter NOW` : `Wait — differ digit ${coldDigit}`, enterNow };
  }
  return { text: "Analyse", enterNow: false };
}

interface ScanResult {
  symbol: string;
  name: string;
  strategyKey: string;
  strategyLabel: string;
  confidence: number;
  entryText: string;
  enterNow: boolean;
  lastDigit: number | null;
  frequencies: number[];
  ticks: string;
}

export default function Scanner() {
  const marketsData = useDerivMultiMarket();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | MarketCategory>("all");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);

  const normalizedQuery = query.trim().toLowerCase();

  const matchedStrategies = useMemo(() => {
    if (!normalizedQuery) return STRATEGIES;
    return STRATEGIES.filter((s) =>
      s.label.toLowerCase().includes(normalizedQuery) ||
      s.description.toLowerCase().includes(normalizedQuery) ||
      s.key.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const runSearch = () => {
    if (matchedStrategies.length === 0) return;
    setIsScanning(true);
    setTimeout(() => {
      const results: ScanResult[] = [];
      const targetStrategies = normalizedQuery ? matchedStrategies : STRATEGIES;

      Object.entries(marketsData).forEach(([symbol, data]) => {
        const market = MARKETS.find((m) => m.symbol === symbol);
        if (!market || data.digits.length < 20) return;
        if (activeCategory !== "all" && market.category !== activeCategory) return;

        const f = data.frequencies;

        targetStrategies.forEach((strat) => {
          if (strat.match(f)) {
            const entry = entryInstruction(strat.key, f, data.lastDigit);
            const hotDigit = f.indexOf(Math.max(...f));
            const coldDigit = f.indexOf(Math.min(...f));
            const conf = strat.key.startsWith("over") ?
              Math.min(92, 55 + [5,6,7,8,9].reduce((s,d)=>s+f[d],0) - 50) :
              strat.key.startsWith("under") ?
              Math.min(92, 55 + [0,1,2,3,4].reduce((s,d)=>s+f[d],0) - 50) :
              strat.key === "match" ? Math.min(88, 55 + (Math.max(...f) - 10) * 2) :
              strat.key === "differ" ? Math.min(85, 55 + (10 - Math.min(...f)) * 2) :
              72;

            results.push({
              symbol,
              name: market.name,
              strategyKey: strat.key,
              strategyLabel: strat.label,
              confidence: Math.round(conf),
              entryText: entry.text,
              enterNow: entry.enterNow,
              lastDigit: data.lastDigit,
              frequencies: f,
              ticks: "1 tick reference",
            });
          }
        });
      });

      setScanResults(results.sort((a, b) => (b.enterNow ? 1 : 0) - (a.enterNow ? 1 : 0) || b.confidence - a.confidence));
      setIsScanning(false);
    }, 600);
  };

  const enterNowCount = scanResults.filter((r) => r.enterNow).length;

  return (
    <div className="space-y-5">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: "linear-gradient(to right,#a855f7,transparent)" }} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "#a855f7" }}>
            <Brain className="w-6 h-6" style={{ color: "#a855f7" }} /> Market Scanner
          </h1>
          <p className="text-muted-foreground text-sm">Search any strategy — see which markets qualify right now</p>
        </div>
        {enterNowCount > 0 && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse text-sm px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 mr-1" /> {enterNowCount} ENTER NOW
          </Badge>
        )}
      </div>

      {/* Search + category filter */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder='Search strategy… e.g. "over 2", "match", "even", "under 7"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border text-foreground rounded-md text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={runSearch}
              disabled={isScanning}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isScanning ? <Activity className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {isScanning ? "Scanning…" : "SCAN"}
            </button>
          </div>

          {/* Strategy pills */}
          <div className="flex flex-wrap gap-1.5">
            {STRATEGIES.map((s) => (
              <button
                key={s.key}
                onClick={() => { setQuery(s.label); }}
                className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                  normalizedQuery && (s.label.toLowerCase().includes(normalizedQuery) || s.key.toLowerCase().includes(normalizedQuery))
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:border-primary/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
            {(["all", ...Object.keys(MARKETS_BY_CATEGORY)] as ("all" | MarketCategory)[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {cat === "all" ? "All Markets" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {scanResults.length === 0 && !isScanning && (
        <div className="flex flex-col items-center py-16 text-muted-foreground space-y-2">
          <Brain className="w-10 h-10 opacity-20" />
          <p className="font-bold text-sm">Search a strategy and click SCAN</p>
          <p className="text-xs">e.g. type "over 2" to find all markets where digits 0–2 are under 10%</p>
        </div>
      )}

      {scanResults.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground font-mono">{scanResults.length} results</p>
            <p className="text-xs text-green-400 font-bold">{enterNowCount} ready to enter now</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scanResults.map((r, idx) => (
              <Card
                key={`${r.symbol}-${r.strategyKey}-${idx}`}
                className={`border-2 transition-all ${r.enterNow ? "border-primary shadow-[0_0_20px_rgba(0,209,209,0.15)]" : "border-border hover:border-border/80"}`}
              >
                {r.enterNow && <div className="h-0.5 bg-primary w-full" />}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground font-mono">{r.symbol}</div>
                      <div className="text-lg font-black">{r.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge className={`text-xs ${r.enterNow ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground"}`}>
                        {r.strategyLabel}
                      </Badge>
                      <div className="text-2xl font-black text-primary font-mono mt-1">{r.confidence}%</div>
                    </div>
                  </div>

                  {/* Freq mini-bars */}
                  <div className="flex h-6 gap-0.5 items-end bg-muted/40 rounded p-1">
                    {r.frequencies.map((f, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-sm ${i === r.frequencies.indexOf(Math.max(...r.frequencies)) ? "bg-green-500" : i === r.frequencies.indexOf(Math.min(...r.frequencies)) ? "bg-red-500" : "bg-primary/30"}`}
                        style={{ height: `${Math.max(f * 2.5, 10)}%` }}
                        title={`${i}: ${f.toFixed(1)}%`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground font-mono px-1">
                    {Array.from({length:10},(_,i)=>i).map(i=><span key={i}>{i}</span>)}
                  </div>

                  <div className={`text-xs font-bold rounded p-2 ${r.enterNow ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-muted/50 text-muted-foreground"}`}>
                    {r.enterNow && <Zap className="w-3 h-3 inline mr-1" />}
                    {r.entryText}
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-muted-foreground">Last digit: <strong className="text-foreground">{r.lastDigit ?? "—"}</strong></span>
                    <span className="text-muted-foreground">Ref: {r.ticks}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Live market overview */}
      <div>
        <h2 className="text-sm font-bold uppercase text-muted-foreground mb-3">All Markets — Live Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {MARKETS.map((market) => {
            const data = marketsData[market.symbol];
            if (!data) return null;
            const maxFreq = Math.max(...data.frequencies);
            const minFreq = Math.min(...data.frequencies);
            return (
              <Card key={market.symbol} className="bg-card border-border hover:border-primary/40 transition-colors overflow-hidden">
                <CardContent className="p-0">
                  <div className="px-3 py-2 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{market.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{data.price?.toFixed(2) ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-2xl font-black ${data.lastDigit !== null && data.lastDigit % 2 === 0 ? "text-primary" : "text-destructive"}`}>
                        {data.lastDigit ?? "—"}
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ml-auto ${data.isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                    </div>
                  </div>
                  <div className="p-2">
                    <TooltipProvider>
                      <div className="grid grid-cols-10 gap-0.5 h-10 items-end">
                        {data.frequencies.map((freq, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <div className="relative flex flex-col items-center h-full justify-end cursor-default">
                                <div
                                  className={`w-full rounded-t-sm transition-all ${freq === maxFreq ? "bg-green-500" : freq === minFreq ? "bg-red-500" : "bg-primary/30"}`}
                                  style={{ height: `${Math.max(10, freq * 3)}%` }}
                                />
                                <span className="text-[7px] mt-0.5 font-mono text-muted-foreground">{i}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px] font-mono p-1 px-2">
                              {i}: {freq.toFixed(1)}%
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                    <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground">
                      <span className="text-green-400 font-bold">HOT: {data.frequencies.indexOf(maxFreq)}</span>
                      <span className="text-red-400 font-bold">COLD: {data.frequencies.indexOf(minFreq)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
