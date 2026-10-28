import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Deriv application IDs are public identifiers, not credentials. Keep this
// configured in code; never ask users to treat it as a password or token.
const DERIV_APP_ID = "34NPKU9CpQPBiUeK2O3S5";
const DERIV_REST_URL = "https://api.derivws.com";
const REQUEST_TIMEOUT_MS = 12_000;

export type DerivAccount = {
  account_id: string;
  account_type: "demo" | "real";
  balance: number;
  currency: string;
  status: "active" | "inactive" | string;
  group?: string;
};

export type DerivTradeStatus =
  | "proposing"
  | "buying"
  | "open"
  | "won"
  | "lost"
  | "sold"
  | "cancelled"
  | "error";

export type DerivContractType =
  | "DIGITMATCH"
  | "DIGITDIFF"
  | "DIGITOVER"
  | "DIGITUNDER"
  | "DIGITEVEN"
  | "DIGITODD"
  | "CALL"
  | "PUT";

export type DerivTradeRecord = {
  id: string;
  contractId: number | null;
  accountId: string;
  accountType: "demo" | "real";
  market: string;
  contractType: DerivContractType;
  barrier: number | null;
  stake: number;
  payout: number | null;
  profit: number | null;
  executionMs: number | null;
  status: DerivTradeStatus;
  createdAt: number;
  settledAt: number | null;
  error?: string;
};

export type DerivTradeEvent = {
  trade: DerivTradeRecord;
  terminal: boolean;
};

export type LiveRiskCaps = {
  maxStake: number;
  stopLoss: number;
  takeProfit: number;
  sessionStartedAt?: number;
};

type ConnectionStatus = "disconnected" | "connecting" | "connected";
type TradeConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type DerivSessionValue = {
  status: ConnectionStatus;
  tradeConnectionStatus: TradeConnectionStatus;
  accounts: DerivAccount[];
  activeAccount: DerivAccount | null;
  error: string | null;
  trades: DerivTradeRecord[];
  liveTradingArmed: boolean;
  liveRiskCaps: LiveRiskCaps | null;
  connectWithPat: (input: { token: string }) => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  disconnect: () => void;
  armLiveTrading: (armed: boolean) => void;
  stopAllEntries: () => void;
  setLiveRiskCaps: (caps: LiveRiskCaps | null) => void;
  buyOneTickContract: (input: {
    symbol: string;
    contractType: DerivContractType;
    barrier?: number;
    stake: number;
    triggeredAt?: number;
  }) => Promise<DerivTradeRecord>;
  buyDigitUnder: (input: {
    symbol: string;
    barrier: 4 | 5;
    stake: number;
  }) => Promise<DerivTradeRecord>;
  subscribeTradeEvents: (listener: (event: DerivTradeEvent) => void) => () => void;
};

type JsonObject = Record<string, unknown>;
type PendingRequest = {
  messageType: string;
  resolve: (value: JsonObject) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim()) return nested.message;
    }
    if (Array.isArray(record.errors)) {
      const first = record.errors[0] as Record<string, unknown> | undefined;
      if (typeof first?.message === "string" && first.message.trim()) return first.message;
    }
  }
  return fallback;
}

async function readJson(response: Response): Promise<JsonObject> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as JsonObject;
  } catch {
    return { message: text };
  }
}

function accountArray(value: unknown): DerivAccount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.account_id !== "string"
      || (record.account_type !== "demo" && record.account_type !== "real")
    ) {
      return [];
    }
    return [{
      account_id: record.account_id,
      account_type: record.account_type,
      balance: Number(record.balance ?? 0),
      currency: typeof record.currency === "string" ? record.currency : "USD",
      status: typeof record.status === "string" ? record.status : "inactive",
      ...(typeof record.group === "string" ? { group: record.group } : {}),
    }];
  });
}

