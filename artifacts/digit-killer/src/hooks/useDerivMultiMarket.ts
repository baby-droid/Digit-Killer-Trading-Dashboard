import { useEffect, useState } from "react";
import {
  getMarketFeedSnapshot,
  useMarketList,
  subscribeToMarket,
} from "./useDerivWebSocket";

export type MarketData = {
  isConnected: boolean;
  historyLoaded: boolean;
  historyPhase: "idle" | "queued" | "loading" | "loaded";
  error: string | null;
  price: number | null;
  lastDigit: number | null;
  pipSize: number;
  evenOddRatio: number;
  signal: "BUY" | "SELL" | "WAIT";
  digits: number[];
  prices: number[];
  frequencies: number[];
  historyCount: number;
  historyTicks: ReturnType<typeof getMarketFeedSnapshot>["digits"];
};

export function useDerivMultiMarket() {
  const { markets } = useMarketList();
  const [marketsData, setMarketsData] = useState<Record<string, MarketData>>(() =>
    markets.reduce((acc, market) => {
      acc[market.symbol] = marketDataFor(market.symbol);
      return acc;
    }, {} as Record<string, MarketData>)
  );

  useEffect(() => {
    const unsubscribers = markets.map((market) =>
      subscribeToMarket(market.symbol, () => {
        const data = marketDataFor(market.symbol);
        setMarketsData((previous) => ({ ...previous, [market.symbol]: data }));
      }, 0)
    );
    setMarketsData(
      markets.reduce((next, market) => {
        next[market.symbol] = marketDataFor(market.symbol);
        return next;
      }, {} as Record<string, MarketData>)
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [markets]);

  return marketsData;
}

function marketDataFor(symbol: string): MarketData {
  const snapshot = getMarketFeedSnapshot(symbol);
  const ticks = snapshot.digits.slice(-1000);
  const digits = ticks.map((tick) => tick.digit);
  const counts = new Array(10).fill(0);
  let evens = 0;

  digits.forEach((digit) => {
    counts[digit]++;
    if (digit % 2 === 0) evens++;
  });

  const total = digits.length || 1;
  const evenOddRatio = digits.length ? Math.round((evens / total) * 100) : 50;
  let signal: MarketData["signal"] = "WAIT";
  if (evenOddRatio > 70) signal = "BUY";
  else if (evenOddRatio < 30) signal = "SELL";

  return {
    isConnected: snapshot.isConnected,
    historyLoaded: snapshot.historyLoaded,
    historyPhase: snapshot.historyPhase,
    error: snapshot.error,
    price: ticks[ticks.length - 1]?.price ?? null,
    lastDigit: digits[digits.length - 1] ?? null,
    pipSize: snapshot.pipSize,
    evenOddRatio,
    signal,
    digits,
    prices: ticks.map((tick) => tick.price),
    frequencies: counts.map((count) => (count / total) * 100),
    historyCount: snapshot.digits.length,
    historyTicks: snapshot.digits.slice(-120),
  };
}
