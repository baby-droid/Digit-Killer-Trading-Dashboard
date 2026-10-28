export const PATTERN_WINDOWS = [100, 50, 20, 10] as const;

export type UnderBarrier = 4 | 5;
export type PatternWindow = (typeof PATTERN_WINDOWS)[number];

export const UNDER_4_PATTERNS = [
  "u=",
  "ou=",
  "o=",
  "oooooo",
  "ooooou",
  "oooo==",
  "===",
  "===u",
  "oooooou",
  "ooooo=",
] as const;

export const UNDER_5_PATTERNS = [
  "u=",
  "ou=",
  "o=",
  "ooooo",
  "oooou",
  "oooo=",
  "===",
  "==u",
  "oooouu",
  "ooou=o",
] as const;

export type PatternWindowResult = {
  window: PatternWindow;
  samples: number;
  primaryHits: number;
  recoveryHits: number;
  misses: number;
  primaryRate: number | null;
  recoveryRate: number | null;
  combinedRate: number | null;
};

export type PatternPerformance = {
  pattern: string;
  windowResults: PatternWindowResult[];
  averagePerformance: number | null;
  sampleCount: number;
  primaryRate: number | null;
  recoveryRate: number | null;
  meetsSampleGate: boolean;
};

export type UnderBarrierAnalysis = {
  barrier: UnderBarrier;
  patterns: PatternPerformance[];
  bestPattern: PatternPerformance | null;
  currentPattern: PatternPerformance | null;
};

export function classifyDigit(digit: number, barrier: UnderBarrier): "o" | "u" | "=" {
  if (digit < barrier) return "u";
  if (digit > barrier) return "o";
  return "=";
}

function rate(hits: number, samples: number) {
  return samples > 0 ? (hits / samples) * 100 : null;
}

function matchesEndingAt(tokens: string[], endIndex: number, pattern: string) {
  const start = endIndex - pattern.length + 1;
  if (start < 0) return false;
  for (let offset = 0; offset < pattern.length; offset++) {
    if (tokens[start + offset] !== pattern[offset]) return false;
  }
  return true;
}

function analyzeWindow(
  digits: number[],
  tokens: string[],
  barrier: UnderBarrier,
  pattern: string,
  window: PatternWindow,
): PatternWindowResult {
  const windowStart = Math.max(0, digits.length - window);
  const firstEnd = Math.max(pattern.length - 1, windowStart + pattern.length - 1);
  // Eight fully settled follow-up ticks are needed to evaluate the recovery rule.
  const lastEnd = digits.length - 9;
  let samples = 0;
  let primaryHits = 0;
  let recoveryHits = 0;

  for (let endIndex = firstEnd; endIndex <= lastEnd; endIndex++) {
    if (!matchesEndingAt(tokens, endIndex, pattern)) continue;
    samples++;

    const nextThree = digits.slice(endIndex + 1, endIndex + 4);
    const underCount = nextThree.filter((digit) => digit < barrier).length;
    const primaryHit = underCount === 1 || underCount === 2;
    if (primaryHit) {
      primaryHits++;
      continue;
    }

    const recoveryDigits = digits.slice(endIndex + 6, endIndex + 9);
    if (recoveryDigits.some((digit) => digit < barrier)) recoveryHits++;
  }

  const combinedHits = primaryHits + recoveryHits;
  return {
    window,
    samples,
    primaryHits,
    recoveryHits,
    misses: samples - combinedHits,
    primaryRate: rate(primaryHits, samples),
    recoveryRate: rate(recoveryHits, samples),
    combinedRate: rate(combinedHits, samples),
  };
}

function comparePatternPerformance(left: PatternPerformance, right: PatternPerformance) {
  const leftRate = left.averagePerformance ?? -1;
  const rightRate = right.averagePerformance ?? -1;
  if (left.meetsSampleGate !== right.meetsSampleGate) {
    return Number(right.meetsSampleGate) - Number(left.meetsSampleGate);
  }
  if (leftRate !== rightRate) return rightRate - leftRate;
  return right.sampleCount - left.sampleCount;
}

export function analyzeUnderBarrier(digits: number[], barrier: UnderBarrier): UnderBarrierAnalysis {
  const patterns = barrier === 4 ? UNDER_4_PATTERNS : UNDER_5_PATTERNS;
  const tokens = digits.map((digit) => classifyDigit(digit, barrier));
  const results = patterns.map((pattern): PatternPerformance => {
    const windowResults = PATTERN_WINDOWS.map((window) =>
      analyzeWindow(digits, tokens, barrier, pattern, window),
    );
    const observedRates = windowResults
      .map((result) => result.combinedRate)
      .filter((value): value is number => value !== null);
    const sampleCount = windowResults.reduce((sum, result) => sum + result.samples, 0);
    const primaryHits = windowResults.reduce((sum, result) => sum + result.primaryHits, 0);
    const recoveryHits = windowResults.reduce((sum, result) => sum + result.recoveryHits, 0);
    const contributingWindows = windowResults.filter((result) => result.samples > 0).length;
    const recent100Samples = windowResults.find((result) => result.window === 100)?.samples ?? 0;
    const shorterWindowSamples = windowResults
      .filter((result) => result.window < 100)
      .reduce((sum, result) => sum + result.samples, 0);

    return {
      pattern,
      windowResults,
      averagePerformance: observedRates.length
        ? observedRates.reduce((sum, value) => sum + value, 0) / observedRates.length
        : null,
      sampleCount,
      primaryRate: rate(primaryHits, sampleCount),
      recoveryRate: rate(recoveryHits, sampleCount),
      meetsSampleGate: recent100Samples >= 3 && shorterWindowSamples >= 1 && contributingWindows >= 2,
    };
  });

  const rankedPatterns = [...results].sort(comparePatternPerformance);
  const currentMatches = rankedPatterns.filter((result) =>
    matchesEndingAt(tokens, tokens.length - 1, result.pattern),
  );

  return {
    barrier,
    patterns: results,
    bestPattern: rankedPatterns.find((result) => result.averagePerformance !== null) ?? null,
    currentPattern: currentMatches[0] ?? null,
  };
}
