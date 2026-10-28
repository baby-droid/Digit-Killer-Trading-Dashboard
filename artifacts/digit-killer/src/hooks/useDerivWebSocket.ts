import { useCallback, useSyncExternalStore } from "react";

export type TickData = {
  price: number;
  digit: number;
  time: number;
};

export type MarketCategory =
  | "volatility"
  | "crash_boom"
  | "jump"
  | "bear_bull"
  | "forex"
  | "indices"
  | "commodities"
  | "cryptocurrencies"
  | "stocks"
  | "other";

export type Market = {
  name: string;
  symbol: string;
  category: MarketCategory;
  pipSize?: number;
  exchangeIsOpen?: boolean;
};

const CURATED_MARKETS_BY_CATEGORY: Record<MarketCategory, Market[]> = {
  volatility: [
    { name: "Vol 10",   symbol: "R_10",     category: "volatility", pipSize: 3 },
    { name: "Vol 25",   symbol: "R_25",     category: "volatility", pipSize: 3 },
    { name: "Vol 50",   symbol: "R_50",     category: "volatility", pipSize: 4 },
    { name: "Vol 75",   symbol: "R_75",     category: "volatility", pipSize: 4 },
    { name: "Vol 100",  symbol: "R_100",    category: "volatility", pipSize: 2 },
    { name: "1s V10",   symbol: "1HZ10V",   category: "volatility", pipSize: 3 },
    { name: "1s V15",   symbol: "1HZ15V",   category: "volatility", pipSize: 3 },
    { name: "1s V25",   symbol: "1HZ25V",   category: "volatility", pipSize: 3 },
    { name: "1s V30",   symbol: "1HZ30V",   category: "volatility", pipSize: 3 },
    { name: "1s V50",   symbol: "1HZ50V",   category: "volatility", pipSize: 4 },
    { name: "1s V75",   symbol: "1HZ75V",   category: "volatility", pipSize: 4 },
    { name: "1s V90",   symbol: "1HZ90V",   category: "volatility", pipSize: 4 },
    { name: "1s V100",  symbol: "1HZ100V",  category: "volatility", pipSize: 2 },
  ],
  crash_boom: [
    { name: "Crash 300",  symbol: "CRASH300N", category: "crash_boom", pipSize: 4 },
    { name: "Crash 500",  symbol: "CRASH500",  category: "crash_boom", pipSize: 4 },
    { name: "Crash 1000", symbol: "CRASH1000", category: "crash_boom", pipSize: 4 },
    { name: "Boom 300",   symbol: "BOOM300N",  category: "crash_boom", pipSize: 4 },
    { name: "Boom 500",   symbol: "BOOM500",   category: "crash_boom", pipSize: 4 },
    { name: "Boom 1000",  symbol: "BOOM1000",  category: "crash_boom", pipSize: 4 },
  ],
  jump: [
    { name: "Jump 10",  symbol: "JD10",  category: "jump", pipSize: 3 },
    { name: "Jump 25",  symbol: "JD25",  category: "jump", pipSize: 3 },
    { name: "Jump 50",  symbol: "JD50",  category: "jump", pipSize: 4 },
    { name: "Jump 75",  symbol: "JD75",  category: "jump", pipSize: 4 },
    { name: "Jump 100", symbol: "JD100", category: "jump", pipSize: 2 },
  ],
  bear_bull: [
    { name: "Bear",        symbol: "RDBEAR",   category: "bear_bull", pipSize: 4 },
    { name: "Bull",        symbol: "RDBULL",   category: "bear_bull", pipSize: 4 },
    { name: "Step 2",      symbol: "stpRNG2",  category: "bear_bull", pipSize: 2 },
    { name: "Step 5",      symbol: "stpRNG5",  category: "bear_bull", pipSize: 2 },
    { name: "Rng Brk 100", symbol: "RB100",    category: "bear_bull", pipSize: 4 },
    { name: "Rng Brk 200", symbol: "RB200",    category: "bear_bull", pipSize: 4 },
  ],
  forex: [],
  indices: [],
  commodities: [],
  cryptocurrencies: [],
  stocks: [],
  other: [],
};

