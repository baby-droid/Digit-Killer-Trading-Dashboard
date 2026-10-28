import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, CircleStop, ShieldAlert, Signal, SlidersHorizontal } from "lucide-react";
import { useDerivSession, type DerivTradeRecord } from "@/lib/deriv-session";
import { useDerivMarketCatalog } from "@/hooks/useDerivWebSocket";
import { Button } from "@/components/ui/button";

type Props = { initialMarket?: string; autoMarket?: string; signalKey?: string; suggestedBarrier?: 4 | 5; entryReady?: boolean; score?: number | null; samples?: number };
type Settings = { marketMode: "manual" | "auto"; symbol: string; barrier: 4 | 5; stake: number; recovery: number; recoverySteps: number; stopLoss: number; takeProfit: number; delay: number; lossPauseSeconds: number; targetWins: number; threshold: number };
const defaults: Settings = { marketMode: "manual", symbol: "R_10", barrier: 4, stake: 1, recovery: 1.5, recoverySteps: 2, stopLoss: 10, takeProfit: 10, delay: 0, lossPauseSeconds: 5, targetWins: 5, threshold: 95 };
const storageKey = "dk-under-session-settings-v1";
const readSettings = (): Settings => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as Partial<Settings>;
    return {
      ...defaults,
      ...saved,
      threshold: Math.max(95, Math.min(100, Number(saved.threshold ?? defaults.threshold))),
    };
  } catch { return defaults; }
};

function tradeProfit(trade: DerivTradeRecord) {
  if (trade.profit !== null && Number.isFinite(trade.profit)) return trade.profit;
  if (trade.status === "lost") return -trade.stake;
  if (trade.status === "won" && trade.payout !== null && Number.isFinite(trade.payout)) {
    return trade.payout - trade.stake;
  }
  return 0;
}

