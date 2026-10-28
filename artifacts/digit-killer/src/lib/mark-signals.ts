import { MARKETS } from "@/hooks/useDerivWebSocket";

export type SignalKind =
  | "RISE"
  | "FALL"
  | "EVEN"
  | "ODD"
  | "MATCHES"
  | "DIFFERS"
  | "ONLY_UPS"
  | "ONLY_DOWNS"
  | `OVER_${number}`
  | `UNDER_${number}`;

export type MarkSignal = {
  id: string;
  symbol: string;
  marketName: string;
  kind: SignalKind;
  strength: number;
  attempts: number;
  entry: string;
  rationale: string;
  lastDigit: number | null;
  ticksAnalyzed: number;
};

export type SignalMarketData = {
  isConnected: boolean;
  historyLoaded: boolean;
  error: string | null;
  price: number | null;
  lastDigit: number | null;
  evenOddRatio: number;
  signal: "BUY" | "SELL" | "WAIT";
  digits: number[];
  prices: number[];
  frequencies: number[];
};

const HISTORY_WINDOW = 1000;
const MIN_TICKS = 100;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function suggestedAttempts(strength: number) {
  return clamp(Math.round((strength - 50) / 3.5), 1, 10);
}

function signal(
  symbol: string,
  marketName: string,
  kind: SignalKind,
  strength: number,
  entry: string,
  rationale: string,
  lastDigit: number | null,
  ticksAnalyzed: number,
): MarkSignal {
  const boundedStrength = clamp(Math.round(strength), 50, 85);
  return {
    id: `${symbol}:${kind}`,
    symbol,
    marketName,
    kind,
    strength: boundedStrength,
    attempts: suggestedAttempts(boundedStrength),
    entry,
    rationale,
    lastDigit,
    ticksAnalyzed,
  };
}

function countHits(digits: number[], predicate: (digit: number) => boolean) {
  return digits.filter(predicate).length;
}

/**
 * Build explainable, rules-based candidates from each market's latest 1,000
 * ticks. Strength is a heuristic ranking value, not a win probability.
 */