const BASE_CATEGORY_LABELS: Record<MarketCategory, string> = {
  volatility:  "Volatility",
  crash_boom:  "Crash / Boom",
  jump:        "Jump",
  bear_bull:   "Bear · Bull · Step",
  forex: "Forex",
  indices: "Indices",
  commodities: "Commodities",
  cryptocurrencies: "Cryptocurrencies",
  stocks: "Stocks",
  other: "Other active markets",
};

export let MARKETS_BY_CATEGORY: Record<MarketCategory, Market[]> = CURATED_MARKETS_BY_CATEGORY;
export let CATEGORY_LABELS: Record<MarketCategory, string> = BASE_CATEGORY_LABELS;
export let MARKETS: Market[] = Object.values(MARKETS_BY_CATEGORY).flat();

export type MarketListSnapshot = {
  markets: Market[];
  loaded: boolean;
  error: string | null;
};

const marketListListeners = new Set<() => void>();
let marketListSnapshot: MarketListSnapshot = {
  markets: MARKETS,
  loaded: false,
  error: null,
};

function publishMarketList(patch: Partial<MarketListSnapshot>) {
  marketListSnapshot = { ...marketListSnapshot, ...patch };
  marketListListeners.forEach((listener) => listener());
}

function subscribeToMarketList(listener: () => void) {
  marketListListeners.add(listener);
  return () => marketListListeners.delete(listener);
}

export function useMarketList() {
  return useSyncExternalStore(subscribeToMarketList, () => marketListSnapshot, () => marketListSnapshot);
}

export function useDerivMarketCatalog() {
  return useMarketList();
}

type DerivActiveSymbol = {
  underlying_symbol?: string;
  underlying_symbol_name?: string;
  underlying_symbol_type?: string;
  market?: string;
  submarket?: string;
  pip_size?: number;
  exchange_is_open?: number | boolean;
  is_trading_suspended?: number | boolean;
};

function categoryForActiveSymbol(entry: DerivActiveSymbol, symbol: string): MarketCategory {
  const known = Object.values(CURATED_MARKETS_BY_CATEGORY)
    .flat()
    .find((market) => market.symbol === symbol);
  if (known) return known.category;
  const normalized = symbol.toUpperCase();
  if (/^(R_|1HZ)/.test(normalized)) return "volatility";
  if (/^(CRASH|BOOM)/.test(normalized)) return "crash_boom";
  if (/^JD/.test(normalized)) return "jump";
  if (/^(RDBEAR|RDBULL|STP|RB)/.test(normalized)) return "bear_bull";

  const marketType = `${entry.market ?? ""} ${entry.submarket ?? ""} ${entry.underlying_symbol_type ?? ""}`.toLowerCase();
  if (marketType.includes("forex")) return "forex";
  if (marketType.includes("crypto")) return "cryptocurrencies";
  if (marketType.includes("commodit") || marketType.includes("metal")) return "commodities";
  if (marketType.includes("stock")) return "stocks";
  if (marketType.includes("index") || marketType.includes("indices")) return "indices";
  return "other";
}

