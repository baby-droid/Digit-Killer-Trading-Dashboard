import { useState, useEffect, useCallback, useRef } from "react";
import { useDerivMultiMarket } from "@/hooks/useDerivMultiMarket";
import { MARKETS, MARKETS_BY_CATEGORY, CATEGORY_LABELS, MarketCategory } from "@/hooks/useDerivWebSocket";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Zap, Clock, Sparkles, Timer, Activity, TrendingDown, TrendingUp } from "lucide-react";

const SIGNAL_VALIDITY_MS = 20 * 60 * 1000;
const CONTACT = "0768925411";
const AUTHOR = "AHMED AI";

const THEMES = [
  { id: 1, name: "Cyber Teal",   primary: "#00d1d1", bg1: "#000000", bg2: "#001a1a", accent: "#00ffff" },
  { id: 2, name: "Gold Cosmos",  primary: "#f59e0b", bg1: "#0a0020", bg2: "#1a0040", accent: "#fde68a" },
  { id: 3, name: "Matrix Green", primary: "#00ff41", bg1: "#000000", bg2: "#001200", accent: "#39ff14" },
  { id: 4, name: "Neon Night",   primary: "#a855f7", bg1: "#050012", bg2: "#0d0030", accent: "#e879f9" },
  { id: 5, name: "Fire Steel",   primary: "#ef4444", bg1: "#0a0000", bg2: "#200000", accent: "#f97316" },
];

const CATEGORY_ICONS: Partial<Record<MarketCategory, React.ReactNode>> = {
  volatility: <Activity className="w-3.5 h-3.5" />,
  crash_boom: <TrendingDown className="w-3.5 h-3.5" />,
  jump:       <Zap className="w-3.5 h-3.5" />,
  bear_bull:  <TrendingUp className="w-3.5 h-3.5" />,
};

type GeneratedSignal = {
  id: string;
  market: string;
  marketName: string;
  category: MarketCategory;
  tradeType: string;
  subLabel?: string;
  entryDigit: string;
  ticks: string;
  confidence: number;
  risk: "Low" | "Medium" | "High";
  contractGroup: string;
  generatedAt: number;
  validUntil: number;
  theme: number;
  reason: string;
};

