import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  Copy,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useDerivMultiMarket } from "@/hooks/useDerivMultiMarket";
import {
  CATEGORY_LABELS,
  type Market,
  type MarketCategory,
  refreshMarketCatalog,
  refreshMarketHistory,
  useMarketList,
} from "@/hooks/useDerivWebSocket";
import { buildMarkSignals, type MarkSignal, type SignalKind } from "@/lib/mark-signal-engine";

const MARKS_APP_URL = "https://marksyntrader--marksyntrader.replit.app/";
const WINDOW_SIZES = [1000, 100, 50, 20, 10];

type SignalTab = "parity" | "barrier" | "digit" | "trend";
type MarketFilter = "all" | MarketCategory;

const TABS: { id: SignalTab; label: string }[] = [
  { id: "parity", label: "Even / Odd" },
  { id: "barrier", label: "Over / Under" },
  { id: "digit", label: "Digit Match" },
  { id: "trend", label: "Rise / Fall" },
];

function shortSignalLabel(kind: SignalKind) {
  if (kind.startsWith("OVER_")) return `OVER ${kind.slice(5)}`;
  if (kind.startsWith("UNDER_")) return `UNDER ${kind.slice(6)}`;
  if (kind === "ONLY_UPS") return "ONLY UPS";
  if (kind === "ONLY_DOWNS") return "ONLY DOWNS";
  return kind.replaceAll("_", " ");
}

function signalGroup(kind: SignalKind): SignalTab {
  if (kind === "EVEN" || kind === "ODD") return "parity";
  if (kind.startsWith("OVER_") || kind.startsWith("UNDER_")) return "barrier";
  if (kind === "MATCHES" || kind === "DIFFERS") return "digit";
  return "trend";
}

function signalCopy(signal: MarkSignal, runs: number) {
  return [
    "MARK SYN TRADER — SIGNAL REVIEW",
    `Market: ${signal.marketName} (${signal.symbol})`,
    `Strategy: ${shortSignalLabel(signal.kind)}`,
    `Entry status: ${signal.ready ? "ENTER NOW — revalidate on the next tick" : "WAIT — recheck the entry condition"}`,
    `Entry rule: ${signal.entry}`,
    `Engine score: ${signal.strength}/100 (${signal.classification}; not a probability)`,
    `Recommended duration: ${runs} runs`,
    `Window alignment: ${signal.alignedWindows}/5 (${WINDOW_SIZES.join("/")})`,
    `Latest digit: ${signal.lastDigit ?? "unavailable"}`,
    `Ticks analyzed: ${signal.ticksAnalyzed}`,
    `Observed pattern: ${signal.pattern}`,
    `Recent price momentum: ${signal.momentum}% upward`,
    `Cross-window noise: ${signal.noise}`,
    "",
    "Historical patterns do not predict future ticks. Flat stake only; no martingale or trade automation.",
    "Manual transfer only. No account data or credentials are shared.",
  ].join("\n");
}

function pickSignal(
  candidates: MarkSignal[],
  tab: SignalTab,
  options: { barrierSide: "OVER" | "UNDER"; digitSide: "MATCHES" | "DIFFERS"; trendKind: SignalKind },
) {
  const matching = candidates.filter((signal) => {
    if (signalGroup(signal.kind) !== tab) return false;
    if (tab === "barrier") return signal.kind.startsWith(`${options.barrierSide}_`);
    if (tab === "digit") return signal.kind === options.digitSide;
    if (tab === "trend") return signal.kind === options.trendKind;
    return true;
  });
  return matching.sort((left, right) => right.strength - left.strength)[0];
}

