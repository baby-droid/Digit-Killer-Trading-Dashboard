import type { Market } from "@/hooks/useDerivWebSocket";

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

export type SignalClassification = "WATCH" | "SETUP" | "STRONG" | "ELITE";

export type WindowCheck = {
  size: number;
  rate: number;
  baseline: number;
  aligned: boolean;
};

export type MarkSignal = {
  id: string;
  symbol: string;
  marketName: string;
  kind: SignalKind;
  strength: number;
  classification: SignalClassification;
  ready: boolean;
  runs: number;
  entry: string;
  rationale: string;
  lastDigit: number | null;
  ticksAnalyzed: number;
  alignedWindows: number;
  windowChecks: WindowCheck[];
  pattern: string;
  momentum: number;
  noise: number;
};

export type SignalMarketData = {
  isConnected: boolean;
  historyLoaded: boolean;
  historyPhase: "idle" | "queued" | "loading" | "loaded";
  error: string | null;
  price: number | null;
  lastDigit: number | null;
  evenOddRatio: number;
  signal: "BUY" | "SELL" | "WAIT";
  digits: number[];
  prices: number[];
  frequencies: number[];
};

const WINDOW_SIZES = [1000, 100, 50, 20, 10] as const;
const MIN_ALIGNED_WINDOWS = 3;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function countRate(values: number[], predicate: (value: number) => boolean) {
  return values.length ? (values.filter(predicate).length / values.length) * 100 : 0;
}

function getWindowValues(values: number[], size: number) {
  return values.slice(-size);
}

function getRank(values: number[], index: number, descending = true) {
  const target = values[index];
  return values.filter((value) => (descending ? value > target : value < target)).length + 1;
}

function getNoise(checks: WindowCheck[]) {
  if (checks.length < 2) return 0;
  const mean = checks.reduce((sum, check) => sum + check.rate, 0) / checks.length;
  const variance = checks.reduce((sum, check) => sum + (check.rate - mean) ** 2, 0) / checks.length;
  return Math.sqrt(variance);
}

function getPattern(digits: number[]) {
  const recent = digits.slice(-5);
  if (recent.length === 5 && recent.every((digit) => digit === recent[0])) {
    return `Digit ${recent[0]} repeated five times`;
  }
  const parity = recent.map((digit) => digit % 2 === 0 ? "E" : "O").join("");
  if (parity === "EOEOE" || parity === "OEOEO") return "Alternating parity";
  return "No clear short pattern";
}

function getMomentum(prices: number[]) {
  const recent = prices.slice(-11);
  if (recent.length < 2) return 0;
  const changes = recent.slice(1).map((price, index) =>
    price > recent[index] ? 1 : price < recent[index] ? -1 : 0,
  );
  const directional = changes.filter((change) => change !== 0);
  return directional.length
    ? Math.round((directional.filter((change) => change > 0).length / directional.length) * 100)
    : 50;
}

function classificationFor(score: number): SignalClassification {
  if (score >= 85) return "ELITE";
  if (score >= 75) return "STRONG";
  if (score >= 65) return "SETUP";
  return "WATCH";
}

function createSignal(args: {
  market: Market;
  kind: SignalKind;
  checks: WindowCheck[];
  lastDigit: number;
  count: number;
  ready: boolean;
  entryNow: string;
  entryWait: string;
  digits: number[];
  prices: number[];
}): MarkSignal | null {
  const alignedWindows = args.checks.filter((check) => check.aligned).length;
  if (alignedWindows < MIN_ALIGNED_WINDOWS) return null;

  const averageEdge = args.checks.reduce(
    (sum, check) => sum + Math.max(0, check.rate - check.baseline),
    0,
  ) / args.checks.length;
  const strength = clamp(Math.round(20 + alignedWindows * 12 + Math.min(averageEdge * 1.6, 20)), 0, 100);
  if (strength < 50) return null;

  const classification = classificationFor(strength);
  const momentum = getMomentum(args.prices);
  const runs = clamp(Math.round((strength - 35) / 4), 3, 15);

  return {
    id: `${args.market.symbol}:${args.kind}`,
    symbol: args.market.symbol,
    marketName: args.market.name,
    kind: args.kind,
    strength,
    classification,
    ready: alignedWindows === WINDOW_SIZES.length && args.ready,
    runs,
    entry: alignedWindows === WINDOW_SIZES.length && args.ready ? args.entryNow : args.entryWait,
    rationale: `${alignedWindows}/5 windows align. This is a historical pattern score, not a probability.`,
    lastDigit: args.lastDigit,
    ticksAnalyzed: args.count,
    alignedWindows,
    windowChecks: args.checks,
    pattern: getPattern(args.digits),
    momentum,
    noise: Math.round(getNoise(args.checks) * 10) / 10,
  };
}