function updateActiveMarketList(entries: DerivActiveSymbol[]) {
  const markets = new Map<string, Market>();
  for (const entry of entries) {
    const symbol = entry.underlying_symbol;
    if (!symbol || entry.is_trading_suspended === true || entry.is_trading_suspended === 1) continue;
    const known = Object.values(CURATED_MARKETS_BY_CATEGORY)
      .flat()
      .find((market) => market.symbol === symbol);
    const rawName = entry.underlying_symbol_name?.replace(/\s+Index$/i, "").trim();
    const market: Market = {
      name: known?.name ?? rawName ?? symbol,
      symbol,
      category: categoryForActiveSymbol(entry, symbol),
      ...(typeof entry.pip_size === "number" ? { pipSize: entry.pip_size } : {}),
      ...(typeof entry.exchange_is_open === "boolean"
        ? { exchangeIsOpen: entry.exchange_is_open }
        : typeof entry.exchange_is_open === "number"
          ? { exchangeIsOpen: entry.exchange_is_open === 1 }
          : {}),
    };
    markets.set(symbol, market);
  }

  const nextMarkets = [...markets.values()].sort((left, right) =>
    Object.keys(BASE_CATEGORY_LABELS).indexOf(left.category) - Object.keys(BASE_CATEGORY_LABELS).indexOf(right.category)
      || left.name.localeCompare(right.name),
  );
  const signature = nextMarkets.map((market) =>
    `${market.symbol}:${market.name}:${market.category}:${market.pipSize ?? ""}:${market.exchangeIsOpen ?? ""}`,
  ).join("|");
  const previousSignature = marketListSnapshot.markets.map((market) =>
    `${market.symbol}:${market.name}:${market.category}:${market.pipSize ?? ""}:${market.exchangeIsOpen ?? ""}`,
  ).join("|");

  MARKETS = nextMarkets;
  MARKETS_BY_CATEGORY = Object.fromEntries(
    Object.keys(BASE_CATEGORY_LABELS).map((category) => [
      category,
      nextMarkets.filter((market) => market.category === category),
    ]),
  ) as Record<MarketCategory, Market[]>;

  if (signature !== previousSignature || !marketListSnapshot.loaded || marketListSnapshot.error) {
    publishMarketList({
      markets: nextMarkets,
      loaded: true,
      error: nextMarkets.length ? null : "Deriv returned no active symbols with the supported contract types.",
    });
  }
}

export const DERIV_PUBLIC_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const PING_MS   = 25000;
const MAX_TICKS = 1500;
const HISTORY_TICKS = 1000;
const MAX_HISTORY_REQUESTS = 4;
const HISTORY_TIMEOUT_MS = 12000;
const MAX_HISTORY_RETRIES = 2;
const ACTIVE_SYMBOLS_TIMEOUT_MS = 12000;

/**
 * Extract the last digit of a price using the exact pip_size from the API.
 */
export function extractDigit(price: number, pipSize: number): number {
  const formatted = price.toFixed(pipSize);
  const digits = formatted.replace(".", "");
  return parseInt(digits.slice(-1), 10);
}

export type MarketFeedSnapshot = {
  digits: TickData[];
  isConnected: boolean;
  historyLoaded: boolean;
  historyPhase: "idle" | "queued" | "loading" | "loaded";
  pipSize: number;
  error: string | null;
};

type ActiveSubscription = {
  requestId: number;
  subscriptionId: string | null;
  priority: number;
  startedAt: number | null;
};

const marketStates = new Map<string, MarketFeedSnapshot>();
const marketListeners = new Map<string, Set<() => void>>();
const activeSubscriptions = new Map<string, ActiveSubscription>();
const requestSymbols = new Map<number, string>();
const requestQueue: string[] = [];
const requestTimers = new Map<number, ReturnType<typeof setTimeout>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryCounts = new Map<string, number>();
const symbolPriorities = new Map<string, number>();
let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activeSymbolsTimer: ReturnType<typeof setTimeout> | null = null;
let activeSymbolsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let activeSymbolsRequestId: number | null = null;
let activeSymbolsRetryCount = 0;
let nextRequestId = 1;

function defaultPipSize(symbol: string) {
  return MARKETS.find((market) => market.symbol === symbol)?.pipSize ?? 4;
}

function getOrCreateMarketState(symbol: string): MarketFeedSnapshot {
  let state = marketStates.get(symbol);
  if (!state) {
    state = {
      digits: [],
      isConnected: false,
      historyLoaded: false,
      historyPhase: "idle",
      pipSize: defaultPipSize(symbol),
      error: null,
    };
    marketStates.set(symbol, state);
  }
  return state;
}

export function getMarketFeedSnapshot(symbol: string) {
  return getOrCreateMarketState(symbol);
}

function notifyMarket(symbol: string) {
  marketListeners.get(symbol)?.forEach((listener) => listener());
}

function updateMarketState(symbol: string, patch: Partial<MarketFeedSnapshot>) {
  marketStates.set(symbol, { ...getOrCreateMarketState(symbol), ...patch });
  notifyMarket(symbol);
}

