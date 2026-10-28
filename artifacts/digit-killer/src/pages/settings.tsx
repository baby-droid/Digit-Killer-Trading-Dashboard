import { Activity, CheckCircle2, CircleAlert, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DerivAccountCard } from "@/components/deriv-account-card";
import { UnderTradeControls } from "@/components/under-trade-controls";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { useDerivSession } from "@/lib/deriv-session";
import { useMarket } from "@/lib/market-context";

export default function Settings() {
  const { activeMarket } = useMarket();
  const { isConnected, historyLoaded, error } = useDerivWebSocket(activeMarket);
  const { activeAccount, tradeConnectionStatus } = useDerivSession();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings2 className="h-6 w-6 text-primary" /> Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deriv connection, account selection, automated-entry settings, and risk limits.
        </p>
      </header>

      <DerivAccountCard />
      <UnderTradeControls />

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-4 w-4 text-primary" /> Connection status
          </CardTitle>
          <Badge variant="outline">{activeAccount?.account_type ?? "No account"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            {isConnected && historyLoaded ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 text-amber-300" />
            )}
            <div>
              <p className="text-sm font-semibold">Public market feed</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error || (isConnected ? (historyLoaded ? "Connected and receiving ticks." : "Connected; loading tick history.") : "Connecting to the live market feed.")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            {tradeConnectionStatus === "connected" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-semibold">Trading connection</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeAccount ? `Authenticated Deriv ${tradeConnectionStatus} connection for ${activeAccount.account_id}.` : "Connect a Deriv account to enable order submission."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Auto-entry is off until explicitly enabled. Use fixed stakes and set a stop-loss and take-profit before arming. Real-account trading requires a separate confirmation.
      </p>
    </div>
  );
}
