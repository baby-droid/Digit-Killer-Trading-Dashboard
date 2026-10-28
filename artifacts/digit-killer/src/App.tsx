import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketProvider } from "@/lib/market-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppSettingsProvider } from "@/lib/app-settings-context";
import { Layout } from "@/components/layout";
import { LoadingScreen } from "@/components/loading-screen";

import Dashboard      from "@/pages/dashboard";
import Scanner        from "@/pages/scanner";
import Signals        from "@/pages/signals";
import TickGenerator  from "@/pages/tick-generator";
import SmartTrade     from "@/pages/smart-trade";
import SmartSignals   from "@/pages/smart-signals";
import MarkSynTraderSignal from "@/pages/mark-syn-trader-board";
import Forex          from "@/pages/forex";
import Analysis       from "@/pages/analysis";
import TradeDesk      from "@/pages/trade-desk";
import Strategies     from "@/pages/strategies";
import Performance    from "@/pages/performance";
import Settings       from "@/pages/settings";
import WideEye        from "@/pages/wide-eye";
import RiskCalculator from "@/pages/risk-calculator";
import AILearning     from "@/pages/ai-learning";
import Login          from "@/pages/login";
import NotFound       from "@/pages/not-found";
import MatchesDiffers from "@/pages/matches-differs";
import OnlyUpsDowns   from "@/pages/only-ups-downs";
import RiseFall       from "@/pages/rise-fall";
import HighLowTick    from "@/pages/high-low-tick";
import UnderPatternAnalyser from "@/pages/under-4-under-5-analyser";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);

  if (loading) return <LoadingScreen onDone={() => setLoading(false)} />;
  if (!isAuthenticated) return <Login />;

  return (
    <Layout>
      <Switch>
        <Route path="/"                component={Dashboard} />
        <Route path="/scanner"         component={Scanner} />
        <Route path="/signals"         component={Signals} />
        <Route path="/tick-generator"  component={TickGenerator} />
        <Route path="/smart-trade"     component={SmartTrade} />
        <Route path="/smart-signals"   component={SmartSignals} />
        <Route path="/mark-syn-trader-signal" component={MarkSynTraderSignal} />
        <Route path="/forex"           component={Forex} />
        <Route path="/analysis"        component={Analysis} />
        <Route path="/trade-desk"      component={TradeDesk} />
        <Route path="/strategies"      component={Strategies} />
        <Route path="/wide-eye"        component={WideEye} />
        <Route path="/under-4-under-5-analyser" component={UnderPatternAnalyser} />
        <Route path="/risk-calculator" component={RiskCalculator} />
        <Route path="/learning"        component={AILearning} />
        <Route path="/performance"     component={Performance} />
        <Route path="/settings"        component={Settings} />
        <Route path="/matches-differs" component={MatchesDiffers} />
        <Route path="/only-ups-downs"  component={OnlyUpsDowns} />
        <Route path="/rise-fall"       component={RiseFall} />
        <Route path="/high-low-tick"   component={HighLowTick} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <MarketProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AppContent />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </MarketProvider>
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