function activeSymbols() {
  return [...marketListeners.entries()]
    .filter(([, listeners]) => listeners.size > 0)
    .map(([symbol]) => symbol);
}

function sendForget(subscriptionId: string) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ forget: subscriptionId }));
  }
}

function clearRequestTimer(requestId: number) {
  const timer = requestTimers.get(requestId);
  if (timer) clearTimeout(timer);
  requestTimers.delete(requestId);
}

function clearActiveSymbolsTimer() {
  if (activeSymbolsTimer) clearTimeout(activeSymbolsTimer);
  activeSymbolsTimer = null;
}

function scheduleActiveSymbolsRetry() {
  if (activeSymbolsRetryTimer || activeSymbolsRetryCount >= MAX_HISTORY_RETRIES || activeSymbols().length === 0) return;
  activeSymbolsRetryCount += 1;
  activeSymbolsRetryTimer = setTimeout(() => {
    activeSymbolsRetryTimer = null;
    if (socket?.readyState === WebSocket.OPEN && !marketListSnapshot.loaded) {
      requestActiveSymbols();
    }
  }, 2500 * activeSymbolsRetryCount);
}

function requestActiveSymbols() {
  if (socket?.readyState !== WebSocket.OPEN) return;
  clearActiveSymbolsTimer();
  const requestId = nextRequestId++;
  activeSymbolsRequestId = requestId;
  socket.send(JSON.stringify({
    active_symbols: "brief",
    contract_type: [
      "DIGITMATCH",
      "DIGITDIFF",
      "DIGITOVER",
      "DIGITUNDER",
      "DIGITEVEN",
      "DIGITODD",
      "CALL",
      "PUT",
      "UPORDOWN",
    ],
    req_id: requestId,
  }));
  activeSymbolsTimer = setTimeout(() => {
    if (activeSymbolsRequestId !== requestId) return;
    activeSymbolsRequestId = null;
    activeSymbolsTimer = null;
    publishMarketList({
      loaded: false,
      error: "Deriv's active-symbol request timed out. Retry to check the market list.",
    });
    scheduleActiveSymbolsRetry();
  }, ACTIVE_SYMBOLS_TIMEOUT_MS);
}

function acceptActiveSymbols(data: Record<string, any>) {
  if (!Array.isArray(data.active_symbols)) return;
  clearActiveSymbolsTimer();
  activeSymbolsRequestId = null;
  activeSymbolsRetryCount = 0;
  if (activeSymbolsRetryTimer) clearTimeout(activeSymbolsRetryTimer);
  activeSymbolsRetryTimer = null;

  updateActiveMarketList(data.active_symbols as DerivActiveSymbol[]);
  activeSymbols().forEach((symbol) => {
    if (!MARKETS.some((market) => market.symbol === symbol)) {
      updateMarketState(symbol, {
        isConnected: true,
        historyLoaded: false,
        historyPhase: "idle",
        error: "This symbol is not active for the supported Deriv contracts.",
      });
      return;
    }
    updateMarketState(symbol, { isConnected: true, error: null, historyPhase: "queued" });
    subscribeSymbol(symbol, symbolPriorities.get(symbol) ?? 0);
  });
  if (activeSymbols().length === 0 && !idleTimer) {
    idleTimer = setTimeout(() => {
      idleTimer = null;
      closeIdleSocket();
    }, 1200);
  }
}

function removeQueuedSymbol(symbol: string) {
  const index = requestQueue.indexOf(symbol);
  if (index !== -1) requestQueue.splice(index, 1);
}

function scheduleHistoryRetry(symbol: string) {
  if (retryTimers.has(symbol) || !marketListeners.get(symbol)?.size) return;
  const attempts = retryCounts.get(symbol) ?? 0;
  if (attempts >= MAX_HISTORY_RETRIES) return;

  retryCounts.set(symbol, attempts + 1);
  const timer = setTimeout(() => {
    retryTimers.delete(symbol);
    if (marketListeners.get(symbol)?.size && !activeSubscriptions.has(symbol)) {
      updateMarketState(symbol, { error: null, historyPhase: "queued" });
      subscribeSymbol(symbol, symbolPriorities.get(symbol) ?? 0);
    }
  }, 2500 * (attempts + 1));
  retryTimers.set(symbol, timer);
}