function makeDigitChecks(
  windows: number[][],
  target: number,
  side: "over" | "under" | "matches" | "differs" | "parity",
): WindowCheck[] {
  return windows.map((values, index) => {
    let rate = 0;
    let baseline = 0;
    let aligned = false;

    if (side === "over") {
      baseline = ((9 - target) / 10) * 100;
      rate = countRate(values, (digit) => digit > target);
      aligned = rate >= baseline + (index === 0 ? 1 : 0);
    } else if (side === "under") {
      baseline = (target / 10) * 100;
      rate = countRate(values, (digit) => digit < target);
      aligned = rate >= baseline + (index === 0 ? 1 : 0);
    } else if (side === "parity") {
      baseline = 50;
      rate = countRate(values, (digit) => target === 0 ? digit % 2 === 0 : digit % 2 === 1);
      aligned = rate > baseline + (index === 0 ? 0.25 : 0);
    } else {
      baseline = side === "matches" ? 10 : 90;
      rate = countRate(
        values,
        (digit) => side === "matches" ? digit === target : digit !== target,
      );
      const counts = Array.from({ length: 10 }, (_, digit) =>
        countRate(values, (value) => value === digit),
      );
      const rank = getRank(counts, target, true);
      const preferredRank = index >= 3 ? 2 : 3;
      aligned = side === "matches"
        ? rank <= preferredRank && rate >= baseline
        : rank >= 11 - preferredRank && rate >= baseline;
    }

    return { size: WINDOW_SIZES[index], rate, baseline, aligned };
  });
}

function priceChecks(prices: number[], direction: "rise" | "fall") {
  return WINDOW_SIZES.map((size, index) => {
    const window = getWindowValues(prices, size);
    const changes = window.slice(1).map((price, changeIndex) =>
      price > window[changeIndex] ? 1 : price < window[changeIndex] ? -1 : 0,
    );
    const directional = changes.filter((change) => change !== 0);
    const rate = directional.length
      ? (directional.filter((change) => direction === "rise" ? change > 0 : change < 0).length / directional.length) * 100
      : 0;
    const baseline = 50;
    return {
      size,
      rate,
      baseline,
      aligned: rate > baseline + (index === 0 ? 1 : 0),
    };
  });
}

function addParitySignals(
  results: MarkSignal[],
  market: Market,
  digits: number[],
  prices: number[],
) {
  const windows = WINDOW_SIZES.map((size) => getWindowValues(digits, size));
  const lastDigit = digits[digits.length - 1];
  for (const [kind, target] of [["EVEN", 0], ["ODD", 1]] as const) {
    const checks = makeDigitChecks(windows, target, "parity");
    const ready = lastDigit % 2 !== target;
    const candidate = createSignal({
      market, kind, checks, lastDigit, count: digits.length, ready,
      entryNow: `Enter ${kind} on the next valid tick; recheck the pattern after every tick.`,
      entryWait: `Wait for a ${kind === "EVEN" ? "odd" : "even"} digit, then recheck before entry.`,
      digits, prices,
    });
    if (candidate) results.push(candidate);
  }
}

function addOverUnderSignals(
  results: MarkSignal[],
  market: Market,
  digits: number[],
  prices: number[],
) {
  const windows = WINDOW_SIZES.map((size) => getWindowValues(digits, size));
  const lastDigit = digits[digits.length - 1];
  for (let barrier = 1; barrier <= 7; barrier += 1) {
    const checks = makeDigitChecks(windows, barrier, "over");
    const candidate = createSignal({
      market, kind: `OVER_${barrier}`, checks, lastDigit, count: digits.length,
      ready: lastDigit <= barrier,
      entryNow: `Enter OVER ${barrier} on the next valid tick; recheck the setup every tick.`,
      entryWait: `Wait for a digit at or below ${barrier}, then recheck before entry.`,
      digits, prices,
    });
    if (candidate) results.push(candidate);
  }
  for (let barrier = 1; barrier <= 8; barrier += 1) {
    const checks = makeDigitChecks(windows, barrier, "under");
    const candidate = createSignal({
      market, kind: `UNDER_${barrier}`, checks, lastDigit, count: digits.length,
      ready: lastDigit >= barrier,
      entryNow: `Enter UNDER ${barrier} on the next valid tick; recheck the setup every tick.`,
      entryWait: `Wait for a digit at or above ${barrier}, then recheck before entry.`,
      digits, prices,
    });
    if (candidate) results.push(candidate);
  }
}

