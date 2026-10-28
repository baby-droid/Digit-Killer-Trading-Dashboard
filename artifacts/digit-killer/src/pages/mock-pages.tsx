import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, LineChart } from "lucide-react";

export default function MockPages() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 p-8">
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center border border-border">
        <BrainCircuit className="w-10 h-10 text-muted-foreground" />
      </div>
      <div className="max-w-md">
        <h2 className="text-2xl font-bold mb-2">Module Not Enabled</h2>
        <p className="text-muted-foreground">
          This advanced tracking module is available in the Pro version. It requires a backend database to store historical trade execution data and AI prediction accuracy logs.
        </p>
      </div>
    </div>
  );
}

export function Settings() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Deriv App ID</div>
            <div className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">1089 (Default Public)</div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Deriv API Token</div>
            <div className="text-sm text-muted-foreground italic border border-border/50 border-dashed p-3 rounded">
              Execute trades automatically (Requires Pro Version with Backend)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