function startQueuedHistoryRequests() {
  if (socket?.readyState !== WebSocket.OPEN) return;

  let inFlight = [...activeSubscriptions.values()]
    .filter((subscription) => subscription.startedAt !== null).length;

  while (inFlight < MAX_HISTORY_REQUESTS && requestQueue.length > 0) {
    const symbol = requestQueue.shift();
    if (!symbol) continue;
    const active = activeSubscriptions.get(symbol);
    if (!active || active.startedAt !== null || !marketListeners.get(symbol)?.size) continue;

    active.startedAt = Date.now();
    try {
      updateMarketState(symbol, { historyPhase: "loading", error: null });
      socket.send(JSON.stringify({
        ticks_history: symbol,
        end: "latest",
        count: HISTORY_TICKS,
        style: "ticks",
        subscribe: 1,
        req_id: active.requestId,
      }));
      updateMarketState(symbol, { isConnected: true, historyLoaded: false });

      const requestId = active.requestId;
      const timer = setTimeout(() => {
        const current = activeSubscriptions.get(symbol);
        if (!current || current.requestId !== requestId || current.startedAt === null) return;
        activeSubscriptions.delete(symbol);
        requestSymbols.delete(requestId);
        requestTimers.delete(requestId);
        updateMarketState(symbol, {
          isConnected: true,
          historyLoaded: false,
          historyPhase: "idle",
          error: "Market history timed out. Retrying the subscription.",
        });
        scheduleHistoryRetry(symbol);
        startQueuedHistoryRequests();
      }, HISTORY_TIMEOUT_MS);
      requestTimers.set(requestId, timer);
      inFlight++;
    } catch {
      activeSubscriptions.delete(symbol);
      requestSymbols.delete(active.requestId);
      updateMarketState(symbol, { isConnected: false, error: "Unable to request market data." });
      scheduleHistoryRetry(symbol);
    }
  }
}

function subscribeSymbol(symbol: string, priority = 0) {
  if (socket?.readyState !== WebSocket.OPEN || !marketListeners.get(symbol)?.size) return;
  if (activeSubscriptions.has(symbol)) return;
  if (!marketListSnapshot.loaded) return;
  if (!MARKETS.some((market) => market.symbol === symbol)) {
    updateMarketState(symbol, {
      isConnected: true,
      historyLoaded: false,
      historyPhase: "idle",
      error: "This symbol is not in Deriv's active list for the supported contracts.",
    });
    return;
  }

  const requestId = nextRequestId++;
  const subscription: ActiveSubscription = {
    requestId,
    subscriptionId: null,
    priority,
    startedAt: null,
  };
  activeSubscriptions.set(symbol, subscription);
  requestSymbols.set(requestId, symbol);
  requestQueue.push(symbol);
  updateMarketState(symbol, { historyPhase: "queued", error: null });
  requestQueue.sort((left, right) =>
    (activeSubscriptions.get(right)?.priority ?? 0) -
    (activeSubscriptions.get(left)?.priority ?? 0),
  );
  startQueuedHistoryRequests();
}

function clearPingTimer() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function closeIdleSocket() {
  if (activeSymbols().length > 0) return;
  clearPingTimer();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    const previousSocket = socket;
    socket = null;
    previousSocket.onopen = null;
    previousSocket.onclose = null;
    previousSocket.onerror = null;
    previousSocket.onmessage = null;
    previousSocket.close();
  }
  activeSubscriptions.clear();
  requestSymbols.clear();
  requestQueue.length = 0;
  requestTimers.forEach((timer) => clearTimeout(timer));
  requestTimers.clear();
  retryTimers.forEach((timer) => clearTimeout(timer));
  retryTimers.clear();
  clearActiveSymbolsTimer();
  if (activeSymbolsRetryTimer) clearTimeout(activeSymbolsRetryTimer);
  activeSymbolsRetryTimer = null;
  activeSymbolsRequestId = null;
}

