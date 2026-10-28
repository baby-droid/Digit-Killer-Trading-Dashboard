import { Activity, CandlestickChart, Radio, ShieldCheck } from "lucide-react";
import { useMarket } from "@/lib/market-context";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { UnderTradeControls } from "@/components/under-trade-controls";

export default function TradeDesk() {
  const { activeMarket } = useMarket();
  const { digits, currentPrice, isConnected, historyLoaded } = useDerivWebSocket(activeMarket);
  const recent = digits.slice(-16);
  const current = recent[recent.length - 1]?.digit;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><CandlestickChart className="h-3.5 w-3.5" /> Ahmed Syntrader / Execution</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Trade desk</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Manual one-tick Under contracts, with explicit risk limits and visible account mode.</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
          <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
          <div><p className="font-mono text-sm font-bold">{currentPrice ? currentPrice.toFixed(4) : "—"}</p><p className="text-[9px] uppercase tracking-widest text-muted-foreground">{activeMarket} · {isConnected && historyLoaded ? "Live feed" : "Connecting feed"}</p></div>
        </div>
      </header>
      <UnderTradeControls initialMarket={activeMarket} />
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-sm font-bold">Live digit tape</h2><p className="mt-0.5 text-xs text-muted-foreground">Most recent tick at right · {digits.length.toLocaleString()} available ticks</p></div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-primary"><Radio className="h-3.5 w-3.5" />{isConnected ? "Streaming" : "Offline"}</span>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="list-live-digits">
            {recent.map((tick, index) => <div key={`${tick.time}-${index}`} data-testid={`digit-tick-${index}`} className={`grid h-11 w-11 place-items-center rounded-md border font-mono text-lg font-bold ${index === recent.length - 1 ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/30" : "border-border bg-muted/40 text-foreground/80"}`}>{tick.digit}</div>)}
            {!recent.length && <p className="py-5 text-sm text-muted-foreground">Waiting for market ticks…</p>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-primary" />Current read</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-background/60 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Last digit</p><p className="mt-1 font-mono text-3xl font-bold text-primary" data-testid="value-current-digit">{current ?? "—"}</p></div>
            <div className="rounded-lg border border-border bg-background/60 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Under 4 / 5</p><p className="mt-2 font-mono text-sm font-bold">{recent.filter((tick) => tick.digit < 4).length} <span className="text-muted-foreground">/</span> {recent.filter((tick) => tick.digit < 5).length}</p><p className="mt-1 text-[9px] text-muted-foreground">in latest {recent.length} ticks</p></div>
          </div>
          <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Historical digit frequencies describe previous ticks only; they do not predict a contract outcome.</p>
        </div>
      </section>
    </div>
  );
}
