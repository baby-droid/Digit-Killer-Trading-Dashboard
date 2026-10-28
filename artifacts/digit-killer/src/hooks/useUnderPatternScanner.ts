import { useCallback, useMemo, useRef } from "react";
import { useMarketList, type Market } from "@/hooks/useDerivWebSocket";
import { useDerivMultiMarket, type MarketData } from "@/hooks/useDerivMultiMarket";
import {
  analyzeUnderBarrier,
  type PatternPerformance,
  type UnderBarrier,
  type UnderBarrierAnalysis,
} from "@/lib/under-pattern-analysis";

export type MarketPatternAnalyses = {
  under4: UnderBarrierAnalysis;
  under5: UnderBarrierAnalysis;
};

export type UnderPatternScanCandidate = {
  market: Market;
  marketData: MarketData;
  barrier: UnderBarrier;
  pattern: PatternPerformance;
  analysis: UnderBarrierAnalysis;
};

function isUnderScannerMarket(market: Market) {
  if (market.category === "volatility" || market.category === "jump") return true;
  return market.symbol === "RDBEAR"
    || market.symbol === "RDBULL"
    || /^(bear|bull)\b/i.test(market.name);
}

export function useUnderPatternScanner() {
  const marketList = useMarketList();
  const markets = useMemo(
    () => marketList.markets.filter(isUnderScannerMarket),
    [marketList.markets],
  );
  const marketsData = useDerivMultiMarket();
  const cacheRef = useRef(
    new Map<string, { ticks: MarketData["historyTicks"]; analysis: MarketPatternAnalyses }>(),
  );

  const analyses = useMemo(() => {
    const result: Record<string, MarketPatternAnalyses> = {};
    const nextCache = new Map<string, { ticks: MarketData["historyTicks"]; analysis: MarketPatternAnalyses }>();

    for (const market of markets) {
      const marketData = marketsData[market.symbol];
      if (!marketData) continue;

      const cached = cacheRef.current.get(market.symbol);
      const analysis = cached?.ticks === marketData.historyTicks
        ? cached.analysis
        : {
            under4: analyzeUnderBarrier(
              marketData.historyTicks.map((tick) => tick.digit),
              4,
            ),
            under5: analyzeUnderBarrier(
              marketData.historyTicks.map((tick) => tick.digit),
              5,
            ),
          };

      result[market.symbol] = analysis;
      nextCache.set(market.symbol, { ticks: marketData.historyTicks, analysis });
    }

    cacheRef.current = nextCache;
    return result;
  }, [marketsData, markets]);

  const scanCandidates = useCallback((): UnderPatternScanCandidate[] => {
    const candidates: UnderPatternScanCandidate[] = [];

    for (const market of markets) {
      const marketData = marketsData[market.symbol];
      const marketAnalysis = analyses[market.symbol];
      if (
        market.exchangeIsOpen === false ||
        !marketData?.isConnected ||
        !marketData.historyLoaded ||
        marketData.historyCount < 1000 ||
        !marketAnalysis
      ) {
        continue;
      }

      for (const [barrier, analysis] of [
        [4, marketAnalysis.under4],
        [5, marketAnalysis.under5],
      ] as const) {
        if (!analysis.bestPattern) continue;
        candidates.push({
          market,
          marketData,
          barrier,
          pattern: analysis.bestPattern,
          analysis,
        });
      }
    }

    candidates.sort((left, right) => {
      if (left.pattern.meetsSampleGate !== right.pattern.meetsSampleGate) {
        return Number(right.pattern.meetsSampleGate) - Number(left.pattern.meetsSampleGate);
      }
      const rateDifference =
        (right.pattern.averagePerformance ?? -1) - (left.pattern.averagePerformance ?? -1);
      if (rateDifference !== 0) return rateDifference;
      return right.pattern.sampleCount - left.pattern.sampleCount;
    });

    return candidates;
  }, [analyses, markets, marketsData]);

  const scanBestMarket = useCallback(
    (): UnderPatternScanCandidate | null => scanCandidates()[0] ?? null,
    [scanCandidates],
  );

  return {
    markets,
    marketsData,
    analyses,
    scanCandidates,
    scanBestMarket,
  };
}