function scheduleReconnect() {
  if (reconnectTimer || activeSymbols().length === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectMarketSocket();
  }, 3000);
}

function connectMarketSocket(forceCatalogRequest = false) {
  if (socket || (activeSymbols().length === 0 && !forceCatalogRequest)) return;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  const currentSocket = new WebSocket(DERIV_PUBLIC_WS_URL);
  socket = currentSocket;

  currentSocket.onopen = () => {
    if (socket !== currentSocket) return;
    pingTimer = setInterval(() => {
      if (currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.send(JSON.stringify({ ping: 1 }));
      }
    }, PING_MS);

    publishMarketList({ loaded: false, error: null });
    requestActiveSymbols();
  };

  currentSocket.onmessage = (event: MessageEvent) => {
    if (socket !== currentSocket) return;

    let data: Record<string, any>;
    try {
      data = JSON.parse(event.data as string);
    } catch {
      return;
    }

    if (data.msg_type === "active_symbols") {
      if (activeSymbolsRequestId !== null && data.req_id !== activeSymbolsRequestId) return;
      acceptActiveSymbols(data);
      return;
    }

    if (data.msg_type === "history" && data.history) {
      const requestId = typeof data.req_id === "number" ? data.req_id : undefined;
      const symbol = (requestId ? requestSymbols.get(requestId) : undefined)
        ?? data.echo_req?.ticks_history;
      if (typeof symbol !== "string") return;

      const subscriptionId = data.subscription?.id;
      const active = activeSubscriptions.get(symbol);
      if (requestId) clearRequestTimer(requestId);
      if (active && requestId && active.requestId !== requestId) {
        if (typeof subscriptionId === "string") sendForget(subscriptionId);
        requestSymbols.delete(requestId);
        startQueuedHistoryRequests();
        return;
      }
      if (active && (!requestId || active.requestId === requestId)) {
        active.subscriptionId = typeof subscriptionId === "string" ? subscriptionId : null;
        active.startedAt = null;
      }
      if (requestId) requestSymbols.delete(requestId);

      if (!marketListeners.get(symbol)?.size) {
        if (typeof subscriptionId === "string") sendForget(subscriptionId);
        activeSubscriptions.delete(symbol);
        removeQueuedSymbol(symbol);
        startQueuedHistoryRequests();
        return;
      }
      if (!active) {
        if (typeof subscriptionId === "string") sendForget(subscriptionId);
        startQueuedHistoryRequests();
        return;
      }

      const pipSize = typeof data.pip_size === "number"
        ? data.pip_size
        : getOrCreateMarketState(symbol).pipSize;
      const prices = Array.isArray(data.history.prices) ? data.history.prices : [];
      const times = Array.isArray(data.history.times) ? data.history.times : [];
      const digits: TickData[] = prices.map((rawPrice: number | string, index: number) => {
        const price = Number(rawPrice);
        return {
          price,
          digit: extractDigit(price, pipSize),
          time: Number(times[index] ?? 0),
        };
      }).filter((tick: TickData) => Number.isFinite(tick.price));

      updateMarketState(symbol, {
        digits: digits.slice(-MAX_TICKS),
        isConnected: true,
        historyLoaded: true,
        historyPhase: "loaded",
        pipSize,
        error: digits.length === 0 ? "No recent tick history returned; waiting for live ticks." : null,
      });
      retryCounts.delete(symbol);
      const retryTimer = retryTimers.get(symbol);
      if (retryTimer) clearTimeout(retryTimer);
      retryTimers.delete(symbol);
      startQueuedHistoryRequests();
      return;
    }

    if (data.msg_type === "tick" && data.tick) {
      const symbol = data.tick.symbol as string | undefined;
      if (!symbol || !marketListeners.get(symbol)?.size) return;

      const active = activeSubscriptions.get(symbol);
      const subscriptionId = data.subscription?.id;
      if (active && typeof subscriptionId === "string") active.subscriptionId = subscriptionId;

      const pipSize = typeof data.tick.pip_size === "number"
        ? data.tick.pip_size
        : getOrCreateMarketState(symbol).pipSize;
      const price = Number(data.tick.quote);
      if (!Number.isFinite(price)) return;
      const tick: TickData = {
        price,
        digit: extractDigit(price, pipSize),
        time: Number(data.tick.epoch ?? Date.now() / 1000),
      };
      const previous = getOrCreateMarketState(symbol);
      const digits = [...previous.digits, tick].slice(-MAX_TICKS);
      updateMarketState(symbol, {
        digits,
        isConnected: true,
        pipSize,
        error: previous.historyLoaded ? null : "Collecting live ticks because Deriv returned no history.",
      });
      return;
    }

    if (data.error) {
      const requestId = typeof data.req_id === "number" ? data.req_id : undefined;
      if (
        (requestId !== undefined && requestId === activeSymbolsRequestId)
        || data.echo_req?.active_symbols
      ) {
        clearActiveSymbolsTimer();
        activeSymbolsRequestId = null;
        publishMarketList({
          loaded: false,
          error: String(data.error.message ?? "Deriv could not load the active-symbol list."),
        });
        scheduleActiveSymbolsRetry();
        return;
      }
      const symbol = (requestId ? requestSymbols.get(requestId) : undefined)
        ?? data.echo_req?.ticks_history
        ?? data.echo_req?.ticks;
      if (typeof symbol === "string") {
        const active = activeSubscriptions.get(symbol);
        const isCurrentRequest = !requestId || active?.requestId === requestId;
        if (requestId) {
          clearRequestTimer(requestId);
          requestSymbols.delete(requestId);
        }
        if (isCurrentRequest) {
          activeSubscriptions.delete(symbol);
          removeQueuedSymbol(symbol);
        }
        if (!marketListeners.get(symbol)?.size) {
          startQueuedHistoryRequests();
          return;
        }
        updateMarketState(symbol, {
          isConnected: true,
          historyLoaded: false,
          historyPhase: "idle",
          error: String(data.error.message ?? "Market data request failed."),
        });
        if (isCurrentRequest) scheduleHistoryRetry(symbol);
        startQueuedHistoryRequests();
      }
    }
  };

  currentSocket.onclose = () => {
    if (socket !== currentSocket) return;
    socket = null;
    clearPingTimer();
    requestTimers.forEach((timer) => clearTimeout(timer));
    requestTimers.clear();
    requestQueue.length = 0;
    activeSubscriptions.clear();
    requestSymbols.clear();
    clearActiveSymbolsTimer();
    activeSymbolsRequestId = null;
    if (activeSymbolsRetryTimer) clearTimeout(activeSymbolsRetryTimer);
    activeSymbolsRetryTimer = null;
    retryTimers.forEach((timer) => clearTimeout(timer));
    retryTimers.clear();
    activeSymbols().forEach((symbol) => {
      updateMarketState(symbol, { isConnected: false, historyLoaded: false });
    });
    scheduleReconnect();
  };

  currentSocket.onerror = () => {
    if (socket === currentSocket) {
      clearPingTimer();
      currentSocket.close();
    }
  };
}

