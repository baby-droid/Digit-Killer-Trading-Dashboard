import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { useMarket } from "@/lib/market-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Radio, Wifi, WifiOff, ExternalLink, Info, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { activeMarket } = useMarket();
  const { digits, lastDigit, currentPrice, isConnected } = useDerivWebSocket(activeMarket);
  const [, setLocation] = useLocation();

  const last100 = digits.slice(-100);
  const evens = last100.filter((d) => d.digit % 2 === 0).length;
  const odds = last100.filter((d) => d.digit % 2 !== 0).length;
  const over4 = last100.filter((d) => d.digit > 4).length;
  const under5 = last100.filter((d) => d.digit < 5).length;

  const openFullChart = () => {
    window.open(`https://charts.deriv.com/deriv?symbol=${activeMarket}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="h-0.5 rounded-full -mb-3" style={{ background: "linear-gradient(to right,#6366f1,transparent)" }} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#6366f1" }}>Market Dashboard</h1>
        <Button 
          onClick={() => setLocation("/scanner")} 
          variant="default"
          className="gap-2"
          data-testid="button-go-to-scanner"
        >
          <BarChart2 className="w-4 h-4" />
          AI Scanner
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <div className="text-sm font-medium text-muted-foreground mb-1">Current Price</div>
            <div className="text-3xl font-mono font-bold tracking-tight text-foreground">
              {currentPrice ? currentPrice.toFixed(2) : "---"}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex items-center justify-between h-full">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Last Digit</div>
              <div className={`text-5xl font-mono font-bold ${lastDigit !== null && lastDigit % 2 === 0 ? "text-primary" : "text-destructive"}`}>
                {lastDigit !== null ? lastDigit : "-"}
              </div>
            </div>
            <Activity className={`w-12 h-12 opacity-20 ${lastDigit !== null && lastDigit % 2 === 0 ? "text-primary" : "text-destructive"}`} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 flex flex-col justify-center h-full gap-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              {isConnected ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 font-mono">
                  <Wifi className="w-3 h-3 mr-1.5" /> ONLINE
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-mono">
                  <WifiOff className="w-3 h-3 mr-1.5" /> OFFLINE
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ticks buffer:</span>
              <span className="font-mono">{digits.length}/500</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">EVEN (last 100)</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-mono font-bold text-primary">{evens}%</div>
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${evens}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">ODD (last 100)</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-mono font-bold text-destructive">{odds}%</div>
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-destructive transition-all duration-300" style={{ width: `${odds}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">OVER 4 (last 100)</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-mono font-bold text-primary">{over4}%</div>
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${over4}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">UNDER 5 (last 100)</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-mono font-bold text-destructive">{under5}%</div>
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-destructive transition-all duration-300" style={{ width: `${under5}%` }} />
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border overflow-hidden">
        <CardHeader className="bg-muted/30 py-3 px-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center">
            <Radio className="w-4 h-4 text-primary mr-2" />
            <CardTitle className="text-sm font-medium">Live Market Chart</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 ml-2 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>You can use the chart controls directly to add or remove indicators.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={openFullChart}
            className="h-8 gap-1 text-xs"
            data-testid="button-open-full-chart"
          >
            <ExternalLink className="w-3 h-3" />
            Open Full Chart
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <iframe 
            src={`https://charts.deriv.com/deriv?symbol=${activeMarket}`}
            className="w-full h-[650px] border-0"
            title="Deriv Live Chart"
          />
        </CardContent>
      </Card>
    </div>
  );
}
