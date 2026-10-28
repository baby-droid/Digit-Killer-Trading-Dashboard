import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DerivContractType, DerivTradeRecord } from "@/lib/deriv-session";
import { useDerivSession } from "@/lib/deriv-session";
import { useDerivWebSocket, type TickData } from "@/hooks/useDerivWebSocket";
import { MarketSelector } from "@/components/market-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Check,
  Clock3,
  RotateCcw,
  ShieldCheck,
  Square,
  TrendingUp,
  Zap,
} from "lucide-react";

type TradeChoice =
  | "AI"
  | "MATCHES"
  | "DIFFERS"
  | "OVER"
  | "UNDER"
  | "EVEN"
  | "ODD"
  | "RISE"
  | "FALL"
  | "ONLY_UPS"
  | "ONLY_DOWNS";

type ContractSelection = {
  contractType: DerivContractType;
  barrier?: number;
  description: string;
} | null;

type Signal = {
  title: string;
  detail: string;
  contract: ContractSelection;
  tone: "quiet" | "up" | "down";
};

const palette = {
  page: "#0c1210",
  panel: "#131c17",
  panelRaised: "#18231c",
  border: "#2a3a30",
  text: "#e8efe9",
  muted: "#91a198",
  lime: "#c7ec77",
  green: "#7fcb92",
  red: "#ec887c",
  amber: "#e9bd72",
};

const OPEN_STATUSES = new Set(["proposing", "buying", "open"]);
const TERMINAL_STATUSES = new Set(["won", "lost", "sold", "cancelled"]);

function money(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function contractName(contract: DerivContractType, barrier: number | null) {
  const labels: Record<DerivContractType, string> = {
    DIGITMATCH: "Matches",
    DIGITDIFF: "Differs",
    DIGITOVER: "Over",
    DIGITUNDER: "Under",
    DIGITEVEN: "Even",
    DIGITODD: "Odd",
    CALL: "Rise",
    PUT: "Fall",
  };
  const label = labels[contract];
  return barrier === null ? label : `${label} ${barrier}`;
}

function tradeProfit(trade: DerivTradeRecord) {
  if (trade.profit !== null && Number.isFinite(trade.profit)) return trade.profit;
  if (trade.status === "lost") return -trade.stake;
  if (trade.status === "won" && trade.payout !== null && Number.isFinite(trade.payout)) {
    return trade.payout - trade.stake;
  }
  return 0;
}

function makeSignal(digits: number[], matchBarrier: number): Signal {
  if (digits.length < 20) {
    return {
      title: "Building a live sample",
      detail: `${digits.length} of 20 recent ticks collected. Signal context is informational only.`,
      contract: null,
      tone: "quiet",
    };
  }

  const recent = digits.slice(-20);
  const even = recent.filter((digit) => digit % 2 === 0).length;
  const odd = recent.length - even;
  if (even - odd >= 4) {
    return {
      title: "Even digits lead the recent sample",
      detail: `${even} even / ${odd} odd across the last 20 ticks. This is a descriptive read, not a forecast.`,
      contract: { contractType: "DIGITEVEN", description: "Even" },
      tone: "up",
    };
  }
  if (odd - even >= 4) {
    return {
      title: "Odd digits lead the recent sample",
      detail: `${odd} odd / ${even} even across the last 20 ticks. This is a descriptive read, not a forecast.`,
      contract: { contractType: "DIGITODD", description: "Odd" },
      tone: "down",
    };
  }

  const counts = Array.from({ length: 10 }, (_, digit) => ({
    digit,
    count: recent.filter((value) => value === digit).length,
  }));
  const pressureDigit = [...counts].sort((left, right) => right.count - left.count)[0];
  if (pressureDigit.count >= 5) {
    return {
      title: `Digit ${pressureDigit.digit} is recurring`,
      detail: `${pressureDigit.count} appearances in the last 20 ticks. The AI barrier is derived from this recent sample.`,
      contract: {
        contractType: "DIGITMATCH",
        barrier: matchBarrier,
        description: `Matches ${matchBarrier}`,
      },
      tone: "up",
    };
  }

  return {
    title: "No clear signal in this sample",
    detail: `Even ${even} / odd ${odd} across the last 20 ticks. No contract is suggested right now.`,
    contract: null,
    tone: "quiet",
  };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.muted }}>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color?: string;
}) {
  return (
    <div className="min-w-0 border-l pl-4 first:border-l-0 first:pl-0" style={{ borderColor: palette.border }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: palette.muted }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight" style={{ color: color ?? palette.text }}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-[11px]" style={{ color: palette.muted }}>{note}</div>
    </div>
  );
}