class DerivTradingSocket {
  private socket: WebSocket | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly tradeIdsByContract = new Map<number, string>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly url: string,
    private readonly onTradeUpdate: (tradeId: string, contract: JsonObject) => void,
    private readonly onConnectionChange: (connected: boolean, message?: string) => void,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new Error("Deriv WebSocket connection timed out."));
      }, REQUEST_TIMEOUT_MS);

      try {
        const socket = new WebSocket(this.url);
        this.socket = socket;
        socket.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.onConnectionChange(true);
          this.pingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ ping: 1 }));
            }
          }, 25_000);
          resolve();
        };
        socket.onmessage = (event) => this.handleMessage(event);
        socket.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error("Could not open the Deriv trading connection."));
          }
        };
        socket.onclose = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error("Deriv closed the trading connection before it was ready."));
          }
          this.clearPending(new Error("Deriv trading connection closed."));
          this.onConnectionChange(false, "Deriv trading connection closed.");
          this.clearPing();
        };
      } catch {
        settled = true;
        clearTimeout(timeout);
        reject(new Error("Could not create the Deriv trading connection."));
      }
    });
  }

  isOpen() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async buyOneTickContract(input: {
    account: DerivAccount;
    symbol: string;
    contractType: DerivContractType;
    barrier?: number;
    stake: number;
    triggeredAt?: number;
  }, canContinue: () => boolean, onTradeCreated: (trade: DerivTradeRecord) => void): Promise<DerivTradeRecord> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Choose an account with an active Deriv trading connection first.");
    }
    if (!Number.isFinite(input.stake) || input.stake <= 0) {
      throw new Error("Stake must be greater than zero.");
    }
    const needsBarrier = ["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(input.contractType);
    if (needsBarrier && (!Number.isInteger(input.barrier) || input.barrier! < 0 || input.barrier! > 9)) {
      throw new Error("This digit contract requires a barrier from 0 to 9.");
    }

    const tradeId = `${Date.now()}-${this.nextRequestId}`;
    const baseRecord: DerivTradeRecord = {
      id: tradeId,
      contractId: null,
      accountId: input.account.account_id,
      accountType: input.account.account_type,
      market: input.symbol,
      contractType: input.contractType,
      barrier: needsBarrier ? input.barrier! : null,
      stake: input.stake,
      payout: null,
      profit: null,
      executionMs: null,
      status: "proposing",
      createdAt: Date.now(),
      settledAt: null,
    };

    const requestStartedAt = input.triggeredAt ?? Date.now();
    const proposalRequest: JsonObject = {
      proposal: 1,
      amount: input.stake,
      basis: "stake",
      contract_type: input.contractType,
      currency: input.account.currency,
      underlying_symbol: input.symbol,
      duration: 1,
      duration_unit: "t",
    };
    if (needsBarrier) proposalRequest.barrier = String(input.barrier);
    const proposal = await this.request("proposal", proposalRequest);

    const proposalId = proposal.id;
    const askPrice = Number(proposal.ask_price);
    if (typeof proposalId !== "string" || !Number.isFinite(askPrice) || askPrice <= 0) {
      throw new Error("Deriv returned an incomplete price proposal.");
    }
    if (!canContinue()) {
      throw new Error("Entry was stopped before Deriv submitted the order.");
    }

    const buy = await this.request("buy", {
      buy: proposalId,
      price: askPrice,
    });
    const contractId = Number(buy.contract_id);
    if (!Number.isFinite(contractId) || contractId <= 0) {
      throw new Error("Deriv did not return a valid contract ID.");
    }

    this.tradeIdsByContract.set(contractId, tradeId);
    const openRecord: DerivTradeRecord = {
      ...baseRecord,
      contractId,
      payout: Number.isFinite(Number(buy.payout)) ? Number(buy.payout) : null,
      executionMs: Math.max(0, Date.now() - requestStartedAt),
      status: "open",
    };
    onTradeCreated(openRecord);
    socket.send(JSON.stringify({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
      req_id: this.nextRequestId++,
    }));
    return openRecord;
  }

  close() {
    this.clearPing();
    this.clearPending(new Error("Deriv trading connection closed."));
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
    this.onConnectionChange(false);
  }

  private clearPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private clearPending(error: Error) {
    this.pending.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(error);
    });
    this.pending.clear();
  }

  private request(messageType: string, payload: JsonObject): Promise<JsonObject> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Deriv trading connection is not open."));
    }
    const reqId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error(`Deriv ${messageType} request timed out.`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(reqId, { messageType, resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ ...payload, req_id: reqId }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(reqId);
        reject(new Error(`Could not send the Deriv ${messageType} request.`));
      }
    });
  }

  private handleMessage(event: MessageEvent) {
    let message: JsonObject;
    try {
      message = JSON.parse(String(event.data)) as JsonObject;
    } catch {
      return;
    }

    if (message.msg_type === "proposal_open_contract" && message.proposal_open_contract) {
      const contract = message.proposal_open_contract as JsonObject;
      const contractId = Number(contract.contract_id);
      const tradeId = this.tradeIdsByContract.get(contractId);
      if (tradeId) {
        this.onTradeUpdate(tradeId, contract);
        const status = typeof contract.status === "string" ? contract.status : "";
        if (
          contract.is_sold === 1
          || ["won", "lost", "sold", "cancelled"].includes(status)
        ) {
          this.tradeIdsByContract.delete(contractId);
        }
      }
    }

    const reqId = typeof message.req_id === "number" ? message.req_id : null;
    const pending = reqId === null ? undefined : this.pending.get(reqId);
    if (!pending) return;
    this.pending.delete(reqId as number);
    clearTimeout(pending.timer);

    if (message.error) {
      pending.reject(new Error(errorMessage(message.error, `Deriv ${pending.messageType} request failed.`)));
      return;
    }
    const response = message[pending.messageType];
    if (!response || typeof response !== "object") {
      pending.reject(new Error(`Deriv returned an unexpected ${pending.messageType} response.`));
      return;
    }
    pending.resolve(response as JsonObject);
  }
}

