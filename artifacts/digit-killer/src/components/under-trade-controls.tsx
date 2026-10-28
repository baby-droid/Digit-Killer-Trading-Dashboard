import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CircleStop, ShieldAlert, Signal, SlidersHorizontal } from "lucide-react";
import { useDerivSession } from "@/lib/deriv-session";
import { useDerivMarketCatalog } from "@/hooks/useDerivWebSocket";
import { Button } from "@/components/ui/button";

type Props = { initialMarket?: string; autoMarket?: string; suggestedBarrier?: 4 | 5; entryReady?: boolean; score?: number | null; samples?: number };
type Settings = { marketMode: "manual" | "auto"; symbol: string; barrier: 4 | 5; stake: number; recovery: number; recoverySteps: number; stopLoss: number; takeProfit: number; delay: number; targetWins: number; threshold: number };
const defaults: Settings = { marketMode: "manual", symbol: "R_10", barrier: 4, stake: 1, recovery: 1.5, recoverySteps: 2, stopLoss: 10, takeProfit: 10, delay: 0, targetWins: 5, threshold: 95 };
const storageKey = "dk-under-session-settings-v1";
const readSettings = (): Settings => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; } catch { return defaults; }
};

export function UnderTradeControls({ initialMarket, autoMarket, suggestedBarrier, entryReady = false, score = null, samples = 0 }: Props) {
  const session = useDerivSession();
  const catalog = useDerivMarketCatalog();
  const [settings, setSettings] = useState<Settings>(() => ({ ...readSettings(), ...(initialMarket ? { symbol: initialMarket } : {}), ...(suggestedBarrier ? { barrier: suggestedBarrier } : {}) }));
  const [aiOn, setAiOn] = useState(false);
  const [armed, setArmed] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const real = session.activeAccount?.account_type === "real";
  const enabledRiskLimits = settings.stake > 0 && settings.stopLoss > 0 && settings.takeProfit > 0 && settings.recoverySteps >= 0 && settings.recoverySteps <= 5 && settings.recovery >= 1 && settings.recovery <= 3;
  const signalReady = Boolean(entryReady && (score ?? -1) >= settings.threshold);
  const marketOptions = useMemo(() => catalog.markets.filter((item) => ["volatility", "jump", "bear_bull"].includes(item.category)), [catalog.markets]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    if (initialMarket) setSettings((current) => ({ ...current, symbol: initialMarket }));
  }, [initialMarket]);
  useEffect(() => {
    if (settings.marketMode === "auto" && autoMarket) {
      setSettings((current) => ({ ...current, symbol: autoMarket, ...(suggestedBarrier ? { barrier: suggestedBarrier } : {}) }));
    }
  }, [settings.marketMode, autoMarket, suggestedBarrier]);
  useEffect(() => {
    if (!aiOn || !armed || !signalReady || busy) return;
    if (!session.activeAccount) { setError("Connect a Deriv account before entries can be enabled."); return; }
    if (real && !confirmLive) { setError("Confirm live mode before enabling real-account entries."); return; }
    if (!enabledRiskLimits) { setError("Configure valid stake, recovery, stop-loss and take-profit limits first."); return; }
    const timer = window.setTimeout(() => { void execute(); }, Math.max(0, settings.delay) * 1000);
    return () => window.clearTimeout(timer);
  // execute intentionally uses the current visible risk and market settings.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOn, armed, signalReady, busy, settings.delay, settings.symbol, settings.barrier, settings.stake, confirmLive, real, enabledRiskLimits]);

  const execute = async (override?: { symbol?: string; barrier?: 4 | 5 }) => {
    if (busy || !session.activeAccount || !enabledRiskLimits || (real && !confirmLive)) return;
    setBusy(true); setError("");
    try {
      await session.buyDigitUnder({ symbol: override?.symbol ?? settings.symbol, barrier: override?.barrier ?? settings.barrier, stake: settings.stake });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deriv did not accept the one-tick contract.");
    } finally { setBusy(false); }
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const stopAll = () => { setArmed(false); setAiOn(false); setConfirmLive(false); };
  const liveToggle = () => {
    if (!real) return;
    const accepted = window.confirm("LIVE ACCOUNT — contracts use real funds and can lose the full stake. Confirm that you intend to trade live.");
    setConfirmLive(accepted);
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
          <button type="button" onClick={() => setArmed((value) => !value)} aria-pressed={armed} className={`rounded-md border px-3 py-1.5 text-xs font-bold ${armed ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-border text-muted-foreground"}`} data-testid="toggle-entry-arming">{armed ? "Entries armed" : "Arm entries"}</button>
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
            {numberField("threshold", "Historical score threshold %", "1", 0, 100)}
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
            {numberField("targetWins", "Target wins", "1", 1, 100)}
          </div>
          {real && <label className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs" data-testid="real-account-confirmation"><input type="checkbox" checked={confirmLive} onChange={liveToggle} className="mt-0.5 accent-amber-400" /><span><b className="text-amber-300">Real account armed confirmation</b><span className="mt-0.5 block text-muted-foreground">Explicit confirmation is required before any real-account entry. Demo remains the recommended default.</span></span></label>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-[10px] text-muted-foreground" data-testid="status-risk-limits"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Risk limits {enabledRiskLimits ? "configured" : "incomplete"} · {session.activeAccount?.account_type ?? "demo default"}</span>
            <Button onClick={() => void execute()} disabled={busy || !session.activeAccount || !enabledRiskLimits || (real && !confirmLive)} className="min-w-36" data-testid="button-manual-under-trade">{busy ? "Submitting…" : `Buy Under ${settings.barrier}`}</Button>
          </div>
          {(error || session.error) && <p role="alert" className="flex items-start gap-2 text-xs text-destructive" data-testid="error-trade-control"><AlertTriangle className="h-4 w-4 shrink-0" />{error || session.error}</p>}
        </div>
      </div>
    </section>
  );
}