export default function TickTrader() {
  const [selectedMarket, setSelectedMarket] = useState("R_10");
  const [choice, setChoice] = useState<TradeChoice>("AI");
  const [threshold, setThreshold] = useState(5);
  const [stake, setStake] = useState(0.35);
  const [maxStake, setMaxStake] = useState(2);
  const [stopLoss, setStopLoss] = useState(10);
  const [takeProfit, setTakeProfit] = useState(20);
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skippedTicks, setSkippedTicks] = useState(0);
  const [message, setMessage] = useState("");
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
  const lastSeenTickRef = useRef<TickData | null>(null);
  const feedReadyRef = useRef(false);
  const submittingRef = useRef(false);
  const botConfigRef = useRef({ choice, threshold, stake, selectedMarket });

  const {
    digits,
    lastDigit,
    currentPrice,
    isConnected,
    historyLoaded,
  } = useDerivWebSocket(selectedMarket);
  const {
    activeAccount,
    tradeConnectionStatus,
    trades,
    liveTradingArmed,
    liveRiskCaps,
    armLiveTrading,
    setLiveRiskCaps,
    stopAllEntries,
    buyOneTickContract,
  } = useDerivSession();

  const tickDigits = useMemo(() => digits.slice(-100).map((tick) => tick.digit), [digits]);
  const aiBarrier = useMemo(() => {
    if (tickDigits.length === 0) return lastDigit ?? 5;
    const counts = Array.from({ length: 10 }, (_, digit) => tickDigits.filter((item) => item === digit).length);
    const mostCommon = Math.max(...counts);
    const latestMatching = [...tickDigits].reverse().find((digit) => counts[digit] === mostCommon);
    return latestMatching ?? 5;
  }, [tickDigits, lastDigit]);
  const signal = useMemo(() => makeSignal(tickDigits, aiBarrier), [tickDigits, aiBarrier]);

  const accountTrades = useMemo(
    () => trades.filter((trade) =>
      trade.accountId === activeAccount?.account_id && trade.createdAt >= sessionStartedAt,
    ),
    [trades, activeAccount?.account_id, sessionStartedAt],
  );
  const settledTrades = useMemo(
    () => accountTrades.filter((trade) => TERMINAL_STATUSES.has(trade.status)),
    [accountTrades],
  );
  const openTrade = useMemo(
    () => trades.some((trade) =>
      trade.accountId === activeAccount?.account_id && OPEN_STATUSES.has(trade.status),
    ),
    [trades, activeAccount?.account_id],
  );
  const wins = settledTrades.filter((trade) => trade.status === "won").length;
  const losses = settledTrades.filter((trade) => trade.status === "lost").length;
  const sessionPnl = settledTrades.reduce((sum, trade) => sum + tradeProfit(trade), 0);
  const currency = activeAccount?.currency ?? "USD";

  const selection = useMemo<ContractSelection>(() => {
    switch (choice) {
      case "AI":
        return signal.contract;
      case "MATCHES":
        return { contractType: "DIGITMATCH", barrier: aiBarrier, description: `Matches ${aiBarrier}` };
      case "DIFFERS":
        return { contractType: "DIGITDIFF", barrier: aiBarrier, description: `Differs ${aiBarrier}` };
      case "OVER":
        return { contractType: "DIGITOVER", barrier: threshold, description: `Over ${threshold}` };
      case "UNDER":
        return { contractType: "DIGITUNDER", barrier: threshold, description: `Under ${threshold}` };
      case "EVEN":
        return { contractType: "DIGITEVEN", description: "Even" };
      case "ODD":
        return { contractType: "DIGITODD", description: "Odd" };
      case "RISE":
      case "ONLY_UPS":
        return { contractType: "CALL", description: choice === "ONLY_UPS" ? "Only Ups" : "Rise" };
      case "FALL":
      case "ONLY_DOWNS":
        return { contractType: "PUT", description: choice === "ONLY_DOWNS" ? "Only Downs" : "Fall" };
      default:
        return null;
    }
  }, [choice, signal.contract, aiBarrier, threshold]);

  botConfigRef.current = { choice, threshold, stake, selectedMarket };

  const stopBot = (notice?: string) => {
    setBotRunning(false);
    stopAllEntries();
    if (notice) setMessage(notice);
  };

  const submitOrder = async (isAutomated: boolean, triggeredAt?: number) => {
    if (submittingRef.current) {
      if (isAutomated) setSkippedTicks((count) => count + 1);
      else setMessage("An order is already being submitted.");
      return;
    }
    if (!activeAccount) {
      setMessage("Connect a Deriv trading account before placing an order.");
      return;
    }
    if (!isConnected) {
      setMessage("Wait for the selected market feed to reconnect before trading.");
      return;
    }
    if (openTrade) {
      if (isAutomated) setSkippedTicks((count) => count + 1);
      else setMessage("The current one-tick contract must settle before another order.");
      return;
    }
    const current = botConfigRef.current;
    const currentSelection = selection;
    if (!currentSelection) {
      setMessage("The AI signal is waiting. Choose a manual contract or wait for more ticks.");
      return;
    }
    if (!Number.isFinite(current.stake) || current.stake <= 0) {
      setMessage("Enter a stake greater than zero.");
      return;
    }
    if (activeAccount.account_type === "real") {
      if (!liveConfirmed || !liveTradingArmed || !liveRiskCaps) {
        setMessage("For a real account, confirm live trading, apply risk limits, and arm live trading first.");
        return;
      }
      if (current.stake > liveRiskCaps.maxStake) {
        setMessage(`Stake exceeds the active maximum of ${money(liveRiskCaps.maxStake, currency)}.`);
        return;
      }
    }
    if (sessionPnl <= -stopLoss || sessionPnl >= takeProfit) {
      setMessage("A session loss or profit limit has been reached. Reset the session explicitly before trading again.");
      if (isAutomated) stopBot();
      return;
    }
    if (current.stake > maxStake) {
      setMessage(`Stake exceeds your configured maximum of ${money(maxStake, currency)}.`);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setMessage(isAutomated ? "Submitting bot entry…" : "Submitting one-tick order…");
    try {
      const result = await buyOneTickContract({
        symbol: current.selectedMarket,
        contractType: currentSelection.contractType,
        ...(currentSelection.barrier !== undefined ? { barrier: currentSelection.barrier } : {}),
        stake: current.stake,
        ...(triggeredAt !== undefined ? { triggeredAt } : {}),
      });
      setMessage(`Order opened · ${contractName(result.contractType, result.barrier)} · ${result.market}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The order could not be placed.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const submitOrderRef = useRef(submitOrder);
  submitOrderRef.current = submitOrder;

  useEffect(() => {
    setLiveConfirmed(false);
    if (activeAccount?.account_type === "real") armLiveTrading(false);
  }, [activeAccount?.account_id, activeAccount?.account_type, armLiveTrading]);

  useEffect(() => {
    if (!botRunning) return;
    if (!historyLoaded) {
      feedReadyRef.current = false;
      lastSeenTickRef.current = digits[digits.length - 1] ?? null;
      return;
    }
    if (!feedReadyRef.current) {
      lastSeenTickRef.current = digits[digits.length - 1] ?? null;
      feedReadyRef.current = true;
      return;
    }
    const latest = digits[digits.length - 1];
    if (!latest || latest === lastSeenTickRef.current) return;

    const previous = lastSeenTickRef.current;
    const previousIndex = previous ? digits.lastIndexOf(previous) : -1;
    const freshCount = previousIndex >= 0 ? Math.max(1, digits.length - previousIndex - 1) : 1;
    lastSeenTickRef.current = latest;
    if (freshCount > 1) setSkippedTicks((count) => count + freshCount - 1);
    if (submittingRef.current || openTrade) {
      setSkippedTicks((count) => count + 1);
      return;
    }
    if (activeAccount?.account_type === "real" && (!liveConfirmed || !liveTradingArmed || !liveRiskCaps)) {
      setMessage("Bot paused: live confirmation and active risk limits are required.");
      stopBot();
      return;
    }
    if (sessionPnl <= -stopLoss || sessionPnl >= takeProfit) {
      stopBot("Bot stopped at the configured session limit.");
      return;
    }
    void submitOrderRef.current(true, latest.time * 1000);
  }, [
    digits,
    botRunning,
    historyLoaded,
    openTrade,
    activeAccount?.account_type,
    liveConfirmed,
    liveTradingArmed,
    liveRiskCaps,
    sessionPnl,
    stopLoss,
    takeProfit,
  ]);

  useEffect(() => {
    if (!botRunning) return;
    if (sessionPnl <= -stopLoss || sessionPnl >= takeProfit) {
      stopBot("Bot stopped at the configured session limit.");
    }
  }, [botRunning, sessionPnl, stopLoss, takeProfit]);

  const startBot = () => {
    if (!activeAccount) {
      setMessage("Connect a Deriv trading account before starting the bot.");
      return;
    }
    if (!isConnected || !historyLoaded) {
      setMessage("Wait for live market data and its initial history before starting.");
      return;
    }
    if (!selection) {
      setMessage("The selected AI signal is waiting. Choose a contract or wait for a signal.");
      return;
    }
    if (activeAccount.account_type === "real" && (!liveConfirmed || !liveTradingArmed || !liveRiskCaps)) {
      setMessage("Real-account automation requires live confirmation, applied risk limits, and live arming.");
      return;
    }
    if (stake > maxStake || stake <= 0) {
      setMessage("Stake must be greater than zero and within your configured maximum.");
      return;
    }
    if (sessionPnl <= -stopLoss || sessionPnl >= takeProfit) {
      setMessage("A session limit has been reached. Reset the session before starting the bot.");
      return;
    }
    lastSeenTickRef.current = digits[digits.length - 1] ?? null;
    feedReadyRef.current = historyLoaded;
    setSkippedTicks(0);
    setMessage("Bot is armed for new ticks only. Pending or unsettled ticks will be skipped.");
    setBotRunning(true);
  };

  const resetSession = () => {
    stopBot();
    const resetAt = Date.now();
    setSessionStartedAt(resetAt);
    setSkippedTicks(0);
    setMessage("Session counters reset locally. Deriv account history is unchanged.");
    armLiveTrading(false);
    setLiveRiskCaps(null);
  };

  const armRealAccount = () => {
    if (!activeAccount || activeAccount.account_type !== "real") return;
    if (!liveConfirmed) {
      setMessage("Confirm that you understand real-account trades use real funds.");
      return;
    }
    if ([maxStake, stopLoss, takeProfit].some((value) => !Number.isFinite(value) || value <= 0)) {
      setMessage("Maximum stake, stop loss, and take profit must all be greater than zero.");
      return;
    }
    setLiveRiskCaps({ maxStake, stopLoss, takeProfit, sessionStartedAt });
    armLiveTrading(true);
    setMessage("Live limits applied. Review the selected market and stake before starting automation.");
  };

  const handleMarketChange = (symbol: string) => {
    if (botRunning) stopBot("Bot stopped because the selected market changed.");
    setSelectedMarket(symbol);
    lastSeenTickRef.current = null;
    feedReadyRef.current = false;
  };

  const priceText = currentPrice === null
    ? "—"
    : currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 });
  const liveAccount = activeAccount?.account_type === "real";
  const tradeConnected = tradeConnectionStatus === "connected";
  const cardStyle = { backgroundColor: palette.panel, borderColor: palette.border, color: palette.text };
  const selectClass = "border-[#34463a] bg-[#17221b] text-[#e8efe9] focus:ring-[#c7ec77]/40";

  return (
    <main className="min-h-[100dvh] space-y-5 p-4 md:p-6" style={{ backgroundColor: palette.page, color: palette.text }}>
      <header className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-end" style={{ borderColor: palette.border }}>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: palette.lime }}>
            <Activity className="h-3.5 w-3.5" />
            Digit Killer / Live execution
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] md:text-4xl">One-tick trader</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: palette.muted }}>
            Read the live tape, choose a contract, then enter deliberately. Network and API timing varies; the AI signal is informational, not a promise of outcome.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs" style={{ borderColor: palette.border, backgroundColor: palette.panel }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isConnected ? palette.green : palette.amber }} />
            Market {isConnected ? "connected" : "reconnecting"}
          </span>
          <span className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs" style={{ borderColor: palette.border, backgroundColor: palette.panel }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tradeConnected ? palette.green : palette.amber }} />
            Trading {tradeConnected ? "ready" : tradeConnectionStatus}
          </span>
          <span className="rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{
            borderColor: liveAccount ? "rgba(236,136,124,.42)" : "rgba(127,203,146,.35)",
            color: liveAccount ? palette.red : palette.green,
            backgroundColor: liveAccount ? "rgba(236,136,124,.08)" : "rgba(127,203,146,.08)",
          }}>
            {activeAccount ? `${activeAccount.account_type} account` : "No account"}
          </span>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_.8fr]">
        <Card className="overflow-hidden rounded-2xl border shadow-none" style={cardStyle}>
          <CardContent className="p-4 md:p-5">
            <div className="grid gap-5 md:grid-cols-[minmax(210px,.75fr)_1fr] md:items-end">
              <div>
                <FieldLabel>Market</FieldLabel>
                <MarketSelector
                  value={selectedMarket}
                  onChange={handleMarketChange}
                  label="Select trading market"
                  testId="tick-trader-market"
                  className="w-full rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2"
                />
              </div>
              <div className="flex items-end justify-between gap-5">
                <div>
                  <FieldLabel>Live quote</FieldLabel>
                  <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">{priceText}</div>
                  <div className="mt-1 text-xs" style={{ color: palette.muted }}>One tick · {selectedMarket}</div>
                </div>
                <div className="text-right">
                  <FieldLabel>Last digit</FieldLabel>
                  <div className="font-mono text-5xl font-semibold leading-none" style={{ color: palette.lime }}>
                    {lastDigit ?? "–"}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 border-t pt-4" style={{ borderColor: palette.border }}>
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.muted }}>
                <span>Recent digit tape</span>
                <span>{tickDigits.length} sampled</span>
              </div>
              <div className="flex min-h-10 items-center gap-1 overflow-hidden">
                {tickDigits.slice(-18).map((digit, index) => {
                  const latest = index === Math.min(tickDigits.length, 18) - 1;
                  return (
                    <span
                      key={`${index}-${digit}`}
                      className="flex h-8 min-w-8 items-center justify-center rounded-md border font-mono text-xs transition-transform"
                      style={{
                        borderColor: latest ? "rgba(199,236,119,.65)" : palette.border,
                        color: latest ? palette.page : palette.text,
                        backgroundColor: latest ? palette.lime : palette.panelRaised,
                        transform: latest ? "translateY(-2px)" : "translateY(0)",
                      }}
                    >
                      {digit}
                    </span>
                  );
                })}
                {tickDigits.length === 0 && (
                  <div className="w-full rounded-lg border border-dashed px-3 py-2 text-xs" style={{ borderColor: palette.border, color: palette.muted }}>
                    {isConnected ? "Waiting for the first market tick…" : "Connecting to the live market feed…"}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-none" style={cardStyle}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" style={{ color: palette.lime }} /> Signal context</span>
              <span className="rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em]" style={{
                borderColor: signal.tone === "quiet" ? palette.border : signal.tone === "up" ? "rgba(127,203,146,.4)" : "rgba(236,136,124,.4)",
                color: signal.tone === "quiet" ? palette.muted : signal.tone === "up" ? palette.green : palette.red,
              }}>
                {signal.contract ? "Context available" : "Observing"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-lg font-semibold tracking-tight">{signal.title}</div>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: palette.muted }}>{signal.detail}</p>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: palette.border }}>
              <span style={{ color: palette.muted }}>AI digit barrier</span>
              <span className="font-mono font-semibold" style={{ color: palette.lime }}>{aiBarrier}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["EVEN", tickDigits.filter((digit) => digit % 2 === 0).length],
                ["ODD", tickDigits.filter((digit) => digit % 2 !== 0).length],
              ].map(([label, amount]) => (
                <div key={label} className="rounded-lg px-3 py-2" style={{ backgroundColor: palette.panelRaised }}>
                  <div className="text-[9px] font-bold tracking-[0.15em]" style={{ color: palette.muted }}>{label}</div>
                  <div className="mt-1 font-mono text-sm">{amount} <span className="text-[10px]" style={{ color: palette.muted }}>of {tickDigits.length}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(350px,.88fr)]">
        <Card className="rounded-2xl border shadow-none" style={cardStyle}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Entry controls</CardTitle>
              <p className="mt-1 text-xs" style={{ color: palette.muted }}>One contract per click. Every contract expires after one tick.</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(199,236,119,.11)", color: palette.lime }}>
              <Zap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1.3fr_.7fr]">
              <div>
                <FieldLabel>Trade type</FieldLabel>
                <Select value={choice} onValueChange={(value) => setChoice(value as TradeChoice)}>
                  <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                  <SelectContent className="border-[#34463a] bg-[#17221b] text-[#e8efe9]">
                    <SelectItem value="AI">AI signal</SelectItem>
                    <SelectItem value="MATCHES">Matches · AI barrier</SelectItem>
                    <SelectItem value="DIFFERS">Differs · AI barrier</SelectItem>
                    <SelectItem value="OVER">Over · threshold</SelectItem>
                    <SelectItem value="UNDER">Under · threshold</SelectItem>
                    <SelectItem value="EVEN">Even</SelectItem>
                    <SelectItem value="ODD">Odd</SelectItem>
                    <SelectItem value="RISE">Rise</SelectItem>
                    <SelectItem value="FALL">Fall</SelectItem>
                    <SelectItem value="ONLY_UPS">Only Ups</SelectItem>
                    <SelectItem value="ONLY_DOWNS">Only Downs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Threshold · Over / Under</FieldLabel>
                <Select value={String(threshold)} onValueChange={(value) => setThreshold(Number(value))}>
                  <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                  <SelectContent className="border-[#34463a] bg-[#17221b] text-[#e8efe9]">
                    {Array.from({ length: 10 }, (_, digit) => (
                      <SelectItem key={digit} value={String(digit)}>Digit {digit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3" style={{ borderColor: palette.border, backgroundColor: palette.panelRaised }}>
                <FieldLabel>Resolved contract</FieldLabel>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{selection?.description ?? "Waiting for AI signal"}</div>
                  <span className="font-mono text-[10px]" style={{ color: palette.muted }}>
                    {selection?.contractType ?? "—"}
                  </span>
                </div>
                <div className="mt-1 text-[10px]" style={{ color: palette.muted }}>
                  {choice === "MATCHES" || choice === "DIFFERS"
                    ? `AI-selected barrier: ${aiBarrier}`
                    : choice === "OVER" || choice === "UNDER"
                      ? `User threshold: ${threshold}`
                      : "No barrier used for this contract"}
                </div>
              </div>
              <div>
                <FieldLabel>Stake · {currency}</FieldLabel>
                <input
                  aria-label={`Stake in ${currency}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stake}
                  onChange={(event) => setStake(Number(event.target.value))}
                  className="h-10 w-full rounded-md border px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[#c7ec77]/30"
                  style={{ borderColor: palette.border, backgroundColor: palette.panelRaised, color: palette.text }}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Button
                type="button"
                onClick={() => void submitOrder(false)}
                disabled={!selection || !activeAccount || !isConnected || isSubmitting || openTrade}
                className="h-11 rounded-lg font-semibold text-[#16200f] hover:brightness-105"
                style={{ backgroundColor: palette.lime }}
              >
                {isSubmitting ? <Clock3 className="h-4 w-4 animate-pulse" /> : <Zap className="h-4 w-4" />}
                {isSubmitting ? "Submitting…" : "Buy one tick"}
              </Button>
              {!botRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startBot}
                  disabled={!activeAccount || !isConnected || !historyLoaded || isSubmitting}
                  className="h-11 rounded-lg border-[#536447] text-[#d7ecb0] hover:bg-[#c7ec77]/10"
                >
                  <Bot className="h-4 w-4" />
                  Start bot
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => stopBot("Bot stopped. No new entries will be submitted.")}
                  className="h-11 rounded-lg"
                >
                  <Square className="h-4 w-4" />
                  Stop bot
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={resetSession}
                className="h-11 rounded-lg border-[#34463a] px-3 text-[#bcc8bf] hover:bg-white/5"
                title="Reset local session counters"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sm:hidden">Reset</span>
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" style={{
              borderColor: botRunning ? "rgba(199,236,119,.38)" : palette.border,
              backgroundColor: botRunning ? "rgba(199,236,119,.06)" : palette.panelRaised,
            }}>
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: botRunning ? palette.lime : palette.muted }} />
                <span className="font-semibold">{botRunning ? "Bot running" : "Bot off"}</span>
                <span style={{ color: palette.muted }}>· {skippedTicks} ticks skipped while unavailable</span>
              </div>
              <span className="text-[10px]" style={{ color: palette.muted }}>
                New ticks only · never queues missed entries
              </span>
            </div>
            {message && (
              <div role="status" className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed" style={{
                borderColor: message.toLowerCase().includes("error") || message.toLowerCase().includes("exceed") ? "rgba(236,136,124,.35)" : palette.border,
                color: palette.muted,
                backgroundColor: "rgba(255,255,255,.025)",
              }}>
                <span className="mt-0.5 shrink-0" style={{ color: palette.lime }}><Check className="h-3.5 w-3.5" /></span>
                {message}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-none" style={cardStyle}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" style={{ color: palette.lime }} />
              Session risk & controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Max stake", value: maxStake, setter: setMaxStake },
                { label: "Stop loss", value: stopLoss, setter: setStopLoss },
                { label: "Take profit", value: takeProfit, setter: setTakeProfit },
              ].map((item) => (
                <label key={item.label} className="block">
                  <FieldLabel>{item.label}</FieldLabel>
                  <input
                    aria-label={`${item.label} in ${currency}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.value}
                    onChange={(event) => item.setter(Number(event.target.value))}
                    className="h-9 w-full rounded-md border px-2 font-mono text-xs outline-none focus:ring-2 focus:ring-[#c7ec77]/30"
                    style={{ borderColor: palette.border, backgroundColor: palette.panelRaised, color: palette.text }}
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: palette.border, backgroundColor: palette.panelRaised }}>
              <div>
                <div className="text-xs font-semibold">Live account safeguard</div>
                <div className="mt-1 text-[10px]" style={{ color: palette.muted }}>
                  {liveAccount
                    ? liveTradingArmed
                      ? `Armed · max ${money(liveRiskCaps?.maxStake, currency)} · stop ${money(liveRiskCaps?.stopLoss, currency)} · target ${money(liveRiskCaps?.takeProfit, currency)}`
                      : "Confirm, then apply limits and arm before any live order"
                    : "Real-account confirmation is required before live orders"}
                </div>
              </div>
              <span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase" style={{
                color: liveAccount && liveTradingArmed ? palette.green : palette.muted,
                backgroundColor: liveAccount && liveTradingArmed ? "rgba(127,203,146,.1)" : "rgba(255,255,255,.05)",
              }}>
                {liveAccount && liveTradingArmed ? "Armed" : "Protected"}
              </span>
            </div>
            {liveAccount && (
              <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed" style={{ color: palette.muted }}>
                <input
                  type="checkbox"
                  checked={liveConfirmed}
                  onChange={(event) => setLiveConfirmed(event.target.checked)}
                  className="mt-0.5 accent-[#c7ec77]"
                />
                I understand this is a real account and orders can use real funds.
              </label>
            )}
            {liveAccount && (
              <Button
                type="button"
                variant={liveTradingArmed ? "secondary" : "outline"}
                onClick={armRealAccount}
                disabled={!liveConfirmed}
                className="w-full rounded-lg border-[#536447] text-[#d7ecb0] hover:bg-[#c7ec77]/10"
              >
                <ShieldCheck className="h-4 w-4" />
                {liveTradingArmed ? "Apply limits & keep live armed" : "Apply limits & arm live trading"}
              </Button>
            )}
            <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-relaxed" style={{ color: palette.muted }}>
              <div className="mb-1 flex items-center gap-1.5 font-semibold" style={{ color: palette.amber }}>
                <AlertTriangle className="h-3.5 w-3.5" />
                Local session controls
              </div>
              Limits are checked before entries. Reset clears only this page’s counters and starts a new local risk window; it does not delete Deriv account history.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <Card className="rounded-2xl border shadow-none" style={cardStyle}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Session summary</CardTitle>
              <p className="mt-1 text-xs" style={{ color: palette.muted }}>Derived from this account’s session trades.</p>
            </div>
            <span className="text-[10px] font-mono" style={{ color: palette.muted }}>
              {settledTrades.length} settled
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
              <Metric label="Wins" value={String(wins)} note="settled" color={palette.green} />
              <Metric label="Losses" value={String(losses)} note="settled" color={palette.red} />
              <Metric label="Net P&L" value={money(sessionPnl, currency)} note="realized only" color={sessionPnl >= 0 ? palette.green : palette.red} />
              <Metric label="Open" value={openTrade ? "1" : "0"} note={openTrade ? "settlement pending" : "no pending trade"} />
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-3 text-[10px]" style={{ borderColor: palette.border, color: palette.muted }}>
              <span>Session started {new Date(sessionStartedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span>Risk window: {money(stopLoss, currency)} / {money(takeProfit, currency)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border shadow-none" style={cardStyle}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Trade log</CardTitle>
              <p className="mt-1 text-xs" style={{ color: palette.muted }}>Session records received from the Deriv trading connection.</p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: palette.muted }}>
              <Clock3 className="h-3 w-3" /> Live updates
            </span>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {accountTrades.length === 0 ? (
              <div className="mx-5 mb-5 rounded-xl border border-dashed px-4 py-7 text-center" style={{ borderColor: palette.border, color: palette.muted }}>
                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: palette.panelRaised }}>
                  <Activity className="h-4 w-4" />
                </div>
                <div className="text-sm font-medium" style={{ color: palette.text }}>No trades in this session</div>
                <div className="mt-1 text-xs">Executed and settled contracts will appear here.</div>
              </div>
            ) : (
              <div className="max-h-[340px] overflow-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                  <thead className="sticky top-0" style={{ backgroundColor: palette.panelRaised, color: palette.muted }}>
                    <tr className="text-[9px] uppercase tracking-[0.14em]">
                      <th className="px-5 py-2.5 font-semibold">Time</th>
                      <th className="px-3 py-2.5 font-semibold">Contract</th>
                      <th className="px-3 py-2.5 font-semibold">Stake</th>
                      <th className="px-3 py-2.5 font-semibold">Result</th>
                      <th className="px-5 py-2.5 text-right font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...accountTrades].sort((left, right) => right.createdAt - left.createdAt).map((trade) => {
                      const terminal = TERMINAL_STATUSES.has(trade.status);
                      const pnl = terminal ? tradeProfit(trade) : null;
                      const statusColor = trade.status === "won" ? palette.green : trade.status === "lost" ? palette.red : palette.amber;
                      return (
                        <tr key={trade.id} className="border-t" style={{ borderColor: palette.border }}>
                          <td className="px-5 py-3 font-mono text-[10px]" style={{ color: palette.muted }}>
                            {new Date(trade.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{contractName(trade.contractType, trade.barrier)}</div>
                            <div className="mt-0.5 font-mono text-[9px]" style={{ color: palette.muted }}>{trade.market} · {trade.accountType}</div>
                          </td>
                          <td className="px-3 py-3 font-mono">{money(trade.stake, currency)}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase" style={{ color: statusColor, backgroundColor: `${statusColor}14` }}>
                              {trade.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-mono" style={{ color: pnl === null ? palette.muted : pnl >= 0 ? palette.green : palette.red }}>
                            {pnl === null ? "Pending" : money(pnl, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      <footer className="flex flex-col gap-2 border-t pt-4 text-[10px] leading-relaxed sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: palette.border, color: palette.muted }}>
        <span>One-tick orders may settle before the next update arrives. A pending contract blocks additional entries.</span>
        <span className="flex items-center gap-1.5"><ArrowUpRight className="h-3 w-3" /><ArrowDownRight className="h-3 w-3" /> Rise and Fall use directional contracts.</span>
      </footer>
    </main>
  );
}