function generateSignals(marketsData: Record<string, { digits: number[]; lastDigit: number | null }>): GeneratedSignal[] {
  const signals: GeneratedSignal[] = [];
  const now = Date.now();
  let themeCounter = 0;

  Object.entries(marketsData).forEach(([symbol, data]) => {
    if (data.digits.length < 30) return;
    const mkt = MARKETS.find((m) => m.symbol === symbol);
    if (!mkt) return;

    const freqs = new Array(10).fill(0);
    data.digits.slice(-100).forEach((d) => freqs[d]++);
    const total = Math.min(data.digits.length, 100);
    const pct = freqs.map((f) => (f / total) * 100);

    const maxPct    = Math.max(...pct);
    const minPct    = Math.min(...pct);
    const maxDigit  = pct.indexOf(maxPct);
    const minDigit  = pct.indexOf(minPct);
    const evenPct   = [0, 2, 4, 6, 8].reduce((s, d) => s + pct[d], 0);
    const oddPct    = [1, 3, 5, 7, 9].reduce((s, d) => s + pct[d], 0);
    const overPct   = [5, 6, 7, 8, 9].reduce((s, d) => s + pct[d], 0);

    const base = {
      market: symbol,
      marketName: mkt.name,
      category: mkt.category,
      generatedAt: now,
      validUntil: now + SIGNAL_VALIDITY_MS,
    };
    const nt = (): 1|2|3|4|5 => (((themeCounter++) % 5) + 1) as 1|2|3|4|5;
    const push = (o: Omit<GeneratedSignal, "market"|"marketName"|"category"|"generatedAt"|"validUntil">) =>
      signals.push({ ...base, ...o });

    // ── EVEN · ODD · MATCHES · DIFFERS ───────────────────────────────────────
    if (maxPct > 14)
      push({ id: `${symbol}-match`, theme: nt(), tradeType: "MATCHES", entryDigit: `Digit ${maxDigit}`, ticks: "1 tick", risk: "Low", contractGroup: "Digit Types", confidence: Math.min(85, 60 + maxPct * 1.5), reason: `Digit ${maxDigit} at ${maxPct.toFixed(1)}% of last 100 ticks — statistically hot` });

    if (minPct < 7)
      push({ id: `${symbol}-differ`, theme: nt(), tradeType: "DIFFERS", entryDigit: `Digit ${minDigit}`, ticks: "1 tick", risk: "Low", contractGroup: "Digit Types", confidence: Math.min(82, 55 + (10 - minPct) * 2), reason: `Digit ${minDigit} only ${minPct.toFixed(1)}% — statistically cold` });

    if (evenPct > 54)
      push({ id: `${symbol}-even`, theme: nt(), tradeType: "EVEN", entryDigit: "Even digit entry", ticks: "1 tick", risk: "Low", contractGroup: "Digit Types", confidence: Math.min(78, 50 + evenPct - 50), reason: `Even digits at ${evenPct.toFixed(1)}% frequency` });
    else if (oddPct > 54)
      push({ id: `${symbol}-odd`, theme: nt(), tradeType: "ODD", entryDigit: "Odd digit entry", ticks: "1 tick", risk: "Low", contractGroup: "Digit Types", confidence: Math.min(78, 50 + oddPct - 50), reason: `Odd digits at ${oddPct.toFixed(1)}% frequency` });

    // ── OVER / UNDER ──────────────────────────────────────────────────────────
    if (overPct > 60)
      push({ id: `${symbol}-over4`, theme: nt(), tradeType: "OVER 4", entryDigit: "Digits 2–4", ticks: "2–3 ticks", risk: "Medium", contractGroup: "Over / Under", confidence: Math.min(85, 55 + overPct - 55), reason: `High digits 5–9 very dominant at ${overPct.toFixed(1)}%` });
    else if (overPct > 55)
      push({ id: `${symbol}-over5`, theme: nt(), tradeType: "OVER 5", entryDigit: "Digits 2–4", ticks: "2–3 ticks", risk: "Medium", contractGroup: "Over / Under", confidence: Math.min(80, 55 + overPct - 55), reason: `High digits 5–9 dominant at ${overPct.toFixed(1)}%` });

    if (overPct < 40)
      push({ id: `${symbol}-under4`, theme: nt(), tradeType: "UNDER 4", entryDigit: "Digits 5–7", ticks: "2–3 ticks", risk: "Medium", contractGroup: "Over / Under", confidence: Math.min(85, 55 + (45 - overPct)), reason: `Low digits 0–4 very dominant — over ${(100 - overPct).toFixed(1)}%` });
    else if (overPct < 45)
      push({ id: `${symbol}-under5`, theme: nt(), tradeType: "UNDER 5", entryDigit: "Digits 5–7", ticks: "2–3 ticks", risk: "Medium", contractGroup: "Over / Under", confidence: Math.min(80, 55 + (45 - overPct)), reason: `Low digits 0–4 dominant` });

    if (pct[0] < 7 && pct[1] < 7)
      push({ id: `${symbol}-over1`, theme: nt(), tradeType: "OVER 1", entryDigit: "Digits 0–1", ticks: "1–2 ticks", risk: "Low", contractGroup: "Over / Under", confidence: 72, reason: `Digits 0–1 underrepresented at ${(pct[0]+pct[1]).toFixed(1)}%` });

    if (pct[8] < 7 && pct[9] < 7)
      push({ id: `${symbol}-under9`, theme: nt(), tradeType: "UNDER 9", entryDigit: "Digits 8–9", ticks: "1–2 ticks", risk: "Low", contractGroup: "Over / Under", confidence: 70, reason: `Digits 8–9 underrepresented at ${(pct[8]+pct[9]).toFixed(1)}%` });

    if (pct[9] > 14)
      push({ id: `${symbol}-over8`, theme: nt(), tradeType: "OVER 8", entryDigit: "Digits 6–7", ticks: "1–2 ticks", risk: "Low", contractGroup: "Over / Under", confidence: Math.min(82, 55 + (pct[9] - 10) * 2), reason: `Digit 9 at ${pct[9].toFixed(1)}% — very high frequency` });

    // ── RISE / FALL ───────────────────────────────────────────────────────────
    const recent8 = data.digits.slice(-8);
    let riseTrend = 0;
    recent8.forEach((d, i) => { if (i > 0 && d >= recent8[i - 1]) riseTrend++; });
    const fallTrend = recent8.length - 1 - riseTrend;

    if (riseTrend >= 6)
      push({ id: `${symbol}-rise`, theme: nt(), tradeType: "RISE", entryDigit: "Current price", ticks: "5 ticks", risk: "Medium", contractGroup: "Rise / Fall", confidence: Math.min(80, 60 + riseTrend * 3), reason: `${riseTrend}/7 last digits rising — bullish momentum` });
    if (fallTrend >= 6)
      push({ id: `${symbol}-fall`, theme: nt(), tradeType: "FALL", entryDigit: "Current price", ticks: "5 ticks", risk: "Medium", contractGroup: "Rise / Fall", confidence: Math.min(80, 60 + fallTrend * 3), reason: `${fallTrend}/7 last digits falling — bearish momentum` });

    // ── HIGH TICK / LOW TICK ──────────────────────────────────────────────────
    const recent5 = data.digits.slice(-5);
    if (recent5.length === 5) {
      const maxR = Math.max(...recent5);
      const minR = Math.min(...recent5);
      push({ id: `${symbol}-high`, theme: nt(), tradeType: "HIGH TICK", entryDigit: `Digit ${maxR}`, ticks: "5 ticks", risk: "Medium", contractGroup: "High / Low Tick", confidence: Math.min(75, 60 + (pct[maxR] > 12 ? 15 : pct[maxR] > 10 ? 8 : 0)), reason: `Digit ${maxR} is period high — ${pct[maxR].toFixed(1)}% frequency` });
      push({ id: `${symbol}-low`, theme: nt(), tradeType: "LOW TICK", entryDigit: `Digit ${minR}`, ticks: "5 ticks", risk: "Medium", contractGroup: "High / Low Tick", confidence: Math.min(75, 60 + (pct[minR] > 12 ? 15 : pct[minR] > 10 ? 8 : 0)), reason: `Digit ${minR} is period low — ${pct[minR].toFixed(1)}% frequency` });
    }

    // ── IN / OUT ──────────────────────────────────────────────────────────────
    const recent20 = data.digits.slice(-20);
    if (recent20.length >= 20) {
      const spread = Math.max(...recent20) - Math.min(...recent20);
      const midPct = [3, 4, 5, 6].reduce((s, d) => s + pct[d], 0);
      if (spread <= 4)
        push({ id: `${symbol}-in-stay`, theme: nt(), tradeType: "IN (Stay In)", entryDigit: "Current barrier", ticks: "5 ticks", risk: "Low", contractGroup: "In / Out", confidence: 72, reason: `Last 20 digits in tight range (${Math.min(...recent20)}–${Math.max(...recent20)})` });
      if (spread >= 8)
        push({ id: `${symbol}-out`, theme: nt(), tradeType: "OUT (Exit)", entryDigit: "Current barrier", ticks: "5 ticks", risk: "Medium", contractGroup: "In / Out", confidence: 70, reason: `Price volatile — last 20 digits spanning ${spread} range` });
      if (midPct > 44)
        push({ id: `${symbol}-in-mid`, theme: nt(), tradeType: "IN (Mid Range)", entryDigit: "Mid barrier", ticks: "3 ticks", risk: "Low", contractGroup: "In / Out", confidence: Math.min(76, 50 + midPct - 40), reason: `Mid digits 3–6 at ${midPct.toFixed(1)}% frequency` });
    }

    // ── ACCUMULATORS ──────────────────────────────────────────────────────────
    const recent10 = data.digits.slice(-10);
    if (recent10.length >= 10) {
      const variance = recent10.reduce((s, d) => s + Math.abs(d - 5), 0) / recent10.length;
      if (variance < 2.5)
        push({ id: `${symbol}-accu-g`, theme: nt(), tradeType: "ACCUMULATOR", subLabel: "Growth 1%", entryDigit: "±0.01% barrier", ticks: "5–20 ticks", risk: "Low", contractGroup: "Accumulators", confidence: 74, reason: `Low digit variance (${variance.toFixed(2)}) — price stable, accumulate growth` });
      else if (maxPct > 12 && maxPct < 18)
        push({ id: `${symbol}-accu-s`, theme: nt(), tradeType: "ACCUMULATOR", subLabel: "Steady trend", entryDigit: "Current barrier", ticks: "10–30 ticks", risk: "Low", contractGroup: "Accumulators", confidence: 70, reason: `Consistent digit pattern — accumulate safely` });
    }

    // ── ASIANS ────────────────────────────────────────────────────────────────
    const last20 = data.digits.slice(-20);
    if (last20.length >= 20) {
      const avg = last20.reduce((s, d) => s + d, 0) / last20.length;
      const avgLastDigit = Math.round(avg) % 10;
      if (avg > 5.2)
        push({ id: `${symbol}-asian-over`, theme: nt(), tradeType: "ASIAN OVER", entryDigit: `Avg digit ${avg.toFixed(2)}`, ticks: "End of period", risk: "Medium", contractGroup: "Asians", confidence: Math.min(78, 68 + Math.round((avg - 5) * 5)), reason: `20-tick average last digit = ${avg.toFixed(2)} (above 5)` });
      if (avg < 4.8)
        push({ id: `${symbol}-asian-under`, theme: nt(), tradeType: "ASIAN UNDER", entryDigit: `Avg digit ${avg.toFixed(2)}`, ticks: "End of period", risk: "Medium", contractGroup: "Asians", confidence: Math.min(78, 68 + Math.round((5 - avg) * 5)), reason: `20-tick average last digit = ${avg.toFixed(2)} (below 5)` });
      const evenAvg = avg % 1 < 0.3 || avg % 1 > 0.7;
      if (evenAvg && avgLastDigit % 2 === 0)
        push({ id: `${symbol}-asian-even`, theme: nt(), tradeType: "ASIAN EVEN", entryDigit: `Digit ${avgLastDigit}`, ticks: "End of period", risk: "Medium", contractGroup: "Asians", confidence: 66, reason: `Average digit rounds to ${avgLastDigit} (even)` });
    }
  });

  return signals.sort((a, b) => b.confidence - a.confidence);
}

