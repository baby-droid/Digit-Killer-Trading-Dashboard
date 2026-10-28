import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { useMarket } from "@/lib/market-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SignalType = {
  id: string;
  name: string;
  condition: (digit: number, digits: number[]) => boolean;
  type: "EVEN_BIAS" | "ODD_BIAS" | "OVER_BIAS" | "UNDER_BIAS" | "MATCHES" | "DIFFERS" | "RISE_FALL";
  recommendation?: string;
  duration?: string;
  entryDigits?: number[];
};

const getDigitFrequencies = (last100: number[]) => {
  const freqs = new Array(10).fill(0);
  last100.forEach(d => freqs[d]++);
  const total = last100.length || 1;
  return freqs.map((f, i) => ({ digit: i, freq: (f / total) * 100 }));
};

const getMovingAverage = (digits: number[], period: number) => {
  if (digits.length < period) return 0;
  const sum = digits.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
};

const SIGNAL_TYPES: SignalType[] = [
  { 
    id: "rise", 
    name: "Rise", 
    condition: (_, digits) => {
      if (digits.length < 2) return false;
      return digits[digits.length - 1] > digits[digits.length - 2];
    }, 
    type: "RISE_FALL",
    duration: "1 tick"
  },
  { 
    id: "fall", 
    name: "Fall", 
    condition: (_, digits) => {
      if (digits.length < 2) return false;
      return digits[digits.length - 1] < digits[digits.length - 2];
    }, 
    type: "RISE_FALL",
    duration: "1 tick"
  },
  { 
    id: "matches", 
    name: "Matches", 
    condition: () => true, 
    type: "MATCHES",
    duration: "1 tick"
  },
  { 
    id: "differs", 
    name: "Differs", 
    condition: () => true, 
    type: "DIFFERS",
    duration: "1 tick"
  },
  { 
    id: "even", 
    name: "Even", 
    condition: (d, digits) => {
      const ma5 = getMovingAverage(digits, 5);
      const overallAvg = getMovingAverage(digits, digits.length);
      return ma5 > overallAvg && [6, 8].includes(d);
    }, 
    type: "EVEN_BIAS",
    duration: "1 tick",
    entryDigits: [6, 8]
  },
  { 
    id: "odd", 
    name: "Odd", 
    condition: (d, digits) => {
      const ma5 = getMovingAverage(digits, 5);
      const overallAvg = getMovingAverage(digits, digits.length);
      return ma5 < overallAvg && [1, 3, 5].includes(d);
    }, 
    type: "ODD_BIAS",
    duration: "1 tick",
    entryDigits: [1, 3, 5]
  },
  { 
    id: "over1", 
    name: "Over 1", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      return freqs[0].freq < 10 && freqs[1].freq < 10;
    }, 
    type: "OVER_BIAS",
    duration: "1 tick",
    entryDigits: [1]
  },
  { 
    id: "over2", 
    name: "Over 2", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      return freqs[0].freq < 10 && freqs[1].freq < 10 && freqs[2].freq < 10;
    }, 
    type: "OVER_BIAS",
    duration: "1 tick",
    entryDigits: [0, 2]
  },
  { 
    id: "over3", 
    name: "Over 3", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      return freqs[0].freq < 10 && freqs[1].freq < 10 && freqs[2].freq < 10 && freqs[3].freq < 10;
    }, 
    type: "OVER_BIAS",
    duration: "2-3 ticks",
    entryDigits: [1, 3]
  },
  { 
    id: "over4", 
    name: "Over 4", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      const below10 = [0, 1, 2, 3, 4].filter(i => freqs[i].freq < 10).length;
      return below10 >= 3;
    }, 
    type: "OVER_BIAS",
    duration: "2-3 ticks",
    entryDigits: [2, 4]
  },
  { 
    id: "over5", 
    name: "Over 5", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      const below10 = [0, 1, 2, 3, 4, 5].filter(i => freqs[i].freq < 10).length;
      return below10 >= 3;
    }, 
    type: "OVER_BIAS",
    duration: "3-5 ticks",
    entryDigits: [1, 3, 5]
  },
  { 
    id: "under9", 
    name: "Under 9", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      return freqs[9].freq < 10;
    }, 
    type: "UNDER_BIAS",
    duration: "1 tick",
    entryDigits: [9, 0]
  },
  { 
    id: "under8", 
    name: "Under 8", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      return freqs[8].freq < 10 && freqs[9].freq < 10 && freqs[7].freq >= 10.3;
    }, 
    type: "UNDER_BIAS",
    duration: "1 tick",
    entryDigits: [7]
  },
  { 
    id: "under7", 
    name: "Under 7", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      return freqs[7].freq < 10 && freqs[8].freq < 10 && freqs[9].freq < 10 && freqs[6].freq >= 10.3;
    }, 
    type: "UNDER_BIAS",
    duration: "2-3 ticks",
    entryDigits: [6]
  },
  { 
    id: "under6", 
    name: "Under 6", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      return freqs[6].freq < 10 && freqs[7].freq < 10 && freqs[8].freq < 10 && freqs[9].freq < 10 && freqs[5].freq >= 10.3;
    }, 
    type: "UNDER_BIAS",
    duration: "2-3 ticks",
    entryDigits: [6]
  },
  { 
    id: "under5", 
    name: "Under 5", 
    condition: (d, digits) => {
      const freqs = getDigitFrequencies(digits);
      const highBelow10 = [5, 6, 7, 8, 9].every(i => freqs[i].freq < 10);
      const lowAbove10 = [0, 1, 2].every(i => freqs[i].freq >= 10.3);
      return highBelow10 && lowAbove10;
    }, 
    type: "UNDER_BIAS",
    duration: "3-5 ticks"
  },
];