export function subscribeToMarket(symbol: string, listener: () => void, priority = 1) {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  const listeners = marketListeners.get(symbol) ?? new Set<() => void>();
  const isFirstListener = listeners.size === 0;

  if (isFirstListener) {
    const retryTimer = retryTimers.get(symbol);
    if (retryTimer) clearTimeout(retryTimer);
    retryTimers.delete(symbol);
    retryCounts.delete(symbol);
    symbolPriorities.set(symbol, priority);
    marketStates.set(symbol, {
      digits: [],
      isConnected: socket?.readyState === WebSocket.OPEN,
      historyLoaded: false,
        historyPhase: "idle",
      pipSize: defaultPipSize(symbol),
      error: null,
    });
  } else {
    symbolPriorities.set(symbol, Math.max(symbolPriorities.get(symbol) ?? 0, priority));
    const active = activeSubscriptions.get(symbol);
    if (active) {
      active.priority = Math.max(active.priority, priority);
      requestQueue.sort((left, right) =>
        (activeSubscriptions.get(right)?.priority ?? 0) -
        (activeSubscriptions.get(left)?.priority ?? 0),
      );
    }
  }

  listeners.add(listener);
  marketListeners.set(symbol, listeners);
  connectMarketSocket();
  subscribeSymbol(symbol, symbolPriorities.get(symbol) ?? priority);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const currentListeners = marketListeners.get(symbol);
    currentListeners?.delete(listener);
    if (currentListeners?.size) return;
    marketListeners.delete(symbol);

    const active = activeSubscriptions.get(symbol);
    if (active?.subscriptionId) {
      sendForget(active.subscriptionId);
      activeSubscriptions.delete(symbol);
      requestSymbols.delete(active.requestId);
    } else if (active) {
      removeQueuedSymbol(symbol);
      activeSubscriptions.delete(symbol);
      clearRequestTimer(active.requestId);
      // An in-flight response may still include a subscription id to forget.
      if (active.startedAt === null) requestSymbols.delete(active.requestId);
    }
    symbolPriorities.delete(symbol);
    retryCounts.delete(symbol);
    const retryTimer = retryTimers.get(symbol);
    if (retryTimer) clearTimeout(retryTimer);
    retryTimers.delete(symbol);

    updateMarketState(symbol, {
      digits: [],
      isConnected: false,
      historyLoaded: false,
      historyPhase: "idle",
      pipSize: defaultPipSize(symbol),
      error: null,
    });
    startQueuedHistoryRequests();

    if (activeSymbols().length === 0 && !idleTimer) {
      idleTimer = setTimeout(() => {
        idleTimer = null;
        closeIdleSocket();
      }, 1200);
    }
  };
}

