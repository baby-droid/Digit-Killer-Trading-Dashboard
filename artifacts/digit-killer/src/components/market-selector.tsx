import {
  CATEGORY_LABELS,
  MARKETS_BY_CATEGORY,
  type MarketCategory,
  refreshMarketCatalog,
  useDerivWebSocket,
  useMarketList,
} from "@/hooks/useDerivWebSocket";

type MarketSelectorProps = {
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
  testId?: string;
  label?: string;
};

export function MarketSelector({
  value,
  onChange,
  className = "w-full rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2",
  testId = "select-market",
  label = "Select market",
}: MarketSelectorProps) {
  const feed = useDerivWebSocket(value);
  const catalog = useMarketList();
  const historyError = feed.error;
  const historyStatus = catalog.error
    ?? (!catalog.loaded
    ? catalog.error ?? "Checking Deriv’s active market list…"
    : historyError
      ?? (feed.historyLoaded
        ? feed.digits.length < 1000
          ? `${feed.digits.length.toLocaleString()} / 1,000 ticks received · collecting live history`
          : `1,000 tick history ready · ${feed.isConnected ? "live" : "reconnecting"}`
        : feed.historyPhase === "queued"
          ? `${feed.digits.length.toLocaleString()} / 1,000 ticks · queued for history`
          : feed.historyPhase === "loading"
            ? `${feed.digits.length.toLocaleString()} / 1,000 ticks · requesting history`
            : feed.isConnected
              ? `${feed.digits.length.toLocaleString()} / 1,000 ticks · waiting for history response`
              : "Connecting to Deriv’s public market feed…"));
  const retrySymbols = Boolean(catalog.error);

  return (
    <div className="space-y-1.5">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        style={{
          background: "rgba(0,0,0,0.5)",
          border: "1px solid #166534",
          color: "#86efac",
        }}
        data-testid={testId}
      >
        {!MARKETS_BY_CATEGORY[Object.keys(MARKETS_BY_CATEGORY)[0] as MarketCategory]?.some((market) => market.symbol === value)
          && !Object.values(MARKETS_BY_CATEGORY).flat().some((market) => market.symbol === value)
          && (
            <option value={value} key={`unavailable-${value}`}>
              {value} · unavailable
            </option>
          )}
        {(Object.entries(MARKETS_BY_CATEGORY) as [MarketCategory, typeof MARKETS_BY_CATEGORY[MarketCategory]][]).map(([category, markets]) => (
          <optgroup key={category} label={CATEGORY_LABELS[category]}>
            {markets.map((market) => (
              <option key={market.symbol} value={market.symbol} style={{ backgroundColor: "#052e16" }}>
                {market.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="flex min-h-4 items-center justify-between gap-2 text-[10px] font-mono" role="status" data-testid={`status-market-history-${value}`}>
        <span className={feed.historyLoaded && feed.digits.length >= 1000 ? "text-emerald-400" : historyError || catalog.error ? "text-amber-300" : "text-muted-foreground"}>
          {historyStatus}
        </span>
        {(historyError || retrySymbols) && (
          <button
            type="button"
            onClick={retrySymbols ? refreshMarketCatalog : feed.refreshHistory}
            className="shrink-0 rounded border border-amber-400/30 px-2 py-0.5 text-amber-200 transition hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
            data-testid={retrySymbols ? "button-retry-market-catalog" : `button-retry-market-history-${value}`}
          >
            {retrySymbols ? "Retry symbols" : "Retry history"}
          </button>
        )}
      </div>
    </div>
  );
}
