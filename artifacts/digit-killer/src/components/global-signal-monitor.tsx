import { useEffect, useRef } from "react";
import { useMarket } from "@/lib/market-context";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { playBuySound, playWarnSound } from "@/lib/sound";

type SignalState = "BUY" | "WARN" | "WAIT";

function detectSignal(digits: number[]): SignalState {
  if (digits.length < 20) return "WAIT";

  const last100 = digits.slice(-100);
  const last10  = digits.slice(-10);
  const total   = last100.length;

  const evenCount = last100.filter(d => d % 2 === 0).length;
  const evenPct   = (evenCount / total) * 100;
  const oddPct    = 100 - evenPct;

  const r10Even    = last10.filter(d => d % 2 === 0).length;
  const r10EvenPct = (r10Even / last10.length) * 100;

  if (r10EvenPct >= 80 || r10EvenPct <= 20) return "WARN";

  const last8EO = last10.map(d => d % 2 === 0 ? "E" : "O").join("");
  let alts = 0;
  for (let k = 1; k < last8EO.length; k++) {
    if (last8EO[k] !== last8EO[k - 1]) alts++;
  }
  if (alts >= 8) return "WARN";

  const domPct = Math.max(evenPct, oddPct);
  if (domPct >= 60) {
    const eoArr = digits.slice(-30).map(d => d % 2 === 0 ? "E" : "O");
    const eStr  = eoArr.join("");
    if (
      /O{3,5}E{2,3}$/.test(eStr) ||
      /E{3,5}O{2,3}$/.test(eStr) ||
      eStr.slice(-3) === "OEE"   ||
      eStr.slice(-3) === "EOO"
    ) {
      return "BUY";
    }
  }

  if (domPct >= 65) return "BUY";

  return "WAIT";
}

function MarketMonitor({ market }: { market: string }) {
  const { digits } = useDerivWebSocket(market);
  const prevRef    = useRef<SignalState>("WAIT");
  const cooldownRef = useRef<number>(0);

  useEffect(() => {
    if (digits.length < 20) return;

    const now = Date.now();
    if (now - cooldownRef.current < 15_000) return;

    const digitArr  = digits.map(d => d.digit);
    const newSignal = detectSignal(digitArr);

    if (newSignal !== prevRef.current) {
      if (newSignal === "BUY") {
        playBuySound();
        cooldownRef.current = now;
      } else if (newSignal === "WARN") {
        playWarnSound();
        cooldownRef.current = now;
      }
      prevRef.current = newSignal;
    }
  }, [digits]);

  return null;
}

export function GlobalSignalMonitor() {
  const { activeMarket } = useMarket();
  return <MarketMonitor key={activeMarket} market={activeMarket} />;
}
