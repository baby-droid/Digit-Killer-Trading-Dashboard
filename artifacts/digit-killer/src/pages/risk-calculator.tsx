import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, TrendingUp, TrendingDown, AlertTriangle, Shield,
  DollarSign, Target, Layers, RefreshCw, Minus, Plus
} from "lucide-react";

type Mode = "martingale" | "fixed" | "dalembert" | "fibonacci";

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "martingale", label: "Martingale", desc: "Double stake after each loss" },
  { id: "fixed", label: "Fixed Stake", desc: "Same stake every trade" },
  { id: "dalembert", label: "D'Alembert", desc: "Increase by 1 unit after loss, decrease by 1 after win" },
  { id: "fibonacci", label: "Fibonacci", desc: "Follow Fibonacci sequence on losses" },
];

function fibonacci(n: number): number[] {
  const seq = [1, 1];
  for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
  return seq.slice(0, n);
}

function buildStakeTable(
  mode: Mode,
  initialStake: number,
  rounds: number,
  multiplier: number
): { round: number; stake: number; totalRisk: number; profitIfWin: number }[] {
  const table: { round: number; stake: number; totalRisk: number; profitIfWin: number }[] = [];
  let cumRisk = 0;
  let prevStake = initialStake;

  const fibSeq = fibonacci(rounds);

  for (let r = 1; r <= rounds; r++) {
    let stake: number;
    if (mode === "martingale") stake = initialStake * Math.pow(multiplier, r - 1);
    else if (mode === "fixed") stake = initialStake;
    else if (mode === "dalembert") stake = initialStake + (r - 1) * (initialStake * 0.5);
    else stake = initialStake * fibSeq[r - 1];

    cumRisk += stake;
    table.push({ round: r, stake, totalRisk: cumRisk, profitIfWin: stake - (cumRisk - stake) });
  }

  return table;
}

