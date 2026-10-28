import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Check, CircleHelp, Radio, ScanSearch } from "lucide-react";
import { useUnderPatternScanner, type UnderPatternScanCandidate } from "@/hooks/useUnderPatternScanner";
import {
  refreshMarketCatalog,
  refreshMarketHistory,
  useDerivMarketCatalog,
} from "@/hooks/useDerivWebSocket";
import { classifyDigit, type PatternPerformance, type UnderBarrierAnalysis } from "@/lib/under-pattern-analysis";
import { UnderTradeControls } from "@/components/under-trade-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WINDOWS = [100, 50, 20, 10] as const;
const ENTRY_ALERT_MS = 30_000;
const MIN_ENTRY_SCORE = 95;
const MIN_ENTRY_SAMPLES = 8;

type EntryAlertState = {
  key: string;
  candidate: UnderPatternScanCandidate;
  expiresAt: number;
};

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function MarketStatus({
  connected,
  historyLoaded,
  historyPhase,
  historyCount,
  error,
}: {
  connected: boolean;
  historyLoaded: boolean;
  historyPhase: string;
  historyCount: number;
  error: string | null;
}) {
  if (error) {
    return (
      <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 text-amber-900">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" /> {error}
      </Badge>
    );
  }
  if (!connected) {
    return (
      <Badge variant="outline" className="gap-1.5 border-rose-300 bg-rose-50 text-rose-800">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-600" /> Feed disconnected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`gap-1.5 ${historyLoaded && historyCount >= 1000 ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${historyLoaded && historyCount >= 1000 ? "bg-emerald-600" : "bg-amber-600"}`} />
      {historyLoaded
        ? `${historyCount.toLocaleString()} / 1,000 history ticks`
        : historyPhase === "queued"
          ? "Queued for history"
          : historyPhase === "loading"
            ? "Requesting tick history"
            : "Checking Deriv symbols"}
    </Badge>
  );
}

function entryCandidateKey(candidate: UnderPatternScanCandidate) {
  return `${candidate.market.symbol}:${candidate.barrier}:${candidate.pattern.pattern}`;
}

function isHighScoreEntry(candidate: UnderPatternScanCandidate) {
  const currentPattern = candidate.analysis.currentPattern;
  return Boolean(
    candidate.marketData.isConnected
    && candidate.marketData.historyLoaded
    && candidate.marketData.historyCount >= 1000
    && candidate.pattern.meetsSampleGate
    && candidate.pattern.sampleCount >= MIN_ENTRY_SAMPLES
    && (candidate.pattern.averagePerformance ?? 0) >= MIN_ENTRY_SCORE
    && currentPattern?.pattern === candidate.pattern.pattern,
  );
}

function EnterNowAlert({ alert, now }: { alert: { candidate: UnderPatternScanCandidate; expiresAt: number }; now: number }) {
  const { candidate } = alert;
  const samples = candidate.pattern.windowResults.reduce((sum, result) => sum + result.samples, 0);
  const primaryHits = candidate.pattern.windowResults.reduce((sum, result) => sum + result.primaryHits, 0);
  const recoveryHits = candidate.pattern.windowResults.reduce((sum, result) => sum + result.recoveryHits, 0);
  const primaryMisses = Math.max(0, samples - primaryHits);
  const recoveryRate = primaryMisses
    ? (recoveryHits / primaryMisses) * 100
    : null;
  const remaining = Math.max(0, alert.expiresAt - now);
  const secondsLeft = Math.ceil(remaining / 1000);
  const progress = Math.max(0, Math.min(100, (remaining / ENTRY_ALERT_MS) * 100));

  return (
    <aside
      role="alert"
      aria-live="assertive"
      aria-label={`Enter now alert for Under ${candidate.barrier}`}
      className="under-entry-alert fixed right-3 top-3 z-[100] w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-2xl border-2 border-green-600 bg-[#8df0a8] text-black shadow-2xl shadow-green-950/30 sm:right-5 sm:top-5"
      data-testid="under-entry-notification"
    >
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-black/20 bg-green-300 text-black">
          <Check className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">High-score entry window</span>
            <span className="rounded-full bg-black px-2 py-0.5 text-[9px] font-black uppercase text-[#8df0a8]">
              ENTER NOW · UNDER {candidate.barrier}
            </span>
          </div>
          <h2 className="mt-1 text-base font-black leading-tight sm:text-lg">
            {candidate.market.name} <span className="font-mono text-xs font-bold">({candidate.market.symbol})</span>
          </h2>
          <p className="mt-2 text-xs font-semibold">
            Current pattern: <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-sm font-black">{candidate.pattern.pattern}</code>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-black/10 bg-white/50 p-2">
              <p className="text-[9px] font-black uppercase tracking-wide">Historical score</p>
              <p className="mt-0.5 text-lg font-black tabular-nums">{percent(candidate.pattern.averagePerformance)}</p>
              <p className="text-[9px] font-medium">Pattern rank, not win probability</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/50 p-2">
              <p className="text-[9px] font-black uppercase tracking-wide">Recovery after a primary miss</p>
              <p className="mt-0.5 text-lg font-black tabular-nums">{percent(recoveryRate)}</p>
              <p className="text-[9px] font-medium">{recoveryHits} of {primaryMisses} historical misses</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold leading-relaxed">
            Recovery means at least one Under digit in follow-up ticks 6–8 after the first 3-tick test misses. It is not guaranteed profit or a reason to increase stake.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-black">
            <span>Next scan in {secondsLeft}s</span>
            <span>{candidate.pattern.sampleCount} overlapping history samples</span>
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-black/15">
        <div className="h-full bg-green-700 transition-[width] duration-200 ease-linear" style={{ width: `${progress}%` }} />
      </div>
      <style>{`
        @keyframes under-entry-glow {
          0%, 100% { box-shadow: 0 10px 28px rgba(7, 45, 19, .22), 0 0 0 0 rgba(34, 197, 94, .28); }
          50% { box-shadow: 0 14px 34px rgba(7, 45, 19, .3), 0 0 0 8px rgba(34, 197, 94, .14); }
        }
        .under-entry-alert { animation: under-entry-glow 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .under-entry-alert { animation: none; }
        }
      `}</style>
    </aside>
  );
}

function DigitHistory({ digits, lastDigit }: { digits: number[]; lastDigit: number | null }) {
  const recent = digits.slice(-100);
  const counts = new Array(10).fill(0);
  recent.forEach((digit) => { counts[digit]++; });
  const percentages = counts.map((count) => recent.length ? (count / recent.length) * 100 : 0);
  const rankedValues = [...new Set(percentages)].sort((left, right) => right - left);
  const highest = rankedValues[0];
  const secondHighest = rankedValues.length >= 3 ? rankedValues[1] : null;
  const secondLowest = rankedValues.length >= 4 ? rankedValues[rankedValues.length - 2] : null;
  const lowest = rankedValues.length >= 2 ? rankedValues[rankedValues.length - 1] : null;

  const rankStyle = (digit: number) => {
    const value = percentages[digit];
    if (value === highest) return { background: "#15803d", border: "#22c55e", color: "#ffffff" };
    if (secondHighest !== null && value === secondHighest) return { background: "#1e3a8a", border: "#3b82f6", color: "#ffffff" };
    if (secondLowest !== null && value === secondLowest) return { background: "#713f12", border: "#eab308", color: "#ffffff" };
    if (lowest !== null && value === lowest) return { background: "#7f1d1d", border: "#ef4444", color: "#ffffff" };
    return { background: "#ffffff", border: "#d1d5db", color: "#1f2937" };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Digit circles</h2>
          <p className="text-xs text-slate-500">Frequency in the last {recent.length} ticks · outlined digit is current</p>
        </div>
        <span className="font-mono text-xs text-slate-500">0–9</span>
      </div>
      <div className="grid grid-cols-5 items-end gap-x-2 gap-y-4 sm:grid-cols-10 sm:gap-x-1.5" aria-label={`Digit frequencies across the last ${recent.length} ticks`}>
        {Array.from({ length: 10 }, (_, digit) => {
          const current = lastDigit === digit;
          const rank = rankStyle(digit);
          const size = Math.max(46, Math.min(72, 50 + (percentages[digit] - 10) * 2.8));
          return (
            <div key={digit} className="flex min-w-0 flex-col items-center gap-1.5">
              <div className="flex h-3 items-end justify-center">
                {current && <span className="h-0 w-0 border-x-[6px] border-x-transparent border-t-[9px] border-t-violet-600" />}
              </div>
              <div
                className={`flex items-center justify-center rounded-full border-2 font-mono text-lg font-semibold tabular-nums shadow-sm ${current ? "ring-2 ring-teal-600 ring-offset-2" : ""}`}
                style={{
                  width: size,
                  height: size,
                  backgroundColor: rank.background,
                  borderColor: rank.border,
                  color: rank.color,
                }}
                title={`Digit ${digit}: ${percentages[digit].toFixed(1)}%`}
              >
                {digit}
              </div>
              <span className="font-mono text-[10px] font-semibold text-slate-600">{percentages[digit].toFixed(1)}%</span>
            </div>
          );
        })}
        {!recent.length && <div className="col-span-5 text-center text-xs text-slate-500 sm:col-span-10">Waiting for live ticks</div>}
      </div>
    </div>
  );
}

function TokenStream({ digits, barrier }: { digits: number[]; barrier: 4 | 5 }) {
  const tokens = digits.slice(-100).map((digit) => classifyDigit(digit, barrier));
  const styles = {
    o: "border-rose-200 bg-rose-50 text-rose-700",
    u: "border-teal-200 bg-teal-50 text-teal-800",
    "=": "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Under {barrier} stream</p>
        <span className="text-[10px] text-slate-400">latest right</span>
      </div>
      <div className="flex flex-wrap gap-1" aria-label={`Latest ${tokens.length} over, under and equal classifications for barrier ${barrier}`}>
        {tokens.length ? tokens.map((token, index) => (
          <span key={`${index}-${token}`} className={`flex h-6 w-6 items-center justify-center rounded border font-mono text-[10px] font-bold ${styles[token]}`} title={`${token === "o" ? "Over" : token === "u" ? "Under" : "Equal"} barrier ${barrier}`}>
            {token.toUpperCase()}
          </span>
        )) : <span className="text-xs text-slate-400">Waiting for ticks</span>}
      </div>
    </div>
  );
}

function RateCell({ result }: { result: PatternPerformance["windowResults"][number] | undefined }) {
  if (!result) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-[90px] space-y-1 font-mono text-[11px] leading-tight tabular-nums">
      <div className="font-semibold text-slate-800">{percent(result.combinedRate)}</div>
      <div className="text-slate-500">{result.samples} samples</div>
      <div className="text-teal-800">P {result.primaryHits} <span className="text-slate-400">({percent(result.primaryRate)})</span></div>
      <div className="text-indigo-700">R {result.recoveryHits} <span className="text-slate-400">({percent(result.recoveryRate)})</span></div>
      <div className="text-rose-700">M {result.misses}</div>
    </div>
  );
}