export function UnderTradeControls({ initialMarket, autoMarket, signalKey = "entry", suggestedBarrier, entryReady = false, score = null, samples = 0 }: Props) {
  const session = useDerivSession();
  const catalog = useDerivMarketCatalog();
  const [settings, setSettings] = useState<Settings>(() => ({ ...readSettings(), ...(initialMarket ? { symbol: initialMarket } : {}), ...(suggestedBarrier ? { barrier: suggestedBarrier } : {}) }));
  const [aiOn, setAiOn] = useState(false);
  const [armed, setArmed] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lossPauseUntil, setLossPauseUntil] = useState(0);
  const lastAutoSignal = useRef("");
  const lastLossContract = useRef<string | null>(null);
  const previousAccountId = useRef<string | null>(null);
  const orderInFlight = useRef(false);
  const signalKeyRef = useRef(signalKey);
  const lossPauseSecondsRef = useRef(settings.lossPauseSeconds);
  signalKeyRef.current = signalKey;
  lossPauseSecondsRef.current = settings.lossPauseSeconds;
  const real = session.activeAccount?.account_type === "real";
  const accountTrades = session.trades.filter((trade) => trade.accountId === session.activeAccount?.account_id);
  const settledTrades = accountTrades
    .filter((trade) => ["won", "lost", "sold", "cancelled"].includes(trade.status))
    .sort((left, right) => (right.settledAt ?? right.createdAt) - (left.settledAt ?? left.createdAt));
  let consecutiveLosses = 0;
  for (const trade of settledTrades) {
    if (trade.status !== "lost") break;
    consecutiveLosses++;
  }
  const recoveryStep = Math.min(consecutiveLosses, settings.recoverySteps);
  const maxStake = Math.min(
    settings.stake * Math.pow(settings.recovery, settings.recoverySteps),
    settings.stopLoss,
  );
  const nextStake = Math.min(settings.stake * Math.pow(settings.recovery, recoveryStep), maxStake);
  const enabledRiskLimits =
    Number.isFinite(settings.stake) && settings.stake > 0 && settings.stake <= settings.stopLoss
    && Number.isFinite(settings.stopLoss) && settings.stopLoss > 0
    && Number.isFinite(settings.takeProfit) && settings.takeProfit > 0
    && Number.isFinite(settings.recoverySteps) && settings.recoverySteps >= 0 && settings.recoverySteps <= 5
    && Number.isInteger(settings.recoverySteps)
    && Number.isFinite(settings.recovery) && settings.recovery >= 1 && settings.recovery <= 3
    && Number.isFinite(settings.lossPauseSeconds) && settings.lossPauseSeconds >= 0 && settings.lossPauseSeconds <= 120
    && Number.isFinite(settings.targetWins) && settings.targetWins >= 1 && Number.isInteger(settings.targetWins)
    && Number.isFinite(settings.delay) && settings.delay >= 0 && settings.delay <= 120
    && Number.isFinite(settings.threshold) && settings.threshold >= 95 && settings.threshold <= 100;
  const signalReady = Boolean(entryReady && (score ?? -1) >= settings.threshold);
  const sessionWins = settledTrades.filter((trade) => trade.status === "won").length;
  const sessionPnl = settledTrades.reduce((sum, trade) => sum + tradeProfit(trade), 0);
  const limitsReached = sessionPnl <= -settings.stopLoss || sessionPnl >= settings.takeProfit || sessionWins >= settings.targetWins;
  const exposureBlocked = nextStake > Math.max(0, sessionPnl + settings.stopLoss);
  const hasUnsettledTrade = accountTrades.some((trade) => ["proposing", "buying", "open"].includes(trade.status));
  const lossPaused = Date.now() < lossPauseUntil;
  const marketOptions = useMemo(() => catalog.markets.filter((item) => ["volatility", "jump", "bear_bull"].includes(item.category)), [catalog.markets]);
  const canPlaceTrade =
    !busy && !orderInFlight.current && Boolean(session.activeAccount)
    && enabledRiskLimits && !limitsReached && !exposureBlocked && !hasUnsettledTrade && !lossPaused
    && (!real || (armed && confirmLive));

  const execute = useCallback(async (override?: { symbol?: string; barrier?: 4 | 5 }) => {
    if (orderInFlight.current || !canPlaceTrade) return;
    orderInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await session.buyDigitUnder({
        symbol: override?.symbol ?? settings.symbol,
        barrier: override?.barrier ?? settings.barrier,
        stake: nextStake,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deriv did not accept the one-tick contract.");
    } finally {
      orderInFlight.current = false;
      setBusy(false);
    }
  }, [canPlaceTrade, nextStake, session.buyDigitUnder, settings.barrier, settings.symbol]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    session.setLiveRiskCaps(enabledRiskLimits
      ? { maxStake, stopLoss: settings.stopLoss, takeProfit: settings.takeProfit }
      : null);
  }, [enabledRiskLimits, maxStake, session.setLiveRiskCaps, settings.stopLoss, settings.takeProfit]);
  useEffect(() => {
    session.armLiveTrading(Boolean(
      armed && enabledRiskLimits && session.activeAccount?.account_type === "real" && confirmLive,
    ));
  }, [armed, confirmLive, enabledRiskLimits, session.activeAccount?.account_type, session.armLiveTrading]);
  useEffect(() => () => {
    session.armLiveTrading(false);
  }, [session.armLiveTrading]);
  useEffect(() => {
    const accountId = session.activeAccount?.account_id ?? null;
    if (previousAccountId.current && previousAccountId.current !== accountId) {
      setArmed(false);
      setAiOn(false);
      setConfirmLive(false);
      session.armLiveTrading(false);
    }
    previousAccountId.current = accountId;
  }, [session.activeAccount?.account_id, session.armLiveTrading]);
  useEffect(() => {
    const accountId = session.activeAccount?.account_id;
    if (!accountId) return;
    return session.subscribeTradeEvents(({ trade, terminal }) => {
      if (!terminal || trade.accountId !== accountId || trade.status !== "lost") return;
      if (lastLossContract.current === trade.id) return;
      lastLossContract.current = trade.id;
      lastAutoSignal.current = signalKeyRef.current;
      const pauseMs = Math.max(0, lossPauseSecondsRef.current) * 1_000;
      setLossPauseUntil(Date.now() + pauseMs);
      if (pauseMs > 0) {
        window.setTimeout(() => setLossPauseUntil((value) => value <= Date.now() ? 0 : value), pauseMs + 20);
      }
      setError(pauseMs > 0
        ? `A loss settled. Entries paused for ${lossPauseSecondsRef.current} seconds while the scanner waits for a fresh setup.`
        : "A loss settled. The scanner will wait for a fresh setup.");
    });
  }, [session.activeAccount?.account_id, session.subscribeTradeEvents]);
  useEffect(() => {
    if (initialMarket) setSettings((current) => ({ ...current, symbol: initialMarket }));
  }, [initialMarket]);
  useEffect(() => {
    if (settings.marketMode === "auto" && autoMarket) {
      setSettings((current) => ({ ...current, symbol: autoMarket, ...(suggestedBarrier ? { barrier: suggestedBarrier } : {}) }));
    }
  }, [settings.marketMode, autoMarket, suggestedBarrier]);
  useEffect(() => {
    if (!aiOn || !armed || !signalReady || !canPlaceTrade || lastAutoSignal.current === signalKey) return;
    if (!session.activeAccount) { setError("Connect a Deriv account before entries can be enabled."); return; }
    if (real && !confirmLive) { setError("Confirm live mode before enabling real-account entries."); return; }
    if (!enabledRiskLimits) { setError("Configure valid stake, recovery, stop-loss and take-profit limits first."); return; }
    lastAutoSignal.current = signalKey;
    const timer = window.setTimeout(() => { void execute(); }, Math.max(0, settings.delay) * 1000);
    return () => window.clearTimeout(timer);
  }, [aiOn, armed, signalReady, canPlaceTrade, session.activeAccount, real, confirmLive, enabledRiskLimits, signalKey, settings.delay, execute]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const stopAll = () => {
    setArmed(false);
    setAiOn(false);
    setConfirmLive(false);
    session.stopAllEntries();
    session.armLiveTrading(false);
  };
  const liveToggle = () => {
    if (!real) return;
    const accepted = window.confirm("LIVE ACCOUNT — contracts use real funds and can lose the full stake. Confirm that you intend to trade live.");
    setConfirmLive(accepted);
  };
  const toggleArmed = () => {
    if (!armed && !enabledRiskLimits) { setError("Configure valid risk limits before arming entries."); return; }
    if (!armed && real && !confirmLive) { setError("Confirm live mode before arming a real account."); return; }
    setError("");
    setArmed((value) => !value);
  };
  const numberField = (key: keyof Settings, label: string, step = "0.01", min = 0, max?: number) => (
    <label className="space-y-1" key={key}><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><input type="number" min={min} max={max} step={step} value={settings[key]} onChange={(event) => update(key, Number(event.target.value) as never)} className="h-9 w-full rounded-md border border-input bg-background px-2.5 font-mono text-sm focus:border-primary focus:outline-none" data-testid={`input-${key}`} /></label>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" data-testid="under-trading-controls">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Under-4 / Under-5 controls</h2><span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px]">1 TICK</span></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setAiOn((value) => !value)} aria-pressed={aiOn} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${aiOn ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`} data-testid="toggle-ai-analyser"><Bot className="mr-1.5 inline h-3.5 w-3.5" />AI analyser {aiOn ? "ON" : "OFF"}</button>
          <button type="button" onClick={toggleArmed} aria-pressed={armed} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${armed ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-border text-muted-foreground"}`} data-testid="toggle-entry-arming">{armed ? "Entries armed" : "Arm entries"}</button>
          <Button variant="destructive" size="sm" onClick={stopAll} className="gap-1.5" data-testid="button-stop-all"><CircleStop className="h-4 w-4" />Stop all entry</Button>
        </div>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.1fr] sm:p-5">
        <div className="space-y-3">
            <div className={`rounded-lg border p-3 ${signalReady ? "border-emerald-400/40 bg-emerald-400/10" : "border-border bg-muted/30"}`} data-testid="status-entry-signal">
            <div className="flex items-center gap-2"><Signal className={`h-4 w-4 ${signalReady ? "text-emerald-300" : "text-muted-foreground"}`} /><span className={`text-xs font-bold uppercase tracking-wider ${signalReady ? "text-emerald-300" : "text-muted-foreground"}`}>{signalReady ? "Green entry signal" : "No qualified entry"}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">{signalReady ? `Observed historical score ${score?.toFixed(1) ?? "—"}% across ${samples} samples. Signal is not a forecast.` : "Entry signal requires a matching live pattern, sufficient history and the configured score threshold."}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Market selection</span><select value={settings.marketMode} onChange={(event) => update("marketMode", event.target.value as Settings["marketMode"])} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="select-market-mode"><option value="manual">Manual market</option><option value="auto">Auto market</option></select></label>
            <label className="space-y-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Market</span><select value={settings.symbol} onChange={(event) => update("symbol", event.target.value)} disabled={settings.marketMode === "auto"} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="select-trade-market">{marketOptions.map((market) => <option key={market.symbol} value={market.symbol}>{market.name}</option>)}</select></label>
            <label className="space-y-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Barrier</span><select value={settings.barrier} onChange={(event) => update("barrier", Number(event.target.value) as 4 | 5)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="select-under-barrier"><option value={4}>Under 4</option><option value={5}>Under 5</option></select></label>
            {numberField("threshold", "Historical score threshold %", "1", 95, 100)}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">Score is an observed historical ranking, shown with sample count. It is not a forecast of the next tick.</p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {numberField("stake", "Stake", "0.01", 0.01)}
            {numberField("recovery", "Recovery multiplier", "0.1", 1, 3)}
            {numberField("recoverySteps", "Recovery steps", "1", 0, 5)}
            {numberField("stopLoss", "Stop loss", "0.01", 0.01)}
            {numberField("takeProfit", "Take profit", "0.01", 0.01)}
            {numberField("delay", "Entry delay (sec)", "1", 0, 120)}
            {numberField("lossPauseSeconds", "Pause after loss (sec)", "1", 0, 120)}
            {numberField("targetWins", "Target wins", "1", 1, 100)}
          </div>
          <p className="text-[10px] text-muted-foreground">Next stake: {nextStake.toFixed(2)} · recovery level {recoveryStep}/{settings.recoverySteps} · maximum stake {maxStake.toFixed(2)}</p>
          {real && <label className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs" data-testid="real-account-confirmation"><input type="checkbox" checked={confirmLive} onChange={(event) => { if (event.target.checked) liveToggle(); else setConfirmLive(false); }} className="mt-0.5 accent-amber-400" /><span><b className="text-amber-300">Real account armed confirmation</b><span className="mt-0.5 block text-muted-foreground">Explicit confirmation is required before any real-account entry. Demo remains the recommended default.</span></span></label>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-[10px] text-muted-foreground" data-testid="status-risk-limits"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Risk limits {enabledRiskLimits ? "configured" : "incomplete"} · {session.activeAccount?.account_type ?? "demo default"} · P/L {sessionPnl.toFixed(2)}{lossPaused ? " · pause after loss" : ""}</span>
            <Button onClick={() => void execute()} disabled={!canPlaceTrade} className="min-w-36" data-testid="button-manual-under-trade">{limitsReached ? "Session limit reached" : lossPaused ? "Paused after loss" : hasUnsettledTrade ? "Waiting for settlement" : exposureBlocked ? "Stop-loss budget reached" : busy ? "Submitting…" : `Buy Under ${settings.barrier}`}</Button>
          </div>
          {(error || session.error) && <p role="alert" className="flex items-start gap-2 text-xs text-destructive" data-testid="error-trade-control"><AlertTriangle className="h-4 w-4 shrink-0" />{error || session.error}</p>}
        </div>
      </div>
    </section>
  );
}