function addMatchSignals(
  results: MarkSignal[],
  market: Market,
  digits: number[],
  prices: number[],
  side: "matches" | "differs",
) {
  const windows = WINDOW_SIZES.map((size) => getWindowValues(digits, size));
  const lastDigit = digits[digits.length - 1];
  for (let target = 0; target <= 9; target += 1) {
    const checks = makeDigitChecks(windows, target, side);
    const candidate = createSignal({
      market,
      kind: side === "matches" ? "MATCHES" : "DIFFERS",
      checks,
      lastDigit,
      count: digits.length,
      ready: side === "matches" ? lastDigit !== target : lastDigit === target,
      entryNow: side === "matches"
        ? `Enter MATCHES ${target} on the next valid tick; recheck the setup every tick.`
        : `Enter DIFFERS ${target} on the next valid tick; recheck the setup every tick.`,
      entryWait: side === "matches"
        ? `Wait for a different digit, then recheck MATCHES ${target}.`
        : `Wait for digit ${target}, then recheck DIFFERS ${target}.`,
      digits,
      prices,
    });
    if (candidate) results.push(candidate);
  }
}

function addTrendSignals(
  results: MarkSignal[],
  market: Market,
  digits: number[],
  prices: number[],
) {
  const lastDigit = digits[digits.length - 1];
  for (const [kind, direction] of [["RISE", "rise"], ["FALL", "fall"]] as const) {
    const checks = priceChecks(prices, direction);
    const last = prices.slice(-6);
    const isMoving = last.length === 6 && (direction === "rise"
      ? last.every((price, index) => index === 0 || price >= last[index - 1])
      : last.every((price, index) => index === 0 || price <= last[index - 1]));
    const candidate = createSignal({
      market, kind, checks, lastDigit, count: digits.length, ready: isMoving,
      entryNow: `Enter ${kind} only on a confirming price move; reassess each tick.`,
      entryWait: `Wait for a confirming ${direction === "rise" ? "up" : "down"} price move.`,
      digits, prices,
    });
    if (candidate) results.push(candidate);
  }

  const recent = prices.slice(-6);
  if (recent.length !== 6) return;
  const changes = recent.slice(1).map((price, index) =>
    price > recent[index] ? 1 : price < recent[index] ? -1 : 0,
  );
  if (changes.every((change) => change === 1)) {
    const checks = priceChecks(prices, "rise");
    const candidate = createSignal({
      market, kind: "ONLY_UPS", checks, lastDigit, count: digits.length, ready: true,
      entryNow: "Only Ups pattern: six consecutive upward price moves; reassess after each tick.",
      entryWait: "Wait for the Only Ups pattern to reform and recheck all windows.",
      digits, prices,
    });
    if (candidate) results.push(candidate);
  } else if (changes.every((change) => change === -1)) {
    const checks = priceChecks(prices, "fall");
    const candidate = createSignal({
      market, kind: "ONLY_DOWNS", checks, lastDigit, count: digits.length, ready: true,
      entryNow: "Only Downs pattern: six consecutive downward price moves; reassess after each tick.",
      entryWait: "Wait for the Only Downs pattern to reform and recheck all windows.",
      digits, prices,
    });
    if (candidate) results.push(candidate);
  }
}

/**
 * Signals are only ranked after a complete 1,000-tick baseline is available.
 * Every candidate must also align on 100, 50, 20 and 10 ticks. Scores classify
 * rule alignment; they are not win probabilities or promises of a next result.
 */
export function buildMarkSignals(
  marketsData: Record<string, SignalMarketData>,
  markets: Market[],
): MarkSignal[] {
  const results: MarkSignal[] = [];

  for (const market of markets) {
    if (market.exchangeIsOpen === false) continue;
    const data = marketsData[market.symbol];
    if (!data?.historyLoaded || !data.isConnected || data.digits.length < WINDOW_SIZES[0]) continue;

    const digits = data.digits.slice(-WINDOW_SIZES[0]);
    const prices = data.prices.slice(-WINDOW_SIZES[0]);
    if (digits.some((digit) => !Number.isInteger(digit) || digit < 0 || digit > 9)) continue;
    if (prices.length < WINDOW_SIZES[0]) continue;

    addParitySignals(results, market, digits, prices);
    addOverUnderSignals(results, market, digits, prices);
    addMatchSignals(results, market, digits, prices, "matches");
    addMatchSignals(results, market, digits, prices, "differs");
    addTrendSignals(results, market, digits, prices);
  }

  return results.sort((left, right) =>
    right.strength - left.strength
    || right.alignedWindows - left.alignedWindows
    || left.marketName.localeCompare(right.marketName),
  );
}