function MarketSignalCard({
  market,
  data,
  signal,
  copyState,
  maxRuns,
  onCopy,
}: {
  market: Market;
  data: ReturnType<typeof useDerivMultiMarket>[string] | undefined;
  signal: MarkSignal | undefined;
  copyState: string | null;
  maxRuns: number;
  onCopy: (signal: MarkSignal, runs: number) => void;
}) {
  const ticks = data?.digits.length ?? 0;
  const hasFullHistory = Boolean(data?.historyLoaded && ticks >= 1000);
  const progress = Math.min((ticks / 1000) * 100, 100);
  const status = data?.error
    ? "FEED ISSUE"
    : market.exchangeIsOpen === false
      ? "MARKET CLOSED"
      : !hasFullHistory
        ? data?.historyPhase === "queued"
          ? `QUEUED · ${ticks}/1,000`
          : data?.historyPhase === "loading"
            ? `REQUESTING · ${ticks}/1,000`
            : data?.historyLoaded
              ? `COLLECTING · ${ticks}/1,000`
              : `WAITING · ${ticks}/1,000`
        : signal
          ? signal.classification
          : "NO TRADE";
  const statusColor = data?.error
    ? "text-rose-400"
    : signal?.ready
      ? "text-emerald-400"
      : signal
        ? "text-amber-300"
        : "text-muted-foreground";
  const ring = Math.max(0, Math.min(progress, 100));
  const recentDigits = data?.digits.slice(-16) ?? [];
  const recommendedRuns = signal ? Math.min(signal.runs, maxRuns) : 0;
  const signalPill = signal ? shortSignalLabel(signal.kind) : null;
  const lastDigit = data?.lastDigit;

  return (
    <article
      className="min-w-0 overflow-hidden rounded-2xl border border-border/90 bg-card/90 shadow-sm shadow-black/10 transition hover:border-primary/30"
      data-testid={`card-scan-market-${market.symbol}`}
    >
      <header className="flex items-start justify-between gap-3 px-3.5 pt-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{market.name}</h3>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{market.symbol}</p>
        </div>
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${data?.error ? "bg-rose-400" : market.exchangeIsOpen === false ? "bg-amber-400" : data?.isConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]" : "bg-muted-foreground/50"}`}
          aria-label={data?.error ? "Feed issue" : market.exchangeIsOpen === false ? "Market closed" : data?.isConnected ? "Live feed" : "Connecting"}
          title={data?.error ?? (market.exchangeIsOpen === false ? "Market is closed" : "Deriv feed status")}
        />
      </header>

      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 px-3.5 py-3">
        <div
          className="grid aspect-square w-16 place-items-center rounded-full p-[4px]"
          style={{ background: `conic-gradient(hsl(var(--primary)) ${ring}%, hsl(var(--muted)) ${ring}%)` }}
          aria-label={`${ticks} of 1000 history ticks`}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-card font-mono text-xl font-bold text-primary">
            {lastDigit ?? "–"}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {signalPill ? (
              <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black text-white ${signal?.ready ? "bg-gradient-to-r from-sky-500 to-blue-700" : "bg-gradient-to-r from-rose-500 to-pink-700"}`}>
                {signalPill}
              </span>
            ) : (
              <span className="text-xs font-black tracking-wide text-foreground">SCANNING</span>
            )}
            <span className={`font-mono text-[9px] font-bold ${statusColor}`}>{status}</span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${signal?.ready ? "bg-gradient-to-r from-cyan-400 to-blue-500" : "bg-gradient-to-r from-sky-400/80 to-indigo-400/80"}`}
              style={{ width: `${signal ? signal.strength : progress}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
            {signal
              ? `${signal.entry} · ${signal.strength}/100 score`
              : `${ticks.toLocaleString()} / 1,000 ticks · ${data?.isConnected ? "live feed" : "waiting for feed"}`}
          </p>
        </div>
      </div>

      {signal && (
        <div className="mx-3.5 mb-2.5 rounded-lg border border-border/70 bg-background/45 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="font-semibold text-foreground">{signal.ready ? "Enter now · revalidate each tick" : "Wait to enter · conditions not complete"}</span>
            <span className="font-mono text-primary">{signal.strength}% score</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {signal.windowChecks.map((check) => (
              <span
                key={check.size}
                className={`rounded px-1 py-1 text-center font-mono text-[8px] ${check.aligned ? "bg-emerald-400/15 text-emerald-300" : "bg-muted text-muted-foreground"}`}
                title={`${check.rate.toFixed(1)}% observed; ${check.baseline.toFixed(1)}% baseline`}
              >
                {check.size === 1000 ? "1k" : check.size} {check.aligned ? "✓" : "·"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mx-3.5 flex min-w-0 gap-1 overflow-hidden pb-3" aria-label="Recent tick digits">
        {recentDigits.length > 0
          ? recentDigits.map((digit, index) => (
            <span
              key={`${market.symbol}-${index}-${digit}`}
              className={`grid h-5 min-w-5 flex-1 place-items-center rounded border font-mono text-[9px] font-semibold ${signal && signal.lastDigit === digit && index === recentDigits.length - 1 ? "border-primary/50 bg-primary/15 text-primary" : digit % 2 === 0 ? "border-sky-300/20 bg-sky-400/10 text-sky-300" : "border-rose-300/20 bg-rose-400/10 text-rose-300"}`}
            >
              {digit}
            </span>
          ))
          : <span className="text-[10px] text-muted-foreground">Waiting for tick history</span>}
      </div>

      {signal && (
        <footer className="flex items-center gap-2 border-t border-border/70 p-2.5">
          <button
            type="button"
            className="inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            onClick={() => onCopy(signal, recommendedRuns)}
            aria-label={`Copy ${market.name} signal`}
            title={copyState === signal.id ? "Signal copied" : "Copy signal"}
          >
            {copyState === signal.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={MARKS_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 flex-1 items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-700 px-3 text-[11px] font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
            data-testid={`link-trade-market-${market.symbol}`}
          >
            <span>Trade with Patel</span>
            <span className="font-mono text-[9px] opacity-85">{recommendedRuns} runs</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </a>
        </footer>
      )}

      {data?.error && (
        <div className="flex items-center justify-between gap-2 border-t border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-2">
          <span className="line-clamp-2 text-[9px] leading-relaxed text-rose-200/90">{data.error}</span>
          <button
            type="button"
            onClick={() => refreshMarketHistory(market.symbol)}
            className="shrink-0 rounded border border-rose-300/30 px-2 py-1 text-[9px] font-bold text-rose-200 hover:bg-rose-400/10"
          >
            Retry
          </button>
        </div>
      )}
    </article>
  );
}

export default function MarkSynTraderBoard() {
  const marketsData = useDerivMultiMarket();
  const marketList = useMarketList();
  const [tab, setTab] = useState<SignalTab>("parity");
  const [barrierSide, setBarrierSide] = useState<"OVER" | "UNDER">("OVER");
  const [digitSide, setDigitSide] = useState<"MATCHES" | "DIFFERS">("MATCHES");
  const [trendKind, setTrendKind] = useState<SignalKind>("RISE");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("volatility");
  const [maxRuns, setMaxRuns] = useState(15);
  const [copyState, setCopyState] = useState<string | null>(null);

  const allSignals = useMemo(
    () => buildMarkSignals(marketsData, marketList.markets),
    [marketsData, marketList.markets],
  );
  const markets = useMemo(() => {
    if (marketFilter === "all") return marketList.markets;
    return marketList.markets.filter((market) => market.category === marketFilter);
  }, [marketList.markets, marketFilter]);
  const visibleCards = useMemo(() => {
    const selected = markets.map((market) => ({
      market,
      data: marketsData[market.symbol],
      signal: pickSignal(allSignals.filter((signal) => signal.symbol === market.symbol), tab, {
        barrierSide,
        digitSide,
        trendKind,
      }),
    }));
    return selected.sort((left, right) =>
      (right.signal?.strength ?? -1) - (left.signal?.strength ?? -1)
      || left.market.name.localeCompare(right.market.name),
    );
  }, [allSignals, barrierSide, digitSide, marketFilter, markets, marketsData, tab, trendKind]);

  const allFeedStates = Object.values(marketsData);
  const connectedCount = allFeedStates.filter((market) => market.isConnected).length;
  const fullHistoryCount = allFeedStates.filter(
    (market) => market.historyLoaded && market.digits.length >= 1000,
  ).length;
  const errorCount = allFeedStates.filter((market) => market.error).length;
  const currentSignalCount = allSignals.filter((signal) => signalGroup(signal.kind) === tab).length;

  const handleCopy = async (signal: MarkSignal, runs: number) => {
    try {
      await navigator.clipboard.writeText(signalCopy(signal, runs));
      setCopyState(signal.id);
      window.setTimeout(() => setCopyState((previous) => previous === signal.id ? null : previous), 2200);
    } catch {
      setCopyState(`error:${signal.id}`);
      window.setTimeout(() => setCopyState(null), 2200);
    }
  };

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 pb-8" data-testid="page-mark-syn-trader-signal">
      <div className="h-0.5 rounded-full bg-gradient-to-r from-primary via-primary/30 to-transparent" />

      <header className="flex flex-col gap-4 border-b border-border/80 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <Activity className="h-3.5 w-3.5" />
            Ahmed Syntrader / Active-market scan
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Mark Syn Trader</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Active Deriv symbols ranked across 1,000, 100, 50, 20 and 10 tick windows. Signals are review-only; no trades are placed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-mono text-[10px]" data-testid="status-feed-connection">
            {connectedCount > 0 ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <WifiOff className="h-3.5 w-3.5 text-amber-300" />}
            <span className={`h-1.5 w-1.5 rounded-full ${connectedCount > 0 ? "animate-pulse bg-emerald-400" : "bg-amber-300"}`} />
            {connectedCount > 0 ? "FEED LIVE" : "CONNECTING"}
            <span className="text-muted-foreground">{connectedCount}/{marketList.markets.length}</span>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[10px]">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Max runs</span>
            <select
              value={maxRuns}
              onChange={(event) => setMaxRuns(Number(event.target.value))}
              className="bg-transparent font-mono font-bold text-foreground outline-none"
              data-testid="select-maximum-runs"
            >
              {Array.from({ length: 15 }, (_, index) => index + 1).map((runs) => (
                <option key={runs} value={runs} className="bg-card">{runs}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card/80 p-3 sm:p-4" aria-label="Signal modes">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Signal type">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${tab === item.id ? "border-primary/60 bg-gradient-to-r from-blue-500 to-indigo-700 text-white shadow-sm" : "border-border bg-background/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
                data-testid={`tab-signal-${item.id}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tab === "barrier" && (
              <div className="flex rounded-full border border-border p-0.5" role="group" aria-label="Over or under">
                {(["OVER", "UNDER"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={barrierSide === side}
                    onClick={() => setBarrierSide(side)}
                    className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${barrierSide === side ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            )}
            {tab === "digit" && (
              <div className="flex rounded-full border border-border p-0.5" role="group" aria-label="Digit contract">
                {(["MATCHES", "DIFFERS"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={digitSide === side}
                    onClick={() => setDigitSide(side)}
                    className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${digitSide === side ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            )}
            {tab === "trend" && (
              <select
                value={trendKind}
                onChange={(event) => setTrendKind(event.target.value as SignalKind)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-[9px] font-bold text-foreground"
                aria-label="Price and trend strategy"
              >
                <option value="RISE">RISE</option>
                <option value="FALL">FALL</option>
                <option value="ONLY_UPS">ONLY UPS</option>
                <option value="ONLY_DOWNS">ONLY DOWNS</option>
              </select>
            )}
            <label className="flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Market</span>
              <select
                value={marketFilter}
                onChange={(event) => setMarketFilter(event.target.value as MarketFilter)}
                className="max-w-[150px] bg-transparent text-[10px] font-semibold text-foreground outline-none"
                data-testid="select-market-category"
              >
                <option value="all">All active markets</option>
                {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
                  <option key={category} value={category}>{label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-3 font-mono text-[9px] text-muted-foreground">
          <span>{marketList.loaded ? marketList.markets.length : "Checking"} active markets</span>
          <span>{fullHistoryCount}/{marketList.markets.length} complete 1,000-tick histories</span>
          <span>{currentSignalCount} ranked candidates in this mode</span>
          {errorCount > 0 && <span className="text-amber-300">{errorCount} feed issue{errorCount === 1 ? "" : "s"}</span>}
        </div>
      </section>

      {marketList.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] px-3.5 py-3 text-xs text-amber-200">
          <span>{marketList.error}</span>
          <button
            type="button"
            onClick={refreshMarketCatalog}
            className="rounded border border-amber-300/30 px-2.5 py-1 font-bold hover:bg-amber-400/10"
          >
            Retry symbols
          </button>
        </div>
      )}
      {!marketList.loaded && !marketList.error && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] px-3.5 py-3 text-xs text-muted-foreground">
          <span>Checking Deriv’s active symbols for the supported contracts…</span>
        </div>
      )}

      {markets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-semibold">No active markets in this group</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose another market group.</p>
        </div>
      ) : (
        <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Live market signal cards">
          {visibleCards.map(({ market, data, signal }) => (
            <MarketSignalCard
              key={market.symbol}
              market={market}
              data={data}
              signal={signal}
              copyState={copyState}
              maxRuns={maxRuns}
              onCopy={handleCopy}
            />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3.5 sm:flex-row sm:items-start" data-testid="note-trading-risk">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">Review signals, not promises</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Candidates require 1,000/100/50/20/10-window alignment and an entry check. The 0–100 score is a rule-alignment rank, not a win probability. Every setup is rechecked on each tick; use a flat stake and do not use martingale.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
          <RefreshCw className="h-3 w-3" /> manual review only
        </div>
      </section>

      <p className="text-center text-[9px] text-muted-foreground">
        “Trade with Patel” opens MarksYNTrader in a separate tab. Copy the card details and transfer them manually; this page never places trades or shares account credentials.
      </p>
    </main>
  );
}