export default function Signals() {
  const { activeMarket } = useMarket();
  const { digits } = useDerivWebSocket(activeMarket);

  const last100 = digits.slice(-100).map(d => d.digit);
  const freqs = getDigitFrequencies(last100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">AI Signals</h1>
        <Badge variant="outline" className="font-mono text-xs">Live Updating</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {SIGNAL_TYPES.map((sig) => {
          let hits = 0;
          let prob = 0;
          let streak = 0;
          let entryDigits = sig.entryDigits || [];

          if (sig.type === "MATCHES") {
            const top3 = [...freqs].sort((a, b) => b.freq - a.freq).slice(0, 3);
            entryDigits = top3.map(f => f.digit);
            prob = top3.reduce((acc, curr) => acc + curr.freq, 0) / 3;
            // For matches, streak is how many times any of the top 3 digits occurred in a row
            for (let i = last100.length - 1; i >= 0; i--) {
              if (entryDigits.includes(last100[i])) streak++;
              else break;
            }
          } else if (sig.type === "DIFFERS") {
            const bottom3 = [...freqs].sort((a, b) => a.freq - b.freq).slice(0, 3);
            entryDigits = bottom3.map(f => f.digit);
            prob = 100 - (bottom3.reduce((acc, curr) => acc + curr.freq, 0) / 3);
            // For differs, streak is how many times the last digit was NOT one of the bottom 3
            for (let i = last100.length - 1; i >= 0; i--) {
              if (!entryDigits.includes(last100[i])) streak++;
              else break;
            }
          } else {
            hits = last100.filter(d => sig.condition(d, last100)).length;
            prob = last100.length > 0 ? (hits / last100.length) * 100 : 0;
            for (let i = last100.length - 1; i >= 0; i--) {
              if (sig.condition(last100[i], last100.slice(0, i + 1))) streak++;
              else break;
            }
          }

          const isReady = sig.condition(last100[last100.length - 1] || 0, last100);
          
          let badgeText = "NOT READY";
          let badgeColor = "bg-muted/20 text-muted-foreground border-border";

          if (isReady) {
            badgeText = "READY";
            badgeColor = "bg-green-500/20 text-green-500 border-green-500/30";
          } else if (prob >= 50) {
            badgeText = "WAIT";
            badgeColor = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
          }

          return (
            <Card key={sig.id} className="bg-card border-border overflow-hidden">
              <div className={`h-1 w-full ${isReady ? 'bg-green-500' : 'bg-muted'} opacity-50`} />
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-lg">{sig.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{sig.type.replace('_', ' ')}</div>
                  </div>
                  <Badge variant="outline" className={badgeColor}>{badgeText}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Probability</div>
                    <div className={`text-2xl font-mono font-bold ${prob > 60 ? 'text-primary' : 'text-foreground'}`}>
                      {prob.toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Streak</div>
                    <div className="text-2xl font-mono font-bold text-foreground">
                      {streak}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Entry Digits</div>
                      <div className="text-sm font-mono font-bold">
                        {entryDigits.length > 0 ? entryDigits.join(', ') : 'Any'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Duration</div>
                      <div className="text-sm font-mono font-bold">
                        {sig.duration || '1-3 ticks'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5 uppercase font-medium">
                      <span>Signal Strength</span>
                      <span>100 ticks</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${isReady ? 'bg-green-500' : 'bg-primary'} transition-all duration-500`} style={{ width: `${prob}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
