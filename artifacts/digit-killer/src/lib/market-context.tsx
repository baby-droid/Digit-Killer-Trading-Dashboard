import { createContext, useContext, useState, ReactNode } from "react";
import { MARKETS } from "@/hooks/useDerivWebSocket";

type MarketContextType = {
  activeMarket: string;
  setActiveMarket: (symbol: string) => void;
};

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [activeMarket, setActiveMarket] = useState(MARKETS[0].symbol);

  return (
    <MarketContext.Provider value={{ activeMarket, setActiveMarket }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error("useMarket must be used within a MarketProvider");
  }
  return context;
}