// ─── Canvas flyer (themes apply only to the PNG, not the UI cards) ──────────
function drawThemeBackground(ctx: CanvasRenderingContext2D, W: number, H: number, theme: typeof THEMES[0]) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.bg1);
  grad.addColorStop(1, theme.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (theme.id === 1) {
    ctx.strokeStyle = `${theme.primary}22`; ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 35) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 35) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  } else if (theme.id === 2) {
    for (let i = 0; i < 80; i++) {
      const x = Math.random()*W, y = Math.random()*H, r = Math.random()*1.5+0.5;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.6+0.1})`; ctx.fill();
    }
  } else if (theme.id === 3) {
    ctx.font="10px monospace"; ctx.fillStyle=`${theme.primary}20`;
    for (let col=0; col<W; col+=16) {
      const rows=Math.floor(Math.random()*8)+4;
      for (let row=0; row<rows; row++) ctx.fillText(Math.random()>0.5?"1":"0",col,row*18+Math.random()*20);
    }
  } else if (theme.id === 4) {
    ctx.strokeStyle=`${theme.primary}18`; ctx.lineWidth=1;
    const s=50;
    for (let col=0; col<W+s; col+=s*1.5)
      for (let row=0; row<H+s; row+=s*0.866*2) {
        for (let i=0;i<6;i++){const a=(i*60-30)*Math.PI/180;const nx=col+Math.cos(a)*s*0.5;const ny=row+Math.sin(a)*s*0.5;if(i===0)ctx.moveTo(nx,ny);else ctx.lineTo(nx,ny);}
        ctx.closePath(); ctx.stroke();
      }
  } else {
    ctx.strokeStyle=`${theme.primary}15`; ctx.lineWidth=1;
    for (let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(Math.random()*W,0);ctx.lineTo(Math.random()*W,H);ctx.stroke();}
  }
}

function drawFlyer(signal: GeneratedSignal, logoUrl: string) {
  const W = 800, H = 500;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const theme = THEMES.find((t) => t.id === signal.theme) ?? THEMES[0];

  const execute = (logoImg: HTMLImageElement | null) => {
    drawThemeBackground(ctx, W, H, theme);

    ctx.strokeStyle = theme.primary; ctx.lineWidth = 3;
    ctx.shadowColor = theme.primary; ctx.shadowBlur = 15;
    ctx.strokeRect(10,10,W-20,H-20); ctx.shadowBlur = 0;
    ctx.strokeStyle = `${theme.accent}40`; ctx.lineWidth = 1;
    ctx.strokeRect(20,20,W-40,H-40);

    if (logoImg) {
      ctx.save(); ctx.beginPath(); ctx.arc(70,70,48,0,Math.PI*2); ctx.clip();
      ctx.drawImage(logoImg,22,22,96,96); ctx.restore();
      ctx.beginPath(); ctx.arc(70,70,48,0,Math.PI*2);
      ctx.strokeStyle=theme.primary; ctx.lineWidth=2; ctx.stroke();
    }

    ctx.font="bold 11px monospace"; ctx.fillStyle=theme.primary; ctx.letterSpacing="3px";
    ctx.fillText("AHMED SYNTRADER",140,52); ctx.letterSpacing="0px";
    ctx.font="bold 28px monospace"; ctx.fillStyle="#ffffff"; ctx.fillText("AHMED AI SIGNALS",140,88);
    ctx.font="11px monospace"; ctx.fillStyle=`${theme.primary}aa`;
    ctx.fillText(`ahmedsyntrader.site  ·  ${CONTACT}`,140,110);

    ctx.strokeStyle=`${theme.primary}60`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(30,130); ctx.lineTo(W-30,130); ctx.stroke();

    ctx.font="bold 44px monospace"; ctx.fillStyle=theme.primary;
    ctx.shadowColor=theme.primary; ctx.shadowBlur=20;
    ctx.fillText(signal.tradeType,50,195); ctx.shadowBlur=0;

    ctx.font="bold 14px monospace"; ctx.fillStyle=theme.accent;
    ctx.fillText(signal.marketName.toUpperCase(),W-220,165);
    ctx.font="11px monospace"; ctx.fillStyle=`${theme.primary}99`;
    ctx.fillText(signal.market,W-220,185);

    const rows=[
      {label:"📌  ENTRY POINT",value:signal.entryDigit},
      {label:"⏱  DURATION",value:signal.ticks},
      {label:"📊  CONFIDENCE",value:`${signal.confidence}%`},
      {label:"🔍  SIGNAL BASIS",value:signal.reason},
      {label:"⏳  VALID FOR",value:"20 MINUTES"},
    ];
    let ry=240;
    rows.forEach(({label,value})=>{
      ctx.font="11px monospace"; ctx.fillStyle=`${theme.primary}99`; ctx.fillText(label,50,ry);
      ctx.font="bold 15px monospace"; ctx.fillStyle="#ffffff";
      ctx.fillText(value.length>45?value.slice(0,45)+"...":value,50,ry+20);
      ry+=50;
    });

    ctx.strokeStyle=`${theme.primary}40`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(30,H-70); ctx.lineTo(W-30,H-70); ctx.stroke();
    ctx.font="bold 13px monospace"; ctx.fillStyle=theme.primary; ctx.textAlign="center";
    ctx.fillText(`Made by ${AUTHOR}  ·  ${CONTACT}  ·  ahmedsyntrader.site`,W/2,H-42);
    ctx.font="10px monospace"; ctx.fillStyle=`${theme.primary}70`;
    ctx.fillText("Risk Disclaimer: Trading involves risk. Past signals do not guarantee future results.",W/2,H-22);
    ctx.textAlign="left";

    const link=document.createElement("a");
    link.download=`AhmedSignal_${signal.tradeType.replace(/\s+/g,"_")}_${signal.marketName}_${Date.now()}.png`;
    link.href=canvas.toDataURL("image/png"); link.click();
  };

  const img = new Image();
  img.crossOrigin="anonymous";
  img.onload=()=>execute(img); img.onerror=()=>execute(null);
  img.src=logoUrl;
}

// ─── Countdown timer component ───────────────────────────────────────────────
function CountdownTimer({ validUntil }: { validUntil: number }) {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, validUntil - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(Math.max(0, validUntil - Date.now())), 1000);
    return () => clearInterval(t);
  }, [validUntil]);
  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);
  const pct  = Math.max(0, (timeLeft / SIGNAL_VALIDITY_MS) * 100);
  const color = pct > 50 ? "text-green-400" : pct > 20 ? "text-yellow-400" : "text-red-400";
  const bar   = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <Timer className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
      <span className={`font-mono text-xs font-bold flex-shrink-0 ${color}`}>
        {timeLeft <= 0 ? "EXPIRED" : `${mins}:${secs.toString().padStart(2, "0")}`}
      </span>
      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const CONTRACT_COLORS: Record<string, string> = {
  RISE: "text-green-500", FALL: "text-red-500",
  EVEN: "text-blue-400", ODD: "text-orange-400",
  MATCHES: "text-primary", DIFFERS: "text-red-400",
  ACCUMULATOR: "text-yellow-500",
  "HIGH TICK": "text-green-300", "LOW TICK": "text-red-300",
  "IN (Stay In)": "text-primary", "IN (Mid Range)": "text-primary", "OUT (Exit)": "text-orange-400",
  "ASIAN OVER": "text-green-400", "ASIAN UNDER": "text-red-400", "ASIAN EVEN": "text-blue-300",
  "OVER": "text-primary", "UNDER": "text-orange-400",
};

const GROUP_COLORS: Record<string, string> = {
  "Digit Types":    "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Over / Under":   "bg-primary/10 text-primary border-primary/30",
  "Rise / Fall":    "bg-green-500/10 text-green-400 border-green-500/30",
  "High / Low Tick":"bg-purple-500/10 text-purple-400 border-purple-500/30",
  "In / Out":       "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  "Accumulators":   "bg-orange-500/10 text-orange-400 border-orange-500/30",
  "Asians":         "bg-pink-500/10 text-pink-400 border-pink-500/30",
};

const RISK_COLORS = { Low: "bg-green-500", Medium: "bg-yellow-500", High: "bg-red-500" };

function contractColor(type: string) {
  return Object.entries(CONTRACT_COLORS).find(([k]) => type.startsWith(k) || type === k)?.[1] ?? "text-foreground";
}

const CAT_LABELS: Record<MarketCategory, string> = {
  volatility: "Volatility",
  crash_boom: "Crash · Boom",
  jump:       "Jump",
  bear_bull:  "Bear · Bull",
  forex: "Forex",
  indices: "Indices",
  commodities: "Commodities",
  cryptocurrencies: "Cryptocurrencies",
  stocks: "Stocks",
  other: "Other",
};

const CAT_COLORS: Record<MarketCategory, string> = {
  volatility: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  crash_boom: "bg-red-500/10 text-red-400 border-red-500/30",
  jump:       "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  bear_bull:  "bg-green-500/10 text-green-400 border-green-500/30",
  forex: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  indices: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  commodities: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  cryptocurrencies: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  stocks: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  other: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

type CategoryFilter = "all" | MarketCategory;

export default function SmartSignals() {
  const marketsData = useDerivMultiMarket();
  const [signals, setSignals] = useState<GeneratedSignal[]>([]);
  const [lastGenerated, setLastGenerated] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`.replace("//", "/");

  const prevHighCount = useRef(0);

  const refresh = useCallback(() => {
    const simplified: Record<string, { digits: number[]; lastDigit: number | null }> = {};
    Object.entries(marketsData).forEach(([sym, d]) => {
      simplified[sym] = { digits: d.digits, lastDigit: d.lastDigit };
    });
    const newSigs = generateSignals(simplified);
    setSignals(newSigs);
    setLastGenerated(Date.now());
    const highConf = newSigs.filter(s => s.confidence >= 75).length;
    if (highConf > prevHighCount.current) {
      import("@/lib/sound").then(m => m.playBuySound());
    } else if (highConf === 0 && prevHighCount.current > 0) {
      import("@/lib/sound").then(m => m.playWarnSound());
    }
    prevHighCount.current = highConf;
  }, [marketsData]);

  useEffect(() => {
    if (Object.values(marketsData).some((d) => d.digits.length >= 30) && signals.length === 0) refresh();
  }, [marketsData, signals.length, refresh]);

  useEffect(() => {
    if (lastGenerated === 0) return;
    const t = setTimeout(refresh, SIGNAL_VALIDITY_MS);
    return () => clearTimeout(t);
  }, [lastGenerated, refresh]);

  const totalMarkets  = Object.keys(marketsData).length;
  const readyMarkets  = Object.values(marketsData).filter((d) => d.digits.length >= 30).length;

  const filtered = categoryFilter === "all"
    ? signals
    : signals.filter((s) => s.category === categoryFilter);

  // Count signals per category for badges
  const visibleCategories = (Object.keys(MARKETS_BY_CATEGORY) as MarketCategory[])
    .filter((cat) => MARKETS_BY_CATEGORY[cat].length > 0);
  const catCounts = visibleCategories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = signals.filter((s) => s.category === cat).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="h-0.5 rounded-full -mb-2" style={{ background: "linear-gradient(to right,#ec4899,transparent)" }} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "#ec4899" }}>
            <Sparkles className="w-6 h-6" style={{ color: "#ec4899" }} /> Smart Signals
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI signals valid 20 min · Download branded PNG flyers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">
            {readyMarkets}/{totalMarkets} markets ready
          </span>
          <button
            onClick={refresh}
            disabled={readyMarkets === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Generate Signals
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap border-b border-border pb-3">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            categoryFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All Markets
          {signals.length > 0 && (
            <span className="ml-1.5 text-[10px] opacity-70">{signals.length}</span>
          )}
        </button>

        {visibleCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors border ${
              categoryFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : `${CAT_COLORS[cat]} hover:opacity-80`
            }`}
          >
            {CATEGORY_ICONS[cat] ?? <Activity className="w-3.5 h-3.5" />}
            {CAT_LABELS[cat]}
            {catCounts[cat] > 0 && (
              <span className="text-[10px] opacity-80">{catCounts[cat]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty / Loading */}
      {signals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-3">
          <Sparkles className="w-10 h-10 opacity-20" />
          <p className="font-bold text-sm">Collecting market data...</p>
          <p className="text-xs">Need 30+ ticks per market · click Generate Signals when ready</p>
          <div className="w-56 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(readyMarkets / Math.max(totalMarkets, 1)) * 100}%` }} />
          </div>
          <p className="text-[11px] font-mono">{readyMarkets} / {totalMarkets} ready</p>
        </div>
      )}

      {signals.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
          <p className="font-bold text-sm">No signals for {CAT_LABELS[categoryFilter as MarketCategory]}</p>
          <p className="text-xs">Switch to "All Markets" or generate fresh signals</p>
        </div>
      )}

      {/* Signal Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((sig) => (
            <div
              key={sig.id}
              className="bg-card border border-border rounded-lg overflow-hidden hover:border-border/70 transition-colors"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground font-mono uppercase truncate">{sig.marketName}</div>
                  <div className={`text-xl font-black font-mono leading-tight ${contractColor(sig.tradeType)}`}>
                    {sig.tradeType}
                    {sig.subLabel && <span className="text-xs ml-2 font-normal opacity-70">{sig.subLabel}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <Badge variant="outline" className={`text-[9px] px-1.5 ${CAT_COLORS[sig.category]}`}>
                    {CAT_LABELS[sig.category]}
                  </Badge>
                  <div className="text-xl font-black text-primary font-mono">{sig.confidence}%</div>
                </div>
              </div>

              {/* Card body */}
              <div className="px-4 py-3 space-y-3">
                {/* Contract group + risk row */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-[9px] px-2 ${GROUP_COLORS[sig.contractGroup] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {sig.contractGroup}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <div className={`w-2 h-2 rounded-full ${RISK_COLORS[sig.risk]}`} />
                    <span className="font-bold uppercase text-muted-foreground">{sig.risk} risk</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-muted rounded px-2 py-1.5">
                    <div className="text-muted-foreground">Entry</div>
                    <div className="font-bold font-mono">{sig.entryDigit}</div>
                  </div>
                  <div className="bg-muted rounded px-2 py-1.5">
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" /> Ticks
                    </div>
                    <div className="font-bold font-mono">{sig.ticks}</div>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground leading-relaxed bg-muted/50 rounded px-2 py-1.5">
                  {sig.reason}
                </div>

                <CountdownTimer validUntil={sig.validUntil} />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => drawFlyer(sig, logoUrl)}
                    className="flex items-center justify-center gap-1.5 py-2 border border-primary/40 text-primary rounded text-xs font-bold hover:bg-primary/10 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Flyer
                  </button>
                  <div className="flex items-center justify-center gap-1.5 py-2 bg-muted rounded text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(sig.generatedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flyer themes legend */}
      {signals.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-muted-foreground border-t border-border">
          <span className="font-bold uppercase">Flyer themes:</span>
          {THEMES.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.primary }} />
              <span>{t.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
