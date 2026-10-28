import { useMemo } from "react";
import { TickData } from "./useDerivWebSocket";
import {
  buildCandles,
  calculateMACD,
  calculateTSI,
  calculateSMA,
  generateSmartSignal,
  Candle,
  MacdResult,
  TsiResult,
  SmartSignal,
} from "@/lib/indicators";

export type SmartTradeData = {
  candles: Candle[];
  currentCandle: Candle | null;
  macd: MacdResult | null;
  tsi: TsiResult | null;
  ma20: number[];
  currentMA20: number | null;
  signal: SmartSignal | null;
  freqs: number[];
  prices: number[];
};

export function useSmartTrade(ticks: TickData[]): SmartTradeData {
  return useMemo(() => {
    const prices = ticks.map((t) => t.price);
    const candles = buildCandles(ticks.map((t) => ({ price: t.price, time: t.time })));
    const closePrices = candles.map((c) => c.close);

    const macd = calculateMACD(prices);
    const tsi = calculateTSI(prices);
    const ma20Raw = calculateSMA(closePrices, 20);
    const ma20 = ma20Raw.filter((v) => !isNaN(v));
    const currentMA20 = ma20.length > 0 ? ma20[ma20.length - 1] : null;

    const currentCandle = candles.length > 0 ? candles[candles.length - 1] : null;

    const freqs = new Array(10).fill(0);
    const last100 = ticks.slice(-100);
    last100.forEach((t) => freqs[t.digit]++);
    const total = last100.length || 1;
    const freqsPct = freqs.map((f) => (f / total) * 100);

    const signal = generateSmartSignal(currentCandle, macd, tsi, freqsPct);

    return {
      candles: candles.slice(-60),
      currentCandle,
      macd,
      tsi,
      ma20: ma20Raw.slice(-60),
      currentMA20,
      signal,
      freqs: freqsPct,
      prices,
    };
  }, [ticks]);
}
