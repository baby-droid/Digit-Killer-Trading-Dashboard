import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Strategies() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Trading Strategies</h1>
        <p className="text-muted-foreground">Reference guide for digit-based synthetic market strategies.</p>
      </div>

      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">1</span>
              The 70/30 Rule (Even/Odd)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground/80 leading-relaxed">
            <p>Wait for the Even/Odd ratio to hit extreme imbalance (e.g., 70% Even over the last 50 ticks).</p>
            <p><strong>Trend Follow:</strong> Bet on the dominant side to continue (Even).</p>
            <p><strong>Reversal:</strong> Wait for a single tick of the weak side, then bet it will revert to the mean (Odd).</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center text-xs">2</span>
              Cold Digit Targeting (Differs)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground/80 leading-relaxed">
            <p>Identify the coldest digit in the last 100 ticks (frequency &lt; 5%).</p>
            <p>Execute a "Differs" contract specifying that cold digit. The probability of it appearing is statistically low based on current market conditions.</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">3</span>
              Over 4 / Under 5 Bias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground/80 leading-relaxed">
            <p>Monitor the Over 4 and Under 5 percentages. If Over 4 hits &gt; 65%, the market is printing high numbers continuously.</p>
            <p>Use Over 3 or Over 2 contracts for higher win probability (though lower payout) while the trend lasts.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