function PatternPanel({ barrier, analysis, selected, isFeedLive, historyReady }: {
  barrier: 4 | 5;
  analysis: UnderBarrierAnalysis | undefined;
  selected: boolean;
  isFeedLive: boolean;
  historyReady: boolean;
}) {
  const current = analysis?.currentPattern;
  const best = analysis?.bestPattern;
  const currentMatchesBest = Boolean(best && current?.pattern === best.pattern);
  const highScore = Boolean(
    best?.meetsSampleGate
    && best.sampleCount >= MIN_ENTRY_SAMPLES
    && (best.averagePerformance ?? 0) >= MIN_ENTRY_SCORE,
  );
  const entryReady = Boolean(isFeedLive && historyReady && highScore && currentMatchesBest);

  return (
    <Card className={`overflow-hidden border-slate-200 bg-[#fffefa] shadow-sm ${selected ? "ring-2 ring-teal-700/70" : ""}`}>
      <CardHeader className={`border-b px-4 py-4 sm:px-5 ${barrier === 4 ? "bg-[#f0f6f4]" : "bg-[#f4f3ee]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${barrier === 4 ? "bg-teal-700" : "bg-amber-600"}`} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Barrier analysis</span>
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">Under {barrier}</CardTitle>
          </div>
          {selected && <Badge className="bg-teal-800 text-white hover:bg-teal-800">Scan selection</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className={`rounded-lg border p-3 ${entryReady ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-start gap-2.5">
            {entryReady ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" /> : <Activity className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                {entryReady ? "High-score pattern just completed" : "Live pattern status"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {best
                  ? entryReady
                    ? <><code className="rounded bg-white/80 px-1.5 py-0.5 font-mono font-semibold text-teal-900">{best.pattern}</code> matched the latest ticks. The next tick is an analysis entry window, not an execution order.</>
                    : !isFeedLive
                      ? "Feed is disconnected; live entry timing is unavailable."
                      : !historyReady
                        ? "Wait for a complete 1,000-tick history before treating a live pattern as entry-ready."
                        : currentMatchesBest && !best.meetsSampleGate
                          ? <>Pattern <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold">{best.pattern}</code> matched, but its sample gate is not met. Observe only.</>
                          : currentMatchesBest && !highScore
                            ? <>Pattern <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold">{best.pattern}</code> matched, but its history score or sample count is below the enter-now threshold.</>
                    : current
                      ? <>Current sequence <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold">{current.pattern}</code> is present; it is not the best historical pattern <code className="font-mono font-semibold">{best.pattern}</code>.</>
                      : <>Best historical pattern <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold">{best.pattern}</code> has not just completed.</>
                  : "No historical pattern outcomes available yet."}
              </p>
            </div>
          </div>
          {best && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200/80 pt-3 sm:grid-cols-4">
              <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Best historical</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{best.pattern}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Avg. window rate</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{percent(best.averagePerformance)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Window samples*</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{best.sampleCount}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Entry threshold</p><p className={`mt-0.5 text-xs font-semibold ${highScore ? "text-teal-800" : "text-amber-800"}`}>{highScore ? "Met" : "Needs ≥95 score + 8 samples"}</p></div>
            </div>
          )}
          {best && !best.meetsSampleGate && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />Insufficient sample breadth; historical ranking is not sample-qualified.</p>
          )}
        </div>

        {!analysis?.patterns.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-7 text-center">
            <CircleHelp className="mx-auto mb-2 h-5 w-5 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Insufficient history</p>
            <p className="mt-1 text-xs text-slate-500">Pattern outcomes appear after the live feed has enough settled ticks.</p>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Pattern performance</h3>
                <p className="text-[11px] text-slate-500">Observed outcomes by rolling history window · windows overlap · not forecasts</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                <span><b className="text-teal-800">P</b> primary hits</span>
                <span><b className="text-indigo-700">R</b> recovery hits after primary miss</span>
                <span><b className="text-rose-700">M</b> misses</span>
              </div>
            </div>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[660px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="sticky left-0 z-10 bg-slate-50 py-2 pl-2 pr-3 font-semibold">Pattern</th>
                    {WINDOWS.map((window) => <th key={window} className="px-2 py-2 font-semibold">{window} ticks</th>)}
                  </tr>
                </thead>
                <tbody>
                  {analysis.patterns.map((pattern) => (
                    <tr key={pattern.pattern} className={`border-b border-slate-100 align-top ${pattern.pattern === best?.pattern ? "bg-teal-50/70" : "hover:bg-slate-50"}`}>
                      <th scope="row" className={`sticky left-0 z-10 py-2.5 pl-2 pr-3 font-normal ${pattern.pattern === best?.pattern ? "bg-[#eff8f5]" : "bg-[#fffefa]"}`}>
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-xs font-semibold text-slate-900">{pattern.pattern}</code>
                          {pattern.pattern === best?.pattern && <span className="rounded bg-teal-800 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">Best</span>}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">{pattern.sampleCount} window samples*</div>
                        {!pattern.meetsSampleGate && <div className="mt-0.5 text-[9px] font-medium text-amber-800">Low sample count</div>}
                      </th>
                      {WINDOWS.map((window) => (
                        <td key={window} className="px-2 py-2.5"><RateCell result={pattern.windowResults.find((item) => item.window === window)} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
          Primary = exactly one or two digits below {barrier} in the next 3 ticks. Recovery = if primary fails, at least one under digit across follow-up ticks 6–8. *Window sample counts overlap and are not independent observations. Rates are historical observations only.
        </div>
      </CardContent>
    </Card>
  );
}

export default function Under4Under5Analyser() {
  const { markets, marketsData, analyses, scanCandidates } = useUnderPatternScanner();
  const marketCatalog = useDerivMarketCatalog();
  const [selectedSymbol, setSelectedSymbol] = useState(markets[0]?.symbol ?? "");
  const [scanSelection, setScanSelection] = useState<UnderPatternScanCandidate | null>(null);
  const [scanAttempted, setScanAttempted] = useState(false);
  const [entryAlert, setEntryAlert] = useState<EntryAlertState | null>(null);
  const [dismissedPatternKeys, setDismissedPatternKeys] = useState<Set<string>>(() => new Set());
  const [alertNow, setAlertNow] = useState(Date.now());
  const market = markets.find((item) => item.symbol === selectedSymbol) ?? markets[0];
  const data = market ? marketsData[market.symbol] : undefined;
  const analysis = market ? analyses[market.symbol] : undefined;
  const visibleDigits = useMemo(() => data?.digits.slice(-100) ?? [], [data?.digits]);
  const hasHistory = Boolean(data?.historyCount);
  const highScoreEntries = useMemo(
    () => scanCandidates().filter(isHighScoreEntry),
    [scanCandidates],
  );
  const selectedCandidate = highScoreEntries.find((candidate) => candidate.market.symbol === market?.symbol);

  useEffect(() => {
    const liveKeys = new Set(highScoreEntries.map(entryCandidateKey));
    setDismissedPatternKeys((previous) => {
      const next = new Set([...previous].filter((key) => liveKeys.has(key)));
      return next.size === previous.size && [...next].every((key) => previous.has(key))
        ? previous
        : next;
    });
  }, [highScoreEntries]);

  useEffect(() => {
    if (entryAlert) return;
    const next = highScoreEntries.find(
      (candidate) => !dismissedPatternKeys.has(entryCandidateKey(candidate)),
    );
    if (!next) return;

    const key = entryCandidateKey(next);
    setEntryAlert({ key, candidate: next, expiresAt: Date.now() + ENTRY_ALERT_MS });
    setSelectedSymbol(next.market.symbol);
    setScanSelection(next);
    setScanAttempted(false);
  }, [dismissedPatternKeys, entryAlert, highScoreEntries]);

  useEffect(() => {
    if (!entryAlert) return;
    const alert = entryAlert;
    setAlertNow(Date.now());
    const ticker = window.setInterval(() => setAlertNow(Date.now()), 250);
    const expiry = window.setTimeout(() => {
      setDismissedPatternKeys((previous) => new Set(previous).add(alert.key));
      setEntryAlert((current) => current?.key === alert.key ? null : current);
    }, Math.max(0, alert.expiresAt - Date.now()));

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(expiry);
    };
  }, [entryAlert]);

  const handleScan = () => {
    setScanAttempted(true);
    const candidate = highScoreEntries.find(
      (item) => !dismissedPatternKeys.has(entryCandidateKey(item)),
    ) ?? null;
    if (candidate) {
      setSelectedSymbol(candidate.market.symbol);
      setScanSelection(candidate);
    } else {
      setScanSelection(null);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f3f5f2] px-3 py-5 text-slate-900 sm:px-6 sm:py-8">
      {entryAlert && <EnterNowAlert alert={entryAlert} now={alertNow} />}
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="relative overflow-hidden rounded-2xl border border-[#d6e0dc] bg-[#e6efeb] px-5 py-5 sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-teal-900/10" />
          <div className="pointer-events-none absolute -right-2 -top-12 h-48 w-48 rounded-full border border-teal-900/10" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-900">
                <Radio className="h-3.5 w-3.5" /> Digit Killer <span className="text-teal-700/50">/</span> Live analysis
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Under-4 / Under-5 analyser</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Scans active Volatility, Jump, and Bear/Bull markets only. Holds one market through its 30-second entry window, then rotates to the next qualified Under 4 or Under 5 setup.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[440px]">
              <div className="min-w-0 flex-1">
                <label htmlFor="market-select" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Market</label>
                <Select value={market?.symbol ?? ""} onValueChange={(value) => { setSelectedSymbol(value); setScanSelection(null); setScanAttempted(false); }} disabled={Boolean(entryAlert)}>
                  <SelectTrigger id="market-select" aria-label="Select Volatility, Jump, or Bear/Bull market" className="h-10 border-[#c7d5d0] bg-[#fffefa]">
                    <SelectValue placeholder="Select market" />
                  </SelectTrigger>
                  <SelectContent>
                    {markets.map((item) => <SelectItem key={item.symbol} value={item.symbol}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:self-end">
                <Button onClick={handleScan} disabled={!markets.length || Boolean(entryAlert)} className="h-10 w-full bg-teal-800 px-4 text-white hover:bg-teal-900 sm:w-auto">
                  <ScanSearch className="h-4 w-4" /> {entryAlert ? "Market locked" : "Scan best market"}
                </Button>
              </div>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-teal-900/10 pt-3">
            {data
              ? <MarketStatus
                  connected={data.isConnected}
                  historyLoaded={data.historyLoaded}
                  historyPhase={data.historyPhase}
                  historyCount={data.historyCount}
                  error={data.error}
                />
              : <Badge variant="outline">{marketCatalog.loaded ? "Market data initializing" : "Checking Deriv symbols"}</Badge>}
            <Badge variant="outline" className="border-slate-300 bg-white/60 font-mono text-slate-600">
              {data?.historyCount.toLocaleString() ?? "0"} history ticks
            </Badge>
            {scanSelection && (
              <span className="text-xs text-teal-900">Highest-ranked eligible result: Under {scanSelection.barrier}, <code className="font-mono font-semibold">{scanSelection.pattern.pattern}</code></span>
            )}
          </div>
        </header>

        <UnderTradeControls
          initialMarket={market?.symbol}
          autoMarket={highScoreEntries[0]?.market.symbol}
          suggestedBarrier={selectedCandidate?.barrier ?? scanSelection?.barrier}
          entryReady={Boolean(selectedCandidate)}
          score={selectedCandidate?.pattern.averagePerformance ?? null}
          samples={selectedCandidate?.pattern.sampleCount ?? 0}
        />

        {marketCatalog.error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>{marketCatalog.error}</span>
            <Button type="button" onClick={refreshMarketCatalog} className="shrink-0 bg-amber-900 text-white hover:bg-amber-950">
              Retry symbols
            </Button>
          </div>
        )}
        {data?.error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-semibold">Live feed issue</p><p className="mt-0.5">{data.error}</p></div>
            </div>
            <Button type="button" variant="outline" onClick={() => market ? refreshMarketHistory(market.symbol) : refreshMarketCatalog()} className="shrink-0 border-rose-300 bg-white text-rose-900 hover:bg-rose-50">
              Retry history
            </Button>
          </div>
        )}
        {!data?.isConnected && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="font-semibold">Feed disconnected.</span> Displayed digits and rates are the last available history; entry-window status is not live.
          </div>
        )}
        {data && !data.historyLoaded && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="font-semibold">History is {data.historyPhase}.</span> Current pattern samples may be incomplete. The scanner requires a connected feed and at least 1,000 historical ticks before a market can be selected.
          </div>
        )}
        {data && data.historyLoaded && data.historyCount < 1000 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="font-semibold">History baseline not complete:</span> {data.historyCount.toLocaleString()} / 1,000 ticks available. The scan stays in observation mode until the full baseline is loaded.
          </div>
        )}

        <Card className="border-slate-200 bg-[#fffefa] shadow-sm">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <DigitHistory digits={visibleDigits} lastDigit={data?.lastDigit ?? null} />
            <div className="grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-2 lg:gap-8">
              <TokenStream digits={visibleDigits} barrier={4} />
              <TokenStream digits={visibleDigits} barrier={5} />
            </div>
            {hasHistory && !data?.historyLoaded && <p className="text-xs text-amber-800">History has not finished loading; the visible sequence may be partial.</p>}
          </CardContent>
        </Card>

        {!scanSelection && !Object.values(analyses).some((item) => item.under4.bestPattern || item.under5.bestPattern) && (
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            No historical pattern ranking is available yet. Review feed readiness and sample counts; Scan only selects markets that meet its live-history eligibility checks.
          </div>
        )}
        {scanAttempted && !scanSelection && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            No eligible market found. A scan candidate needs a connected feed, completed history, at least 1,000 ticks, and a historical pattern.
          </div>
        )}
        <section aria-label="Under barrier pattern performance" className="grid items-start gap-4 xl:grid-cols-2">
          <PatternPanel
            barrier={4}
            analysis={analysis?.under4}
            selected={scanSelection?.market.symbol === market?.symbol && scanSelection.barrier === 4}
            isFeedLive={Boolean(data?.isConnected)}
            historyReady={Boolean(data?.historyLoaded && data.historyCount >= 1000)}
          />
          <PatternPanel
            barrier={5}
            analysis={analysis?.under5}
            selected={scanSelection?.market.symbol === market?.symbol && scanSelection.barrier === 5}
            isFeedLive={Boolean(data?.isConnected)}
            historyReady={Boolean(data?.historyLoaded && data.historyCount >= 1000)}
          />
        </section>

        <footer className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-[#e9eeea] px-4 py-3 text-xs leading-relaxed text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p><strong className="font-semibold text-slate-800">Historical pattern rates are not future win probabilities.</strong> Outcomes summarize observed ticks only; overlapping windows are not independent.</p>
          <p className="shrink-0 font-medium text-slate-700">Analysis only · no trades are executed</p>
        </footer>
      </div>
    </main>
  );
}