const DerivSessionContext = createContext<DerivSessionValue | null>(null);

export function DerivSessionProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const socketRef = useRef<DerivTradingSocket | null>(null);
  const listenersRef = useRef(new Set<(event: DerivTradeEvent) => void>());
  const tradesRef = useRef<DerivTradeRecord[]>([]);
  const tradeRequestGeneration = useRef(0);
  const sessionGeneration = useRef(0);
  const submissionInFlight = useRef(false);
  const liveTradingArmedRef = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [tradeConnectionStatus, setTradeConnectionStatus] =
    useState<TradeConnectionStatus>("disconnected");
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<DerivAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<DerivTradeRecord[]>([]);
  const [liveTradingArmed, setLiveTradingArmed] = useState(false);
  const [liveRiskCaps, setLiveRiskCapsState] = useState<LiveRiskCaps | null>(null);

  const emitTrade = useCallback((event: DerivTradeEvent) => {
    listenersRef.current.forEach((listener) => listener(event));
  }, []);

  const updateTrade = useCallback((trade: DerivTradeRecord, terminal: boolean) => {
    const current = tradesRef.current;
    const index = current.findIndex((item) => item.id === trade.id);
    const next = index < 0
      ? [trade, ...current].slice(0, 2_000)
      : current.map((item) => item.id === trade.id ? trade : item);
    tradesRef.current = next;
    setTrades(next);
    emitTrade({ trade, terminal });
  }, [emitTrade]);

  const updateSettledTrade = useCallback((tradeId: string, contract: JsonObject) => {
    const existing = tradesRef.current.find((item) => item.id === tradeId);
    if (!existing) return;
    const rawStatus = typeof contract.status === "string" ? contract.status : "open";
    const terminal = ["won", "lost", "sold", "cancelled"].includes(rawStatus);
    const profitValue = Number(contract.profit);
    const payoutValue = Number(contract.payout);
    const updated: DerivTradeRecord = {
      ...existing,
      status: (terminal ? rawStatus : "open") as DerivTradeStatus,
      profit: Number.isFinite(profitValue) ? profitValue : existing.profit,
      payout: Number.isFinite(payoutValue) ? payoutValue : existing.payout,
      settledAt: terminal ? Date.now() : null,
    };
    updateTrade(updated, terminal);
  }, [updateTrade]);

  const connectWithPat = useCallback(async ({ token }: { token: string }) => {
    const cleanToken = token.trim();
    if (!cleanToken) throw new Error("Enter a Deriv personal access token.");

    const generation = ++sessionGeneration.current;
    tradeRequestGeneration.current++;
    liveTradingArmedRef.current = false;
    socketRef.current?.close();
    socketRef.current = null;
    tokenRef.current = null;
    setAccounts([]);
    setActiveAccount(null);
    tradesRef.current = [];
    setTrades([]);
    setLiveTradingArmed(false);
    setTradeConnectionStatus("disconnected");
    setStatus("connecting");
    setError(null);

    try {
      const response = await fetch(`${DERIV_REST_URL}/trading/v1/options/accounts`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Deriv-App-ID": DERIV_APP_ID,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await readJson(response);
      if (generation !== sessionGeneration.current) {
        throw new Error("This Deriv connection request was superseded.");
      }
      if (!response.ok) {
        throw new Error(errorMessage(payload, `Deriv account request failed (${response.status}).`));
      }
      const nextAccounts = accountArray(payload.data);
      if (nextAccounts.length === 0) {
        throw new Error("Deriv returned no available Options Trading accounts for this token.");
      }
      tokenRef.current = cleanToken;
      setAccounts(nextAccounts);
      setStatus("connected");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not connect to Deriv.";
      if (generation === sessionGeneration.current) {
        setStatus("disconnected");
        setError(message);
      }
      throw new Error(message);
    }
  }, []);

  const switchAccount = useCallback(async (accountId: string) => {
    const token = tokenRef.current;
    const cleanAccountId = accountId.trim();
    const account = accounts.find((item) => item.account_id === cleanAccountId);
    if (!token || status !== "connected") {
      throw new Error("Connect your Deriv token before choosing an account.");
    }
    if (!account || account.status !== "active") {
      throw new Error("Choose an active Deriv account from the loaded account list.");
    }

    const generation = ++sessionGeneration.current;
    tradeRequestGeneration.current++;
    liveTradingArmedRef.current = false;
    socketRef.current?.close();
    socketRef.current = null;
    setActiveAccount(null);
    setLiveTradingArmed(false);
    setTradeConnectionStatus("connecting");
    setError(null);

    try {
      const response = await fetch(
        `${DERIV_REST_URL}/trading/v1/options/accounts/${encodeURIComponent(cleanAccountId)}/otp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Deriv-App-ID": DERIV_APP_ID,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const payload = await readJson(response);
      if (generation !== sessionGeneration.current) {
        throw new Error("This Deriv account switch was superseded.");
      }
      if (!response.ok) {
        throw new Error(errorMessage(payload, `Deriv account authorization failed (${response.status}).`));
      }
      const data = payload.data as JsonObject | undefined;
      const otpUrl = data?.url;
      if (typeof otpUrl !== "string" || !otpUrl.startsWith("wss://")) {
        throw new Error("Deriv did not return a valid one-time WebSocket URL.");
      }

      const client = new DerivTradingSocket(
        otpUrl,
        updateSettledTrade,
        (connected, message) => {
          setTradeConnectionStatus(connected ? "connected" : "disconnected");
          if (message) setError(message);
        },
      );
      socketRef.current = client;
      await client.connect();
      if (generation !== sessionGeneration.current) {
        client.close();
        if (socketRef.current === client) socketRef.current = null;
        throw new Error("This Deriv account switch was superseded.");
      }
      setActiveAccount(account);
      setTradeConnectionStatus("connected");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not authorize the Deriv account.";
      if (generation === sessionGeneration.current) {
        socketRef.current?.close();
        socketRef.current = null;
        setTradeConnectionStatus("error");
        setError(message);
      }
      throw new Error(message);
    }
  }, [accounts, status, updateSettledTrade]);

  const disconnect = useCallback(() => {
    sessionGeneration.current++;
    tradeRequestGeneration.current++;
    liveTradingArmedRef.current = false;
    socketRef.current?.close();
    socketRef.current = null;
    tokenRef.current = null;
    setStatus("disconnected");
    setTradeConnectionStatus("disconnected");
    setAccounts([]);
    setActiveAccount(null);
    setLiveTradingArmed(false);
    setLiveRiskCapsState(null);
    setError(null);
  }, []);

  const armLiveTrading = useCallback((armed: boolean) => {
    liveTradingArmedRef.current = armed;
    setLiveTradingArmed(armed);
  }, []);

  const stopAllEntries = useCallback(() => {
    tradeRequestGeneration.current++;
    liveTradingArmedRef.current = false;
    setLiveTradingArmed(false);
  }, []);

  const setLiveRiskCaps = useCallback((caps: LiveRiskCaps | null) => {
    if (
      caps === null
      || !Number.isFinite(caps.maxStake)
      || !Number.isFinite(caps.stopLoss)
      || !Number.isFinite(caps.takeProfit)
      || caps.maxStake <= 0
      || caps.stopLoss <= 0
      || caps.takeProfit <= 0
    ) {
      setLiveRiskCapsState(null);
      liveTradingArmedRef.current = false;
      setLiveTradingArmed(false);
      return;
    }
    setLiveRiskCapsState(caps);
  }, []);

  const buyOneTickContract = useCallback(async ({
    symbol,
    contractType,
    barrier,
    stake,
    triggeredAt,
  }: {
    symbol: string;
    contractType: DerivContractType;
    barrier?: number;
    stake: number;
    triggeredAt?: number;
  }) => {
    const account = activeAccount;
    const client = socketRef.current;
    if (!account || !client?.isOpen() || tradeConnectionStatus !== "connected") {
      throw new Error("Choose an account with an active Deriv trading connection first.");
    }
    if (submissionInFlight.current) {
      throw new Error("A Deriv order is already being submitted. Wait for it to finish.");
    }
    if (tradesRef.current.some((trade) =>
      trade.accountId === account.account_id
      && ["proposing", "buying", "open"].includes(trade.status),
    )) {
      throw new Error("Wait for the current one-tick contract to settle before submitting another.");
    }
    if (account.account_type === "real") {
      if (!liveTradingArmed) {
        throw new Error("Confirm and arm live trading before sending real-money orders.");
      }
      if (!liveRiskCaps) {
        throw new Error("Set a maximum stake, stop-loss, and take-profit before live trading.");
      }
      if (stake > liveRiskCaps.maxStake) {
        throw new Error(`Stake exceeds the configured maximum of ${liveRiskCaps.maxStake}.`);
      }
    }
    if (!/^[A-Za-z0-9_]{2,30}$/.test(symbol)) {
      throw new Error("Choose a valid active Deriv market symbol.");
    }
    if (account.account_type === "real" && liveRiskCaps) {
      const settled = tradesRef.current.filter((trade) =>
        trade.accountId === account.account_id
        && trade.createdAt >= (liveRiskCaps.sessionStartedAt ?? 0)
        && ["won", "lost", "sold", "cancelled"].includes(trade.status),
      );
      const profit = settled.reduce((sum, trade) => {
        if (trade.profit !== null && Number.isFinite(trade.profit)) return sum + trade.profit;
        if (trade.status === "lost") return sum - trade.stake;
        if (trade.status === "won" && trade.payout !== null && Number.isFinite(trade.payout)) {
          return sum + trade.payout - trade.stake;
        }
        return sum;
      }, 0);
      if (profit <= -liveRiskCaps.stopLoss || profit >= liveRiskCaps.takeProfit) {
        throw new Error("The configured session loss or profit limit has been reached.");
      }
      if (stake > Math.max(0, profit + liveRiskCaps.stopLoss)) {
        throw new Error("Stake exceeds the remaining session loss limit.");
      }
    }
    setError(null);
    submissionInFlight.current = true;
    try {
      const generation = tradeRequestGeneration.current;
      const trade = await client.buyOneTickContract(
        { account, symbol, contractType, barrier, stake, triggeredAt },
        () => generation === tradeRequestGeneration.current
          && socketRef.current === client
          && (account.account_type !== "real" || liveTradingArmedRef.current),
        (created) => updateTrade(created, false),
      );
      return trade;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Deriv could not place the contract.";
      setError(message);
      throw new Error(message);
    } finally {
      submissionInFlight.current = false;
    }
  }, [activeAccount, liveRiskCaps, liveTradingArmed, tradeConnectionStatus, updateTrade]);

  const buyDigitUnder = useCallback(({ symbol, barrier, stake }: {
    symbol: string;
    barrier: 4 | 5;
    stake: number;
  }) => buyOneTickContract({
    symbol,
    contractType: "DIGITUNDER",
    barrier,
    stake,
  }), [buyOneTickContract]);

  const subscribeTradeEvents = useCallback((listener: (event: DerivTradeEvent) => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const value = useMemo<DerivSessionValue>(() => ({
    status,
    tradeConnectionStatus,
    accounts,
    activeAccount,
    error,
    trades,
    liveTradingArmed,
    liveRiskCaps,
    connectWithPat,
    switchAccount,
    disconnect,
    armLiveTrading,
    stopAllEntries,
    setLiveRiskCaps,
    buyOneTickContract,
    buyDigitUnder,
    subscribeTradeEvents,
  }), [
    status,
    tradeConnectionStatus,
    accounts,
    activeAccount,
    error,
    trades,
    liveTradingArmed,
    liveRiskCaps,
    connectWithPat,
    switchAccount,
    disconnect,
    armLiveTrading,
    stopAllEntries,
    setLiveRiskCaps,
    buyOneTickContract,
    buyDigitUnder,
    subscribeTradeEvents,
  ]);

  return <DerivSessionContext.Provider value={value}>{children}</DerivSessionContext.Provider>;
}

export function useDerivSession() {
  const context = useContext(DerivSessionContext);
  if (!context) {
    throw new Error("useDerivSession must be used inside DerivSessionProvider.");
  }
  return context;
}