export function refreshMarketHistory(symbol: string) {
  if (!marketListeners.get(symbol)?.size) {
    refreshMarketCatalog();
    return;
  }
  if (!marketListSnapshot.loaded) {
    publishMarketList({ error: null });
    requestActiveSymbols();
    return;
  }

  const retryTimer = retryTimers.get(symbol);
  if (retryTimer) clearTimeout(retryTimer);
  retryTimers.delete(symbol);
  retryCounts.delete(symbol);

  const active = activeSubscriptions.get(symbol);
  if (active?.subscriptionId) sendForget(active.subscriptionId);
  if (active) {
    removeQueuedSymbol(symbol);
    activeSubscriptions.delete(symbol);
    clearRequestTimer(active.requestId);
    if (active.startedAt === null) requestSymbols.delete(active.requestId);
  }

  updateMarketState(symbol, {
    digits: [],
    isConnected: socket?.readyState === WebSocket.OPEN,
    historyLoaded: false,
    historyPhase: "idle",
    error: null,
  });
  connectMarketSocket();
  subscribeSymbol(symbol, symbolPriorities.get(symbol) ?? 1);
}

export function refreshMarketCatalog() {
  publishMarketList({ loaded: false, error: null });
  if (socket?.readyState === WebSocket.OPEN) {
    requestActiveSymbols();
  } else {
    connectMarketSocket(true);
  }
}

export function useDerivWebSocket(symbol: string) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToMarket(symbol, listener),
    [symbol],
  );
  const getSnapshot = useCallback(() => getMarketFeedSnapshot(symbol), [symbol]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const lastTick = snapshot.digits[snapshot.digits.length - 1];

  return {
    ...snapshot,
    lastDigit: lastTick?.digit ?? null,
    currentPrice: lastTick?.price ?? null,
    refreshHistory: useCallback(() => refreshMarketHistory(symbol), [symbol]),
  };
}

export type PriceData = { price: number; time: number };

export function useForexWebSocket(symbol: string) {
  const marketData = useDerivWebSocket(symbol);
  const prices: PriceData[] = marketData.digits.map(({ price, time }) => ({ price, time }));
  return { prices, currentPrice: marketData.currentPrice, isConnected: marketData.isConnected };
}
