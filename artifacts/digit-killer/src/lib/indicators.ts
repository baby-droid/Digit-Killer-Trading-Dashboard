export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isGreen: boolean;
};

export type MacdColor = "dark-green" | "faded-green" | "dark-red" | "faded-red";

export type MacdResult = {
  histogram: number;
  histogramPrev: number;
  macdLine: number;
  signalLine: number;
  color: MacdColor;
  histogramHistory: number[];
  macdHistory: number[];
  signalHistory: number[];
};

export type TsiResult = {
  value: number;
  isFlat: boolean;
  history: number[];
};

export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const emas: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    emas.push(values[i] * k + emas[i - 1] * (1 - k));
  }
  return emas;
}

export function calculateSMA(values: number[], period: number): number[] {
  const smas: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      smas.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      smas.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return smas;
}

export function calculateMACD(prices: number[], fast = 12, slow = 26, signal = 9): MacdResult | null {
  if (prices.length < slow + signal + 2) return null;

  const fastEMA = calculateEMA(prices, fast);
  const slowEMA = calculateEMA(prices, slow);
  const macdLine = fastEMA.map((f, i) => f - slowEMA[i]);

  const macdFromSlow = macdLine.slice(slow - 1);
  if (macdFromSlow.length < signal) return null;

  const signalLine = calculateEMA(macdFromSlow, signal);
  const histogram = macdFromSlow.map((m, i) => (i < signalLine.length ? m - signalLine[i] : 0));

  const len = histogram.length;
  const current = histogram[len - 1] ?? 0;
  const prev = histogram[len - 2] ?? 0;

  let color: MacdColor;
  if (current > 0 && current >= prev) color = "dark-green";
  else if (current > 0 && current < prev) color = "faded-green";
  else if (current <= 0 && current < prev) color = "dark-red";
  else color = "faded-red";

  return {
    histogram: current,
    histogramPrev: prev,
    macdLine: macdFromSlow[macdFromSlow.length - 1],
    signalLine: signalLine[signalLine.length - 1],
    color,
    histogramHistory: histogram.slice(-50),
    macdHistory: macdFromSlow.slice(-50),
    signalHistory: signalLine.slice(-50),
  };
}

export function calculateTSI(prices: number[], r = 25, s = 13): TsiResult | null {
  if (prices.length < r + s + 4) return null;

  const pc: number[] = [];
  const apc: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    pc.push(prices[i] - prices[i - 1]);
    apc.push(Math.abs(prices[i] - prices[i - 1]));
  }

  const smoothed1 = calculateEMA(pc, r);
  const smoothedA1 = calculateEMA(apc, r);
  const smoothed2 = calculateEMA(smoothed1, s);
  const smoothedA2 = calculateEMA(smoothedA1, s);

  const tsiRaw: number[] = smoothedA2.map((denom, i) =>
    denom !== 0 ? 100 * (smoothed2[i] / denom) : 0
  );

  const tsiNorm = tsiRaw.map((v) => Math.max(0, Math.min(1, (v + 100) / 200)));
  const history = tsiNorm.slice(-50);
  const current = tsiNorm[tsiNorm.length - 1];
  const prev = tsiNorm[tsiNorm.length - 2] ?? current;
  const isFlat = Math.abs(current - prev) < 0.005;

  return { value: current, isFlat, history };
}

export function buildCandles(ticks: { price: number; time: number }[]): Candle[] {
  const buckets: Record<number, { open: number; high: number; low: number; close: number; time: number }> = {};

  for (const tick of ticks) {
    const minute = Math.floor(tick.time / 60) * 60;
    if (!buckets[minute]) {
      buckets[minute] = { open: tick.price, high: tick.price, low: tick.price, close: tick.price, time: minute };
    } else {
      const b = buckets[minute];
      if (tick.price > b.high) b.high = tick.price;
      if (tick.price < b.low) b.low = tick.price;
      b.close = tick.price;
    }
  }

  return Object.values(buckets)
    .sort((a, b) => a.time - b.time)
    .map((b) => ({ ...b, isGreen: b.close >= b.open }));
}