export function buildMarkSignals(
  marketsData: Record<string, SignalMarketData>,
): MarkSignal[] {
  const results: MarkSignal[] = [];

  for (const market of MARKETS) {
    const data = marketsData[market.symbol];
    if (!data?.historyLoaded || !data.isConnected || data.digits.length < MIN_TICKS) continue;

    const ticks = data.digits.slice(-HISTORY_WINDOW);
    const digits = ticks;
    const prices = data.prices.slice(-HISTORY_WINDOW);
    const count = digits.length;
    const lastDigit = digits[count - 1] ?? null;
    if (count < MIN_TICKS || lastDigit === null) continue;

    const digitCounts = Array.from({ length: 10 }, (_, digit) =>
      countHits(digits, (value) => value === digit),
    );
    const digitRates = digitCounts.map((value) => (value / count) * 100);
    const highDigit = digitRates.indexOf(Math.max(...digitRates));
    const lowDigit = digitRates.indexOf(Math.min(...digitRates));

    const evenRate = (countHits(digits, (digit) => digit % 2 === 0) / count) * 100;
    const oddRate = 100 - evenRate;
    if (evenRate >= 52 && lastDigit % 2 === 1) {
      results.push(signal(
        market.symbol, market.name, "EVEN", 53 + (evenRate - 50) * 1.5,
        `Entry condition met: last digit ${lastDigit} is odd; consider EVEN on the next tick.`,
        `Even digits appeared ${evenRate.toFixed(1)}% of the last ${count} ticks.`,
        lastDigit, count,
      ));
    } else if (oddRate >= 52 && lastDigit % 2 === 0) {
      results.push(signal(
        market.symbol, market.name, "ODD", 53 + (oddRate - 50) * 1.5,
        `Entry condition met: last digit ${lastDigit} is even; consider ODD on the next tick.`,
        `Odd digits appeared ${oddRate.toFixed(1)}% of the last ${count} ticks.`,
        lastDigit, count,
      ));
    }

    if (digitRates[highDigit] >= 12) {
      results.push(signal(
        market.symbol, market.name, "MATCHES", 53 + (digitRates[highDigit] - 10) * 2,
        lastDigit !== highDigit
          ? `Match digit ${highDigit} on the next tick.`
          : `Wait for a digit other than ${highDigit}, then match ${highDigit}.`,
        `Digit ${highDigit} appeared ${digitRates[highDigit].toFixed(1)}% of the last ${count} ticks.`,
        lastDigit, count,
      ));
    }
    if (digitRates[lowDigit] <= 8) {
      results.push(signal(
        market.symbol, market.name, "DIFFERS", 53 + (10 - digitRates[lowDigit]) * 1.5,
        lastDigit === lowDigit
          ? `Enter DIFFERS ${lowDigit} after the cold digit prints.`
          : `Wait for digit ${lowDigit}, then enter DIFFERS ${lowDigit}.`,
        `Digit ${lowDigit} appeared ${digitRates[lowDigit].toFixed(1)}% of the last ${count} ticks.`,
        lastDigit, count,
      ));
    }

    // Compare price direction, not changes in the last digit.
    const recentPrices = prices.slice(-12);
    const directions = recentPrices.slice(1).map((price, index) =>
      price > recentPrices[index] ? 1 : price < recentPrices[index] ? -1 : 0,
    );
    const rises = directions.filter((direction) => direction === 1).length;
    const falls = directions.filter((direction) => direction === -1).length;
    if (rises >= 8) {
      results.push(signal(
        market.symbol, market.name, "RISE", 54 + rises * 2,
        "Wait for the next upward price tick, then consider RISE.",
        `${rises} of the last ${directions.length} price changes were upward.`,
        lastDigit, count,
      ));
    } else if (falls >= 8) {
      results.push(signal(
        market.symbol, market.name, "FALL", 54 + falls * 2,
        "Wait for the next downward price tick, then consider FALL.",
        `${falls} of the last ${directions.length} price changes were downward.`,
        lastDigit, count,
      ));
    }

    const lastFiveDirections = directions.slice(-5);
    if (lastFiveDirections.length === 5 && lastFiveDirections.every((direction) => direction === 1)) {
      results.push(signal(
        market.symbol, market.name, "ONLY_UPS", 65,
        "Only Ups pattern: five consecutive upward price changes; wait for the next tick.",
        "Five consecutive upward changes are a pattern observation, not a guarantee of continuation.",
        lastDigit, count,
      ));
    } else if (lastFiveDirections.length === 5 && lastFiveDirections.every((direction) => direction === -1)) {
      results.push(signal(
        market.symbol, market.name, "ONLY_DOWNS", 65,
        "Only Downs pattern: five consecutive downward price changes; wait for the next tick.",
        "Five consecutive downward changes are a pattern observation, not a guarantee of continuation.",
        lastDigit, count,
      ));
    }

    // Deriv digit contracts use strict barriers: Over n wins above n, and
    // Under n wins below n. The observed historical rate is compared with
    // the uniform-digit baseline only to rank setups, never as a prediction.
    for (let barrier = 1; barrier <= 7; barrier++) {
      const baseline = ((9 - barrier) / 10) * 100;
      const observed = (countHits(digits, (digit) => digit > barrier) / count) * 100;
      const edge = observed - baseline;
      if (edge >= 1.5) {
        results.push(signal(
          market.symbol, market.name, `OVER_${barrier}`, 54 + edge * 1.5,
          lastDigit <= barrier
            ? `Entry condition met: last digit ${lastDigit} is at or below ${barrier}; consider OVER ${barrier}.`
            : `Wait for a digit at or below ${barrier}, then consider OVER ${barrier}.`,
          `Digits above ${barrier} appeared ${observed.toFixed(1)}% in the last ${count} ticks; uniform baseline is ${baseline.toFixed(0)}%.`,
          lastDigit, count,
        ));
      }
    }

    for (let barrier = 1; barrier <= 8; barrier++) {
      const baseline = (barrier / 10) * 100;
      const observed = (countHits(digits, (digit) => digit < barrier) / count) * 100;
      const edge = observed - baseline;
      if (edge >= 1.5) {
        results.push(signal(
          market.symbol, market.name, `UNDER_${barrier}`, 54 + edge * 1.5,
          lastDigit >= barrier
            ? `Entry condition met: last digit ${lastDigit} is at or above ${barrier}; consider UNDER ${barrier}.`
            : `Wait for a digit at or above ${barrier}, then consider UNDER ${barrier}.`,
          `Digits below ${barrier} appeared ${observed.toFixed(1)}% in the last ${count} ticks; uniform baseline is ${baseline.toFixed(0)}%.`,
          lastDigit, count,
        ));
      }
    }
  }

  return results.sort((left, right) =>
    right.strength - left.strength || left.marketName.localeCompare(right.marketName),
  );
}
