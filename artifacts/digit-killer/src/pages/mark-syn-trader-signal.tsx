import { useMemo, useState } from "react";
import { ArrowUpRight, Activity, Check, Clipboard, Radio, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { useDerivMultiMarket } from "@/hooks/useDerivMultiMarket";
import { getMarketFeedSnapshot } from "@/hooks/useDerivWebSocket";
import { buildMarkSignals, type MarkSignal, type SignalKind } from "@/lib/mark-signals";

const MARKS_APP_URL = "https://marksyntrader--marksyntrader.replit.app/";

const SIGNAL_OPTIONS: { value: SignalKind; label: string; group: string }[] = [
  { value: "RISE", label: "Rise", group: "Direction" },
  { value: "FALL", label: "Fall", group: "Direction" },
  { value: "EVEN", label: "Even", group: "Digit" },
  { value: "ODD", label: "Odd", group: "Digit" },
  { value: "MATCHES", label: "Matches", group: "Digit" },
  { value: "DIFFERS", label: "Differs", group: "Digit" },
  { value: "ONLY_UPS", label: "Only Ups", group: "Trend" },
  { value: "ONLY_DOWNS", label: "Only Downs", group: "Trend" },
  ...Array.from({ length: 7 }, (_, index) => ({
    value: `OVER_${index + 1}` as SignalKind,
    label: `Over ${index + 1}`,
    group: "Over / Under",
  })),
  ...Array.from({ length: 8 }, (_, index) => ({
    value: `UNDER_${8 - index}` as SignalKind,
    label: `Under ${8 - index}`,
    group: "Over / Under",
  })),
];

function signalLabel(kind: SignalKind) {
  return SIGNAL_OPTIONS.find((option) => option.value === kind)?.label ?? kind.replaceAll("_", " ");
}

function makeSignalText(signal: MarkSignal, attempts: number) {
  return [
    "MARKS YN TRADER SIGNAL",
    `Market: ${signal.marketName} (${signal.symbol})`,
    `Signal: ${signalLabel(signal.kind)}`,
    `Entry condition: ${signal.entry}`,
    `Recommended attempts: ${attempts}`,
    `Maximum attempts selected: ${attempts}`,
    `Strength: ${signal.strength}%`,
    `Last digit: ${signal.lastDigit ?? "Unavailable"}`,
    `Ticks analyzed: ${signal.ticksAnalyzed}`,
    `Rationale: ${signal.rationale}`,
    "",
    "Manual transfer only. No execution or signal transmission occurs.",
  ].join("\n");
}

export default function MarkSynTraderSignal() {
  const marketsData = useDerivMultiMarket();
  const [kind, setKind] = useState<SignalKind>("RISE");
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const allSignals = useMemo(() => buildMarkSignals(marketsData), [marketsData]);
  const candidates = useMemo(
    () => allSignals.filter((signal) => signal.kind === kind).sort((a, b) => b.strength - a.strength),
    [allSignals, kind],
  );
  const bestSignal = candidates[0];
  const recommendedAttempts = bestSignal ? Math.min(bestSignal.attempts, maxAttempts) : 0;
  const snapshots = Object.keys(marketsData).map((symbol) => getMarketFeedSnapshot(symbol));
  const connectedCount = snapshots.filter((feed) => feed.isConnected).length;
  const historyCount = snapshots.filter((feed) => feed.historyLoaded).length;
  const errors = snapshots.filter((feed) => feed.error);
  const totalMarkets = snapshots.length;
  const isLoading = historyCount === 0 && errors.length === 0;

  const copySignal = async () => {
    if (!bestSignal) return;
    try {
      await navigator.clipboard.writeText(makeSignalText(bestSignal, recommendedAttempts));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-6" data-testid="page-mark-syn-trader-signal">
      <div className="h-0.5 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-400/40 to-transparent" />

      <header className="flex flex-col justify-between gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            <Activity className="h-3.5 w-3.5" />
            Ahmed Syntrader / Live desk
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Mark Syntrader Signal</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Find a live market candidate, review its entry condition, then carry the details into MarksYNTrader manually.
          </p>
        </div>
        <div
          className="flex w-fit items-center gap-2 rounded-md border border-primary/20 bg-primary/[0.06] px-3 py-2 font-mono text-[11px] text-primary"
          data-testid="status-feed-connection"
        >
          {connectedCount > 0 ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span className={`h-1.5 w-1.5 rounded-full ${connectedCount > 0 ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
          {connectedCount > 0 ? "FEED LIVE" : "CONNECTING"}
          <span className="ml-1 text-muted-foreground">{connectedCount}/{totalMarkets}</span>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]" aria-label="Signal workspace">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg shadow-black/10">
          <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded border border-primary/25 bg-primary/10 text-primary">
                <Radio className="h-3.5 w-3.5" />
              </span>
              <div>
                <h2 className="text-sm font-bold">Candidate market</h2>
                <p className="font-mono text-[10px] text-muted-foreground">Best eligible result for selected contract</p>
              </div>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground" data-testid="status-history">
              History loaded <span className="text-foreground">{historyCount}</span> / {totalMarkets}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Signal type</span>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as SignalKind)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  data-testid="select-signal-type"
                >
                  {["Direction", "Digit", "Trend", "Over / Under"].map((group) => (
                    <optgroup key={group} label={group}>
                      {SIGNAL_OPTIONS.filter((option) => option.group === group).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Maximum attempts</span>
                <select
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  data-testid="select-maximum-attempts"
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((attempt) => (
                    <option key={attempt} value={attempt}>{attempt} {attempt === 1 ? "attempt" : "attempts"}</option>
                  ))}
                </select>
              </label>
            </div>

            {bestSignal ? (
              <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-[linear-gradient(120deg,rgba(0,209,209,0.09),rgba(0,209,209,0.015)_48%,rgba(4,12,18,0.4))] p-4 sm:p-6" data-testid="card-best-signal">
                <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-12 rounded-full border border-primary/10" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/75">Top candidate</div>
                    <div className="mt-1 text-2xl font-black tracking-tight sm:text-3xl" data-testid="text-market-name">
                      {bestSignal.marketName}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground" data-testid="text-market-symbol">{bestSignal.symbol}</div>
                  </div>
                  <div className="min-w-[104px] rounded-md border border-primary/20 bg-background/50 px-3 py-2 text-right">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Setup strength</div>
                    <div className="font-mono text-2xl font-bold text-primary" data-testid="text-signal-strength">{bestSignal.strength}<span className="text-sm">%</span></div>
                  </div>
                </div>

                <div className="my-5 flex flex-wrap items-center gap-2 border-y border-primary/10 py-3">
                  <span className="rounded-sm border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-sm font-bold text-primary" data-testid="text-signal-kind">
                    {signalLabel(bestSignal.kind).toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">LIVE CANDIDATE</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border/80 bg-background/55 p-3" data-testid="data-entry-condition">
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Exact entry condition</div>
                    <div className="mt-1.5 font-mono text-sm font-bold leading-relaxed text-foreground">{bestSignal.entry}</div>
                  </div>
                  <div className="rounded-md border border-border/80 bg-background/55 p-3" data-testid="data-attempts">
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Attempts</div>
                    <div className="mt-1.5 flex items-baseline gap-2 font-mono">
                      <span className="text-lg font-bold text-foreground">{recommendedAttempts}</span>
                      <span className="text-[10px] text-muted-foreground">recommended</span>
                      <span className="ml-auto text-xs text-primary">cap {maxAttempts}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[100px_1fr]">
                  <div className="rounded-md border border-border/80 bg-background/55 p-3" data-testid="data-last-digit">
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Last digit</div>
                    <div className="mt-0.5 font-mono text-2xl font-bold text-foreground">{bestSignal.lastDigit ?? "—"}</div>
                  </div>
                  <div className="rounded-md border border-border/80 bg-background/55 p-3" data-testid="data-signal-rationale">
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Signal basis</div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/80">{bestSignal.rationale}</p>
                    <div className="mt-2 font-mono text-[10px] text-muted-foreground">{bestSignal.ticksAnalyzed} ticks analyzed</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={copySignal}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-primary/35 bg-primary/10 px-4 text-xs font-bold text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    data-testid="button-copy-signal"
                  >
                    {copyState === "copied" ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                    {copyState === "copied" ? "Signal copied" : "Copy signal details"}
                  </button>
                  <a
                    href={MARKS_APP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-black text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    data-testid="link-open-marksyntrader"
                  >
                    Open MarksYNTrader
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
                {copyState === "error" && (
                  <p className="mt-2 text-xs text-amber-300" role="status" data-testid="status-copy-error">
                    Could not access clipboard. Check browser permissions and try again.
                  </p>
                )}
                <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
                  Opens the other app only. Review and transfer this signal manually; there is no connection, import, or transmission.
                </p>
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/30 px-6 text-center" data-testid="state-no-candidate">
                {isLoading ? (
                  <>
                    <div className="mb-4 h-10 w-10 animate-pulse rounded-full border border-primary/30 bg-primary/10" />
                    <h3 className="text-sm font-bold">Building a live market history</h3>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Waiting for feed history and eligible {signalLabel(kind)} candidates.</p>
                  </>
                ) : (
                  <>
                    <Activity className="mb-3 h-8 w-8 text-muted-foreground/60" />
                    <h3 className="text-sm font-bold">No eligible {signalLabel(kind)} candidate yet</h3>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                      Keep the live feed open or choose another signal type. The candidate list updates with current market data.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4" data-testid="panel-market-feed">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em]">Market feed</h2>
              <span className="font-mono text-[10px] text-muted-foreground">{historyCount}/{totalMarkets}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs">
                <span className="text-muted-foreground">Connection</span>
                <span className={connectedCount ? "font-mono text-emerald-400" : "font-mono text-amber-300"} data-testid="text-connected-markets">
                  {connectedCount} live
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs">
                <span className="text-muted-foreground">Historical feeds</span>
                <span className="font-mono text-foreground" data-testid="text-history-count">{historyCount} ready</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Matching candidates</span>
                <span className="font-mono text-primary" data-testid="text-candidate-count">{candidates.length}</span>
              </div>
            </div>
            {isLoading && (
              <p className="mt-3 rounded border border-primary/15 bg-primary/[0.05] p-2 text-[10px] leading-relaxed text-muted-foreground" data-testid="status-feed-loading">
                Waiting for initial market history. Signals appear when the engine finds an eligible setup.
              </p>
            )}
            {errors.length > 0 && (
              <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/[0.06] p-2.5" data-testid="status-feed-error">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
                  <WifiOff className="h-3 w-3" /> Feed issues on {errors.length} market{errors.length === 1 ? "" : "s"}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{errors[0]?.error}</p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-amber-500/20 bg-amber-500/[0.045] p-4" data-testid="note-trading-risk">
            <div className="flex items-center gap-2 text-amber-200">
              <ShieldAlert className="h-4 w-4" />
              <h2 className="text-xs font-bold uppercase tracking-[0.12em]">Risk note</h2>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Setup strength is a heuristic ranking, not a win probability. Past ticks do not predict outcomes. No trade execution occurs here.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card/70 p-4" data-testid="note-manual-handoff">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-primary">Manual handoff</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Copy the candidate details, open MarksYNTrader in a separate tab, then enter the information yourself. Never share account credentials here.
            </p>
          </section>
        </aside>
      </section>

      {candidates.length > 1 && (
        <section className="overflow-hidden rounded-lg border border-border bg-card" data-testid="section-candidate-history">
          <div className="flex items-center justify-between border-b border-border bg-muted/25 px-4 py-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.14em]">Other eligible markets</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Sorted by engine strength</p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{candidates.length - 1} alternatives</span>
          </div>
          <div className="divide-y divide-border/70">
            {candidates.slice(1, 6).map((signal) => (
              <div key={signal.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_120px_100px]">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold" data-testid={`text-alternative-market-${signal.id}`}>{signal.marketName}</div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{signal.symbol} · {signal.entry}</div>
                </div>
                <div className="hidden font-mono text-[10px] text-muted-foreground sm:block">{signal.ticksAnalyzed} ticks</div>
                <div className="text-right font-mono text-sm font-bold text-primary">{signal.strength}%</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