export type SmartSignal = {
  prediction: string;
  scenario: string;
  confidence: number;
  matchDigits: number[];
  differDigits: number[];
  entryDigit: number[];
  ticks: string;
  overUnder: "over" | "under" | null;
  threshold: number | null;
};

export function generateSmartSignal(
  candle: Candle | null,
  macd: MacdResult | null,
  tsi: TsiResult | null,
  freqs: number[]
): SmartSignal | null {
  if (!candle || !macd || !tsi) return null;

  const isGreen = candle.isGreen;
  const tsiVal = tsi.value;
  const tsiStrong = tsiVal >= 0.8;
  const tsiFlat = tsi.isFlat;
  const mc = macd.color;

  const sortedDesc = [...freqs.map((f, i) => ({ d: i, f }))].sort((a, b) => b.f - a.f);
  const matchDigits = sortedDesc.slice(0, 3).map((x) => x.d);
  const differDigits = sortedDesc.slice(-3).map((x) => x.d);

  let prediction = "";
  let scenario = "";
  let confidence = 0;
  let overUnder: "over" | "under" | null = null;
  let threshold: number | null = null;
  let entryDigit: number[] = [];
  let ticks = "1-2 ticks";

  if (isGreen && mc === "faded-green" && tsiStrong) {
    prediction = "Over 4 or Over 5";
    scenario = "Green candle + Faded Green MACD + TSI ≥ 0.8";
    confidence = Math.round(70 + (tsiVal - 0.8) * 100);
    overUnder = "over";
    threshold = 4;
    entryDigit = [2, 4];
    ticks = "2-3 ticks";
  } else if (!isGreen && mc === "faded-green" && tsiStrong) {
    prediction = "Over 5";
    scenario = "Red candle + Faded Green MACD + TSI ≥ 0.8";
    confidence = Math.round(65 + (tsiVal - 0.8) * 100);
    overUnder = "over";
    threshold = 5;
    entryDigit = [1, 3, 5];
    ticks = "3-5 ticks";
  } else if (!isGreen && mc === "faded-red" && tsiStrong) {
    prediction = "Over 4";
    scenario = "Red candle + Faded Red MACD + TSI ≥ 0.8";
    confidence = Math.round(65 + (tsiVal - 0.8) * 80);
    overUnder = "over";
    threshold = 4;
    entryDigit = [2, 4];
    ticks = "2-3 ticks";
  } else if (tsiFlat && mc === "dark-red" && !isGreen && tsiStrong) {
    prediction = "Over 6";
    scenario = "TSI Flat + MACD Dark Red + Red Candle + TSI 0.8/0.9";
    confidence = Math.round(75);
    overUnder = "over";
    threshold = 6;
    entryDigit = [4, 2, 0];
    ticks = "2-3 ticks";
  } else if (tsiFlat && mc === "dark-green" && isGreen) {
    prediction = "Over 4 or Over 5";
    scenario = "TSI Flat + MACD Dark Green + Green Candle Forming";
    confidence = Math.round(72);
    overUnder = "over";
    threshold = 4;
    entryDigit = [2, 4];
    ticks = "2-3 ticks";
  } else if (isGreen && mc === "dark-green" && tsiStrong) {
    prediction = "Under 5";
    scenario = "Green candle + Dark Green MACD + TSI ≥ 0.8/0.9";
    confidence = Math.round(68 + (tsiVal - 0.8) * 80);
    overUnder = "under";
    threshold = 5;
    entryDigit = [7, 9];
    ticks = "3-5 ticks";
  } else if ((mc === "faded-green" || mc === "faded-red") && tsiStrong) {
    prediction = "Under 3";
    scenario = "Faded Green/Red MACD + TSI 0.8/0.9 Matches";
    confidence = Math.round(60 + (tsiVal - 0.8) * 60);
    overUnder = "under";
    threshold = 3;
    entryDigit = [7, 8, 9];
    ticks = "2-4 ticks";
  } else {
    prediction = "No Clear Signal";
    scenario = "Waiting for indicator alignment";
    confidence = 0;
    overUnder = null;
    threshold = null;
    entryDigit = [];
    ticks = "—";
  }

  return { prediction, scenario, confidence, matchDigits, differDigits, entryDigit, ticks, overUnder, threshold };
}