function StatBox({ label, value, color = "text-primary", sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
      <div className="text-xs font-bold text-muted-foreground uppercase mb-1">{label}</div>
      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function NumberInput({
  label, value, onChange, min = 0, max = 1000000, step = 1, prefix, suffix
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">{label}</label>
      <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
        {prefix && <span className="px-3 py-2.5 text-sm font-bold text-muted-foreground bg-muted border-r border-border">{prefix}</span>}
        <button onClick={() => onChange(Math.max(min, value - step))} className="px-2.5 py-2.5 hover:bg-muted transition-colors text-muted-foreground">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="flex-1 bg-transparent px-1 py-2 text-center font-mono font-bold text-sm focus:outline-none"
        />
        <button onClick={() => onChange(Math.min(max, value + step))} className="px-2.5 py-2.5 hover:bg-muted transition-colors text-muted-foreground">
          <Plus className="w-3.5 h-3.5" />
        </button>
        {suffix && <span className="px-3 py-2.5 text-sm font-bold text-muted-foreground bg-muted border-l border-border">{suffix}</span>}
      </div>
    </div>
  );
}

export default function RiskCalculator() {
  const [capital, setCapital] = useState(100);
  const [stakePercent, setStakePercent] = useState(2);
  const [profitMultiplier, setProfitMultiplier] = useState(5);
  const [maxLosses, setMaxLosses] = useState(4);
  const [mode, setMode] = useState<Mode>("martingale");
  const [multiplier, setMultiplier] = useState(2);
  const [rounds, setRounds] = useState(6);
  const [payout, setPayout] = useState(0.95); // 95% payout

  const initialStake = useMemo(() => (capital * stakePercent) / 100, [capital, stakePercent]);
  const takeProfit = useMemo(() => initialStake * profitMultiplier, [initialStake, profitMultiplier]);
  const stopLoss = useMemo(() => {
    const table = buildStakeTable(mode, initialStake, maxLosses, multiplier);
    return table.reduce((s, r) => s + r.stake, 0);
  }, [mode, initialStake, maxLosses, multiplier]);

  const stakeTable = useMemo(
    () => buildStakeTable(mode, initialStake, rounds, multiplier),
    [mode, initialStake, rounds, multiplier]
  );

  const maxDrawdownPct = useMemo(() => (stopLoss / capital) * 100, [stopLoss, capital]);
  const breakevenWinrate = useMemo(() => {
    const p = payout;
    return ((1 / (1 + p)) * 100);
  }, [payout]);

  const riskLevel = maxDrawdownPct > 30 ? "HIGH" : maxDrawdownPct > 15 ? "MEDIUM" : "LOW";
  const riskColor = riskLevel === "HIGH" ? "text-red-400" : riskLevel === "MEDIUM" ? "text-yellow-400" : "text-green-400";

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: "linear-gradient(to right,#ef4444,transparent)" }} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" /> Risk Calculator
        </h1>
        <p className="text-muted-foreground text-sm">Martingale, Fixed, D'Alembert, and Fibonacci stake planning</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              mode === m.id
                ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,209,209,0.15)]"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            <div className="font-bold text-sm">{m.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{m.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Inputs */}
        <Card className="bg-card border-border">
          <CardHeader className="py-3 px-5 border-b border-border">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <NumberInput label="Initial Capital ($)" value={capital} onChange={setCapital} min={1} max={1000000} step={10} prefix="$" />
            <NumberInput label="Stake % of Capital" value={stakePercent} onChange={setStakePercent} min={0.1} max={50} step={0.5} suffix="%" />
            <NumberInput label="Take Profit Multiplier" value={profitMultiplier} onChange={setProfitMultiplier} min={1} max={50} step={0.5} suffix="×" />
            <NumberInput label="Max Consecutive Losses" value={maxLosses} onChange={setMaxLosses} min={1} max={20} />
            {mode === "martingale" && (
              <NumberInput label="Martingale Multiplier" value={multiplier} onChange={setMultiplier} min={1.1} max={10} step={0.1} suffix="×" />
            )}
            <NumberInput label="Table Rounds to Show" value={rounds} onChange={setRounds} min={1} max={15} />
            <NumberInput label="Payout Rate" value={payout} onChange={setPayout} min={0.5} max={2} step={0.05} suffix="×" />
          </CardContent>
        </Card>

        {/* Martingale Results */}
        <div className="space-y-4">
          {/* Main calculator card */}
          <Card
            className="border-2 border-primary/30"
            style={{ background: "linear-gradient(135deg, #000d0d 0%, #001a1a 100%)", boxShadow: "0 0 30px rgba(0,209,209,0.1)" }}
          >
            <CardHeader className="py-3 px-5 border-b border-primary/20 text-center">
              <CardTitle className="font-black tracking-widest text-primary text-sm uppercase">
                {MODES.find((m2) => m2.id === mode)?.label.toUpperCase()} CALCULATOR
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="text-center text-xs text-muted-foreground font-mono border border-border rounded p-2">
                Capital: <strong className="text-foreground">${capital.toLocaleString()}</strong>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <StatBox label="Initial Stake" value={`$${initialStake.toFixed(2)}`} sub={`${stakePercent}% of capital`} />
                <StatBox
                  label={`Take Profit (${profitMultiplier}× Stake)`}
                  value={`$${takeProfit.toFixed(2)}`}
                  color="text-green-400"
                  sub={`+${((takeProfit / capital) * 100).toFixed(1)}% of capital`}
                />
                <StatBox
                  label={`Stop Loss (${maxLosses} Losses Sum)`}
                  value={`$${stopLoss.toFixed(2)}`}
                  color="text-red-400"
                  sub={`${maxDrawdownPct.toFixed(1)}% drawdown`}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                <div>
                  <div className="text-xs text-muted-foreground">Risk Level</div>
                  <div className={`font-black text-lg ${riskColor}`}>{riskLevel}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Breakeven Winrate</div>
                  <div className="font-black text-lg font-mono">{breakevenWinrate.toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Remaining after SL</div>
                  <div className={`font-black text-lg font-mono ${capital - stopLoss < 0 ? "text-red-400" : "text-foreground"}`}>
                    ${Math.max(0, capital - stopLoss).toFixed(2)}
                  </div>
                </div>
              </div>

              {maxDrawdownPct > 25 && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-300">High drawdown risk ({maxDrawdownPct.toFixed(1)}%). Consider reducing stake % or max losses.</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-5 border-b border-border">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Risk Management Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>• Never risk more than <span className="text-primary font-bold">2-5%</span> of capital per trade</p>
              <p>• Stop trading after <span className="text-primary font-bold">{maxLosses} consecutive losses</span> to avoid spiral</p>
              <p>• Set take profit at <span className="text-green-400 font-bold">${takeProfit.toFixed(2)}</span> and walk away</p>
              <p>• Breakeven winrate with {(payout * 100).toFixed(0)}% payout = <span className="text-primary font-bold">{breakevenWinrate.toFixed(1)}%</span></p>
              <p>• Daily stop loss = <span className="text-red-400 font-bold">{Math.min(20, maxDrawdownPct * 1.5).toFixed(0)}%</span> of total capital</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stake Table */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-5 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Stake Progression Table · {MODES.find((m2) => m2.id === mode)?.label}
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">{rounds} rounds</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground">Round</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">Stake</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">Cum. Risk</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">Net P/L if Win</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">% of Capital</th>
                </tr>
              </thead>
              <tbody>
                {stakeTable.map((row, i) => {
                  const isOver = row.totalRisk > capital * 0.5;
                  const netPnl = row.stake * payout - (row.totalRisk - row.stake);
                  return (
                    <tr key={i} className={`border-b border-border/50 transition-colors ${isOver ? "bg-red-500/5" : i % 2 === 0 ? "bg-transparent" : "bg-muted/20"}`}>
                      <td className="px-4 py-2.5 font-mono font-bold">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                            isOver ? "bg-red-500 text-white" : "bg-primary/20 text-primary"
                          }`}>
                            {row.round}
                          </div>
                          {i === 0 && <span className="text-[10px] text-muted-foreground">initial</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">${row.stake.toFixed(2)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${isOver ? "text-red-400" : "text-foreground"}`}>
                        ${row.totalRisk.toFixed(2)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {netPnl >= 0 ? "+" : ""}${netPnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground text-xs">
                        {((row.totalRisk / capital) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40">
                  <td colSpan={2} className="px-4 py-3 font-bold text-xs text-muted-foreground">Total if all {rounds} rounds lost</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-red-400">
                    ${stakeTable.reduce((s, r) => s + r.stake, 0).toFixed(2)}
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-right text-xs text-muted-foreground">
                    = {((stakeTable.reduce((s, r) => s + r.stake, 0) / capital) * 100).toFixed(1)}% of capital
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
