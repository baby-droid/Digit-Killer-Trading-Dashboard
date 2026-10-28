import { useState, useMemo, useEffect, useRef } from "react";
import { playBuySound, playWarnSound } from "@/lib/sound";
import {
  useDerivWebSocket,
} from "@/hooks/useDerivWebSocket";
import { MarketSelector } from "@/components/market-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Activity } from "lucide-react";

/* ── page accent colour ─────────────────────────────────────────────────── */
const ACCENT = "#16a34a"; // dark green

/* ── rank colour palette ────────────────────────────────────────────────── */
const RANK_COLORS = {
  highest:    { bg: "#15803d", border: "#22c55e", text: "#fff", label: "highest %",    glow: "0 0 12px rgba(34,197,94,0.55)" },
  second_high:{ bg: "#1e3a8a", border: "#3b82f6", text: "#fff", label: "2nd highest %", glow: "0 0 10px rgba(59,130,246,0.45)" },
  second_low: { bg: "#713f12", border: "#eab308", text: "#fff", label: "2nd lowest %",  glow: "0 0 10px rgba(234,179,8,0.4)" },
  lowest:     { bg: "#7f1d1d", border: "#ef4444", text: "#fff", label: "lowest %",      glow: "0 0 10px rgba(239,68,68,0.45)" },
};

/* ── per-digit colour palette (used for triangle track) ─────────────────── */
const D_COLORS = [
  { bg: "#4f46e5", border: "#6366f1", text: "#fff" },
  { bg: "#2563eb", border: "#3b82f6", text: "#fff" },
  { bg: "#0891b2", border: "#06b6d4", text: "#fff" },
  { bg: "#059669", border: "#10b981", text: "#fff" },
  { bg: "#65a30d", border: "#84cc16", text: "#000" },
  { bg: "#d97706", border: "#f59e0b", text: "#000" },
  { bg: "#ea580c", border: "#f97316", text: "#fff" },
  { bg: "#dc2626", border: "#ef4444", text: "#fff" },
  { bg: "#db2777", border: "#ec4899", text: "#fff" },
  { bg: "#9333ea", border: "#a855f7", text: "#fff" },
];

/* ── Digit Circles ──────────────────────────────────────────────────────── */
function DigitCircles({ digits, lastDigit }: { digits: number[]; lastDigit: number | null }) {
  const total  = digits.length || 1;
  const counts = new Array(10).fill(0);
  digits.forEach((d) => counts[d]++);
  const pcts = counts.map((c) => (c / total) * 100);

  /* Unique sorted pct values (descending) — ties get the same rank color */
  const sortedUnique = [...new Set(pcts)].sort((a, b) => b - a);
  const n = sortedUnique.length;
  const highestVal     = n >= 1 ? sortedUnique[0]     : null;
  const lowestVal      = n >= 2 ? sortedUnique[n - 1] : null;
  const secondHighVal  = n >= 3 ? sortedUnique[1]     : null;
  const secondLowVal   = n >= 4 ? sortedUnique[n - 2] : null;

  function getRankStyle(i: number) {
    const p = pcts[i];
    if (highestVal !== null    && p === highestVal)    return RANK_COLORS.highest;
    if (lowestVal !== null     && p === lowestVal)     return RANK_COLORS.lowest;
    if (secondHighVal !== null && p === secondHighVal) return RANK_COLORS.second_high;
    if (secondLowVal !== null  && p === secondLowVal)  return RANK_COLORS.second_low;
    return null;
  }

  return (
    <div className="w-full" style={{ marginTop: 35, marginBottom: 25 }}>
      <div className="flex justify-between items-end" style={{ gap: 28 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const isCurrent = lastDigit === i;
          const rank      = getRankStyle(i);
          const bgColor   = rank ? rank.bg   : "#FFFFFF";
          const textColor = rank ? rank.text : "#1F2937";
          const border    = rank ? `2px solid ${rank.border}` : "2px solid #D9D9D9";
          const shadow    = rank
            ? rank.glow
            : "0 2px 6px rgba(0,0,0,0.10)";

          return (
            <div key={i} className="flex flex-col items-center flex-1" style={{ gap: 6 }}>
              {/* ── Purple triangle cursor (current digit only) ── */}
              <div className="flex items-end justify-center" style={{ height: 20 }}>
                {isCurrent && (
                  <div
                    style={{
                      width: 0, height: 0,
                      borderLeft: "7px solid transparent",
                      borderRight: "7px solid transparent",
                      borderTop: "12px solid #a855f7",
                      filter: "drop-shadow(0 0 5px rgba(168,85,247,0.9))",
                    }}
                  />
                )}
              </div>

              {/* ── Current digit → 84px blue outer ring wrapper ── */}
              {isCurrent ? (
                <div
                  className="rounded-full flex items-center justify-center select-none"
                  style={{
                    width: 84, height: 84,
                    border: "3px solid #4C7DFF",
                    borderRadius: "50%",
                    padding: 4,
                    boxShadow: shadow,
                  }}
                >
                  <div
                    className="rounded-full flex items-center justify-center w-full h-full"
                    style={{ backgroundColor: bgColor, border, flexDirection: "column" }}
                  >
                    <span style={{ fontSize: 22, fontWeight: 600, color: textColor, lineHeight: 1 }}>{i}</span>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-full flex items-center justify-center select-none"
                  style={{
                    width: 72, height: 72,
                    backgroundColor: bgColor,
                    border,
                    flexDirection: "column",
                    boxShadow: shadow,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 600, color: textColor, lineHeight: 1 }}>{i}</span>
                </div>
              )}

              {/* ── Percentage label ── */}
              <span
                className="text-center leading-none"
                style={{
                  fontSize: 13, fontWeight: 600,
                  color: rank ? rank.border : "#555",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {pcts[i].toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border-2" style={{ border: "2px solid #4C7DFF" }} />
          current digit
        </span>
        {Object.entries(RANK_COLORS).map(([, c]) => (
          <span key={c.label} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: c.bg, border: `1.5px solid ${c.border}` }} />
            {c.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#fff", border: "1.5px solid #D9D9D9" }} />
          normal
        </span>
      </div>
    </div>
  );
}

/* ── AI Signal engine — Even / Odd ──────────────────────────────────────── */
type SignalResult = {
  action: "BUY_ODD" | "BUY_EVEN" | "BUY_OVER" | "BUY_UNDER" | "WAIT" | "WARN";
  label: string;
  reason: string;
  accentColor: string;
};

function computeSignal(recent: number[], evenPct: number, oddPct: number): SignalResult {
  if (recent.length < 15) {
    return { action: "WAIT", label: "⏳ Collecting data…", reason: "Need at least 15 ticks", accentColor: "#6b7280" };
  }

  const last30 = recent.slice(-30);
  const last10 = recent.slice(-10);

  /* Build E/O string */
  const eoArr = last30.map(d => d % 2 === 0 ? "E" : "O");
  const eStr  = eoArr.join("");

  /* Ch 11: Balanced zone 48–52% — no clear edge */
  if (evenPct >= 48 && evenPct <= 52) {
    return {
      action: "WAIT",
      label: "⏳ BALANCED ZONE — NO EDGE",
      reason: `Even ${evenPct.toFixed(1)}% / Odd ${oddPct.toFixed(1)}% — market at 50/50, avoid trading (Ch 11)`,
      accentColor: "#6b7280",
    };
  }

  /* ── Warning: Liquidity sweep — 5+ consecutive then reversal */
  let tailStreak = 1;
  for (let k = eoArr.length - 2; k >= 0; k--) {
    if (eoArr[k] === eoArr[eoArr.length - 1]) tailStreak++;
    else break;
  }
  const beforeTail = eoArr.length - tailStreak - 1;
  if (beforeTail >= 0) {
    let prevRun = 0;
    const prevType = eoArr[beforeTail];
    for (let k = beforeTail; k >= 0; k--) {
      if (eoArr[k] === prevType) prevRun++; else break;
    }
    if (prevRun >= 5 && tailStreak >= 2) {
      return {
        action: "WARN",
        label: "⚠️ LIQUIDITY SWEEP — DO NOT TRADE",
        reason: `${prevRun}× ${prevType === "E" ? "EVEN" : "ODD"} run then sudden reversal — wait for market to settle (Ch 5)`,
        accentColor: "#f97316",
      };
    }
  }

  /* ── Warning: Extreme one-sided last 10 ticks ≥80% (Ch 6 manipulation) */
  const r10Even = last10.filter(d => d % 2 === 0).length;
  const r10EvenPct = (r10Even / last10.length) * 100;
  if (r10EvenPct >= 80 || r10EvenPct <= 20) {
    const side = r10EvenPct >= 80 ? "EVEN" : "ODD";
    const pct  = r10EvenPct >= 80 ? r10EvenPct : 100 - r10EvenPct;
    return {
      action: "WARN",
      label: "⚠️ EXTREME STREAK — DO NOT TRADE",
      reason: `${side} dominated last 10 ticks (${Math.round(pct)}%) — natural streak or manipulation, wait (Ch 6)`,
      accentColor: "#ef4444",
    };
  }

  /* ── Warning: FVG — rapid alternation EOEOEO */
  const last8 = eStr.slice(-8);
  let alternates = 0;
  for (let k = 1; k < last8.length; k++) {
    if (last8[k] !== last8[k - 1]) alternates++;
  }
  if (alternates >= 7) {
    return {
      action: "WARN",
      label: "⚠️ FAIR VALUE GAP — DO NOT TRADE",
      reason: "Rapid even/odd alternation — digit imbalance / market indecision (Ch 4 / Ch 11)",
      accentColor: "#eab308",
    };
  }

  /* ── Determine imbalance zone (Ch 7) */
  const dominant    = evenPct > oddPct ? "EVEN" : "ODD";
  const domPct      = Math.max(evenPct, oddPct);
  const zone        = domPct >= 65 ? "EXTREME" : domPct >= 60 ? "STRONG" : domPct >= 55 ? "MODERATE" : null;

  /* ── Entry: BUY ODD — pattern OEE (odd then 2 evens → odd pull-back) */
  if (eStr.slice(-3) === "OEE" && oddPct > 55) {
    return {
      action: "BUY_ODD",
      label: "🎯 ENTER NOW — BUY ODD",
      reason: `Pattern O→EE (odd absorption) · Odd ${oddPct.toFixed(1)}% ${zone ? `· ${zone} imbalance` : ""} (Ch 9/10)`,
      accentColor: "#ef4444",
    };
  }

  /* ── Entry: BUY EVEN — pattern EOO */
  if (eStr.slice(-3) === "EOO" && evenPct > 55) {
    return {
      action: "BUY_EVEN",
      label: "🎯 ENTER NOW — BUY EVEN",
      reason: `Pattern E→OO (even absorption) · Even ${evenPct.toFixed(1)}% ${zone ? `· ${zone} imbalance` : ""} (Ch 9/10)`,
      accentColor: "#22c55e",
    };
  }

  /* ── Entry: BUY EVEN — 3–5 odds then 2–3 evens */
  if (/O{3,5}E{2,3}$/.test(eStr) && evenPct > 55) {
    const oRun = (eStr.match(/O+(?=E{2,3}$)/) || [""])[0].length;
    const eRun = (eStr.match(/E{2,3}$/)       || [""])[0].length;
    return {
      action: "BUY_EVEN",
      label: "🎯 ENTER NOW — BUY EVEN",
      reason: `Pattern ${oRun}× ODD → ${eRun}× EVEN · Even ${evenPct.toFixed(1)}% ${zone ? `· ${zone} zone` : ""} (Ch 10)`,
      accentColor: "#22c55e",
    };
  }

  /* ── Entry: BUY ODD — 3–5 evens then 2–3 odds */
  if (/E{3,5}O{2,3}$/.test(eStr) && oddPct > 55) {
    const eRun = (eStr.match(/E+(?=O{2,3}$)/) || [""])[0].length;
    const oRun = (eStr.match(/O{2,3}$/)        || [""])[0].length;
    return {
      action: "BUY_ODD",
      label: "🎯 ENTER NOW — BUY ODD",
      reason: `Pattern ${eRun}× EVEN → ${oRun}× ODD · Odd ${oddPct.toFixed(1)}% ${zone ? `· ${zone} zone` : ""} (Ch 10)`,
      accentColor: "#ef4444",
    };
  }

  /* ── Imbalance-only signal (no pattern but strong zone) */
  if (zone === "STRONG" || zone === "EXTREME") {
    const buyAction = dominant === "ODD" ? "BUY_ODD" : "BUY_EVEN";
    return {
      action: buyAction,
      label: `🎯 ${zone} SIGNAL — BUY ${dominant}`,
      reason: `${dominant} at ${domPct.toFixed(1)}% (${zone} imbalance zone, Ch 7) — no pattern yet, watch for entry`,
      accentColor: dominant === "ODD" ? "#ef4444" : "#22c55e",
    };
  }

  return {
    action: "WAIT",
    label: "⏳ Scanning for entry…",
    reason: `Even ${evenPct.toFixed(1)}% · Odd ${oddPct.toFixed(1)}% — moderate range, wait for clear pattern (Ch 12)`,
    accentColor: "#6b7280",
  };
}

/* ── AI Signal engine — Over / Under ────────────────────────────────────── */
type OUSignalResult = {
  action: "BUY_OVER" | "BUY_UNDER" | "WAIT" | "WARN";
  label: string;
  reason: string;
  accentColor: string;
};

function computeOUSignal(digits: number[], threshold: number): OUSignalResult {
  if (digits.length < 15) {
    return { action: "WAIT", label: "⏳ Collecting data…", reason: "Need at least 15 ticks", accentColor: "#6b7280" };
  }

  const total       = digits.length;
  const overCount   = digits.filter(d => d > threshold).length;
  const underCount  = digits.filter(d => d < threshold).length;
  const overPct     = (overCount / total) * 100;
  const underPct    = (underCount / total) * 100;

  const last20  = digits.slice(-20);
  const last10  = digits.slice(-10);
  const last5   = digits.slice(-5);

  /* Ch 21: Balanced zone 48–52% → no edge */
  const winOverPct  = (last20.filter(d => d > threshold).length / last20.length) * 100;
  const winUnderPct = (last20.filter(d => d < threshold).length / last20.length) * 100;
  if (winOverPct >= 48 && winOverPct <= 52) {
    return {
      action: "WAIT",
      label: "⏳ BALANCED — NO EDGE",
      reason: `Over-${threshold}: ${overPct.toFixed(1)}% · Under-${threshold}: ${underPct.toFixed(1)}% — near 50/50, avoid (Ch 21)`,
      accentColor: "#6b7280",
    };
  }

  /* ── Warning: extreme recent streak in last 10 */
  const rec10Over  = last10.filter(d => d > threshold).length / last10.length * 100;
  const rec10Under = 100 - rec10Over;
  if (rec10Over >= 85 || rec10Under >= 85) {
    const side = rec10Over >= 85 ? "OVER" : "UNDER";
    const pct  = rec10Over >= 85 ? rec10Over : rec10Under;
    return {
      action: "WARN",
      label: `⚠️ EXTREME ${side} STREAK — DO NOT TRADE`,
      reason: `${Math.round(pct)}% of last 10 ticks hit ${side}-${threshold} — possible streak or manipulation`,
      accentColor: "#f97316",
    };
  }

  /* ── Warning: rapid alternation (FVG) */
  const last10Dirs = last10.map(d => d > threshold ? "O" : d < threshold ? "U" : "=");
  let alts = 0;
  for (let k = 1; k < last10Dirs.length; k++) {
    if (last10Dirs[k] !== "=" && last10Dirs[k - 1] !== "=" && last10Dirs[k] !== last10Dirs[k - 1]) alts++;
  }
  if (alts >= 8) {
    return {
      action: "WARN",
      label: "⚠️ FAIR VALUE GAP — DO NOT TRADE",
      reason: `Market alternating rapidly over/under ${threshold} — digit imbalance, avoid entry`,
      accentColor: "#eab308",
    };
  }

  /* ── Pattern 1: Triple same digit (7,7,7 → BUY UNDER 7; 2,2,2 → BUY OVER 2) */
  const t3 = last5.slice(-3);
  if (t3[0] === t3[1] && t3[1] === t3[2]) {
    const d = t3[2];
    if (d >= threshold) {
      return {
        action: "BUY_UNDER",
        label: `🎯 ENTER NOW — BUY UNDER ${threshold}`,
        reason: `Pattern: ${d},${d},${d} — digit touched ${threshold > 0 ? "at/above" : "at"} barrier 3× · reversal expected · Under ${underPct.toFixed(1)}%`,
        accentColor: "#3b82f6",
      };
    }
    if (d <= threshold) {
      return {
        action: "BUY_OVER",
        label: `🎯 ENTER NOW — BUY OVER ${threshold}`,
        reason: `Pattern: ${d},${d},${d} — digit touched ${threshold < 9 ? "at/below" : "at"} barrier 3× · reversal expected · Over ${overPct.toFixed(1)}%`,
        accentColor: "#ef4444",
      };
    }
  }

  /* ── Pattern 2: Conservative ascending cluster → BUY UNDER threshold
     Example: 7,8,9,9 means digits clustering high — reversal under threshold */
  const last4 = last5.slice(-4);
  const ascStep    = last4[1] >= last4[0] && last4[2] >= last4[1];
  const tailRepeat = last4[3] === last4[2];
  const tailHigh   = last4[2] >= threshold && last4[3] >= threshold;
  if (ascStep && tailRepeat && tailHigh && underPct > 40) {
    return {
      action: "BUY_UNDER",
      label: `🎯 ENTER NOW — BUY UNDER ${threshold}`,
      reason: `Pattern: ${last4.join(",")} — ascending cluster high, conservative touch · Under ${underPct.toFixed(1)}%`,
      accentColor: "#3b82f6",
    };
  }

  /* ── Pattern 3: Conservative descending cluster → BUY OVER threshold
     Example: 2,1,0,0 or 0,1,2,2 means digits clustering low — reversal over threshold */
  const descStep   = last4[1] <= last4[0] && last4[2] <= last4[1];
  const tailLow    = last4[2] <= threshold && last4[3] <= threshold;
  if (descStep && tailRepeat && tailLow && overPct > 40) {
    return {
      action: "BUY_OVER",
      label: `🎯 ENTER NOW — BUY OVER ${threshold}`,
      reason: `Pattern: ${last4.join(",")} — descending cluster low, conservative touch · Over ${overPct.toFixed(1)}%`,
      accentColor: "#ef4444",
    };
  }

  /* ── Imbalance zone signals (Ch 21) — 58–62% strong, 63%+ extreme */
  const zone = winUnderPct >= 63 ? "EXTREME" : winUnderPct >= 58 ? "STRONG" : winUnderPct >= 53 ? "MILD" : null;
  const ozne = winOverPct  >= 63 ? "EXTREME" : winOverPct  >= 58 ? "STRONG" : winOverPct  >= 53 ? "MILD" : null;

  if (underPct > 57) {
    return {
      action: "BUY_UNDER",
      label: `🎯 SIGNAL — BUY UNDER ${threshold}`,
      reason: `Under-${threshold}: ${underPct.toFixed(1)}% ${zone ? `(${zone} imbalance)` : ""} — statistical edge for under entry`,
      accentColor: "#3b82f6",
    };
  }
  if (overPct > 57) {
    return {
      action: "BUY_OVER",
      label: `🎯 SIGNAL — BUY OVER ${threshold}`,
      reason: `Over-${threshold}: ${overPct.toFixed(1)}% ${ozne ? `(${ozne} imbalance)` : ""} — statistical edge for over entry`,
      accentColor: "#ef4444",
    };
  }

  return {
    action: "WAIT",
    label: "⏳ Scanning for entry…",
    reason: `Over-${threshold}: ${overPct.toFixed(1)}% · Under-${threshold}: ${underPct.toFixed(1)}% — no clear edge yet`,
    accentColor: "#6b7280",
  };
}

/* ── Over/Under AI Signal Panel ─────────────────────────────────────────── */
function OUSignalPanel({ digits, threshold }: { digits: number[]; threshold: number }) {
  const sig     = computeOUSignal(digits, threshold);
  const prevRef = useRef<string>("WAIT");

  useEffect(() => {
    if (prevRef.current !== sig.action) {
      if (sig.action === "BUY_OVER" || sig.action === "BUY_UNDER") playBuySound();
      else if (sig.action === "WARN") playWarnSound();
      prevRef.current = sig.action;
    }
  }, [sig.action]);

  const isBuy  = sig.action === "BUY_OVER" || sig.action === "BUY_UNDER";
  const isWarn = sig.action === "WARN";

  return (
    <div
      className="rounded-xl border p-4 mt-4"
      style={{
        background: isBuy
          ? `linear-gradient(135deg, rgba(0,0,0,0.75) 0%, ${sig.accentColor}20 100%)`
          : isWarn
          ? "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(239,68,68,0.12) 100%)"
          : "rgba(0,0,0,0.3)",
        borderColor: isBuy || isWarn ? sig.accentColor : "#374151",
        boxShadow: isBuy ? `0 0 20px ${sig.accentColor}55` : isWarn ? "0 0 14px rgba(239,68,68,0.3)" : "none",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: sig.accentColor,
            animation: isBuy ? "pulse 1s ease-in-out infinite" : "none",
          }}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sig.accentColor }}>
          AI Over/Under Signal
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">Threshold: {threshold}</span>
      </div>
      <div
        className="text-lg font-black tracking-tight mb-1"
        style={{ color: isBuy || isWarn ? sig.accentColor : "#9ca3af" }}
      >
        {sig.label}
      </div>
      <div className="text-xs" style={{ color: "#9ca3af" }}>{sig.reason}</div>

      {/* Last 15 tick mini-strip */}
      {digits.length >= 5 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {digits.slice(-15).map((d, i) => {
            const isOver  = d > threshold;
            const isUnder = d < threshold;
            return (
              <div
                key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border"
                style={{
                  backgroundColor: isUnder ? "#1e3a8a" : isOver ? "#991b1b" : "#374151",
                  borderColor:     isUnder ? "#3b82f6" : isOver ? "#ef4444" : "#6b7280",
                  color: "#fff",
                  opacity: i < 10 ? 0.55 : 1,
                }}
              >
                {isUnder ? "U" : isOver ? "O" : "="}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AISignalPanel({ recent, evenPct, oddPct }: { recent: number[]; evenPct: number; oddPct: number }) {
  const sig     = computeSignal(recent, evenPct, oddPct);
  const prevRef = useRef<string>("WAIT");

  useEffect(() => {
    if (prevRef.current !== sig.action) {
      if (sig.action === "BUY_ODD" || sig.action === "BUY_EVEN") playBuySound();
      else if (sig.action === "WARN") playWarnSound();
      prevRef.current = sig.action;
    }
  }, [sig.action]);

  const isBuy  = sig.action === "BUY_ODD" || sig.action === "BUY_EVEN";
  const isWarn = sig.action === "WARN";

  return (
    <div
      className="rounded-xl border p-4 mt-4"
      style={{
        background: isBuy
          ? `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, ${sig.accentColor}22 100%)`
          : isWarn
          ? "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(239,68,68,0.12) 100%)"
          : "rgba(0,0,0,0.3)",
        borderColor: isBuy || isWarn ? sig.accentColor : "#374151",
        boxShadow: isBuy ? `0 0 20px ${sig.accentColor}55` : isWarn ? "0 0 14px rgba(239,68,68,0.3)" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: sig.accentColor,
            animation: isBuy ? "pulse 1s ease-in-out infinite" : "none",
          }}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sig.accentColor }}>
          AI Signal Engine
        </span>
      </div>

      {/* Main label */}
      <div
        className="text-xl font-black tracking-tight mb-1"
        style={{ color: isBuy || isWarn ? sig.accentColor : "#9ca3af" }}
      >
        {sig.label}
      </div>

      {/* Reason */}
      <div className="text-xs" style={{ color: "#9ca3af" }}>
        {sig.reason}
      </div>

      {/* Recent E/O strip */}
      {recent.length >= 5 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {recent.slice(-20).map((d, i) => {
            const isE = d % 2 === 0;
            return (
              <div
                key={i}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{
                  backgroundColor: isE ? "#15803d" : "#7f1d1d",
                  color: "#fff",
                  opacity: i < 15 ? 0.5 : 1,
                }}
              >
                {isE ? "E" : "O"}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Triangle track indicator ───────────────────────────────────────────── */
function TriangleIndicator({ digit }: { digit: number | null }) {
  const pct = digit !== null ? (digit / 9) * 100 : 0;
  return (
    <div className="relative w-full select-none">
      <div className="relative h-6 flex items-center mt-2">
        <div className="absolute inset-x-0 h-1 bg-muted rounded-full" />
        <div
          className="absolute inset-x-0 h-1 rounded-full opacity-40"
          style={{ background: "linear-gradient(to right,#4f46e5,#2563eb,#0891b2,#059669,#65a30d,#d97706,#ea580c,#dc2626,#db2777,#9333ea)" }}
        />
        {/* purple triangle cursor */}
        <div
          className="absolute top-0 transition-all duration-300 ease-out"
          style={{ left: `calc(${pct}% - 7px)`, marginLeft: digit === 0 ? "4px" : digit === 9 ? "-4px" : "0" }}
        >
          <div
            style={{
              width: 0, height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "12px solid #a855f7",
              filter: "drop-shadow(0 0 4px rgba(168,85,247,0.9))",
            }}
          />
        </div>
        <div className="absolute inset-x-0 flex">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div
                className="w-2 h-2 rounded-full border transition-all duration-300"
                style={{
                  backgroundColor: digit === i ? D_COLORS[i].bg : "transparent",
                  borderColor: D_COLORS[i].border,
                  opacity: digit === i ? 1 : 0.35,
                  boxShadow: digit === i ? `0 0 8px ${D_COLORS[i].border}` : "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex mt-1">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="flex-1 text-center font-mono font-bold"
            style={{ fontSize: 9, color: D_COLORS[i].border, opacity: digit === i ? 1 : 0.4 }}
          >
            {i}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function WideEye() {
  const [selectedMarket,     setSelectedMarket]     = useState("R_10");
  const [tickWindow,         setTickWindow]         = useState(1000);
  const [overUnderThreshold, setOverUnderThreshold] = useState(5);

  const { digits, lastDigit, currentPrice, isConnected, historyLoaded } =
    useDerivWebSocket(selectedMarket);

  const displayDigits = useMemo(
    () => digits.slice(-tickWindow).map((d) => d.digit),
    [digits, tickWindow]
  );

  const total      = displayDigits.length || 1;
  const evenCount  = displayDigits.filter((d) => d % 2 === 0).length;
  const oddCount   = total - evenCount;
  const overCount  = displayDigits.filter((d) => d > overUnderThreshold).length;
  const underCount = displayDigits.filter((d) => d < overUnderThreshold).length;
  const equalCount = displayDigits.filter((d) => d === overUnderThreshold).length;

  const priceStr   = currentPrice !== null
    ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })
    : "—";

  /* recent 100 bubbles */
  const recent100 = displayDigits.slice(-100);

  const lastDigitIsEven = lastDigit !== null && lastDigit % 2 === 0;
  const lastDigitClass  = lastDigit !== null
    ? (lastDigit < overUnderThreshold ? "UNDER" : lastDigit === overUnderThreshold ? "EQUAL" : "OVER")
    : "—";

  return (
    <div className="space-y-5">
      {/* ── Green accent stripe ── */}
      <div className="h-0.5 rounded-full -mb-3" style={{ background: `linear-gradient(to right, ${ACCENT}, transparent)` }} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: ACCENT }}>
            <Eye className="w-6 h-6" /> Wide Eye View
          </h1>
          <p className="text-muted-foreground text-sm">
            Real-time digit distribution · {displayDigits.length} ticks loaded
          </p>
        </div>
        <Badge
          variant="outline"
          className={`gap-1.5 font-mono text-xs ${isConnected ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          {isConnected ? "Live" : "Connecting..."}
        </Badge>
      </div>

      {/* ── Market selector — dark green theme ── */}
      <Card
        className="border"
        style={{
          background: "linear-gradient(135deg, rgba(5,46,22,0.95) 0%, rgba(3,30,15,0.98) 100%)",
          borderColor: "#166534",
          boxShadow: `0 0 24px rgba(22,163,74,0.15)`,
        }}
      >
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1.5 block" style={{ color: "#4ade80" }}>
              Select Market:
            </label>
            <MarketSelector value={selectedMarket} onChange={setSelectedMarket} testId="select-market-wide-eye" />
          </div>

          {/* Price + live digit row */}
          <div
            className="flex items-center justify-between rounded-lg px-5 py-3 border"
            style={{ background: "rgba(0,0,0,0.4)", borderColor: "#14532d" }}
          >
            <span className="font-mono font-bold tracking-tight text-white" style={{ fontSize: 28 }}>
              {priceStr}
            </span>
            {lastDigit !== null ? (
              <div
                className="rounded-full flex items-center justify-center font-black border-2"
                style={{
                  width: 56, height: 56, fontSize: 26,
                  backgroundColor: "#00d1d1", borderColor: "#00d1d1",
                  color: "#000", boxShadow: "0 0 24px rgba(0,209,209,0.6)",
                }}
              >
                {lastDigit}
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full border animate-pulse" style={{ borderColor: "#166534" }} />
            )}
          </div>

          {/* Tick window */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold whitespace-nowrap" style={{ color: "#86efac" }}>
                Ticks window:
              </label>
              <input
                type="number"
                min={50} max={5000}
                value={tickWindow}
                onChange={(e) => setTickWindow(Math.max(50, Math.min(5000, +e.target.value)))}
                className="w-24 rounded px-2 py-1 text-sm font-mono focus:outline-none"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid #166534", color: "#86efac" }}
              />
              <span className="text-xs" style={{ color: "#4ade8088" }}>(50–5000)</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[100, 500, 1000, 2000].map((n) => (
                <button
                  key={n}
                  onClick={() => setTickWindow(n)}
                  className="px-3 py-1 rounded text-xs font-bold border transition-all"
                  style={tickWindow === n
                    ? { backgroundColor: "#16a34a", borderColor: "#16a34a", color: "#fff" }
                    : { backgroundColor: "rgba(22,163,74,0.12)", borderColor: "#166534", color: "#4ade80" }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="ml-auto text-xs font-mono">
              {!historyLoaded
                ? <span className="text-yellow-400 animate-pulse">loading history…</span>
                : <span style={{ color: "#4ade80" }}>{displayDigits.length}/{tickWindow}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Digit Circles ── */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-5 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
            Last {displayDigits.length} ticks — digit distribution
          </CardTitle>
          <span className="text-[10px] text-muted-foreground font-mono">
            ▼ purple = current digit
          </span>
        </CardHeader>
        <CardContent className="px-5 pt-5 pb-4">
          {displayDigits.length < 10 ? (
            <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
              <Activity className="w-8 h-8 opacity-20" style={{ animation: "spin 3s linear infinite" }} />
              <p className="text-sm">Loading ticks…</p>
            </div>
          ) : (
            <DigitCircles digits={displayDigits} lastDigit={lastDigit} />
          )}
        </CardContent>
      </Card>

      {/* ── Triangle Indicator ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-1 px-5 pt-4">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
            Live Digit Position — purple triangle cursor
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-5">
          <TriangleIndicator digit={lastDigit} />
        </CardContent>
      </Card>

      {/* ── Even / Odd — with live digit in centre ── */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-5 border-b border-border">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
            Even / Odd · {displayDigits.length} ticks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {/* Three-col: Even | LIVE digit | Odd */}
          <div className="grid grid-cols-3 gap-4 items-center mb-5">
            {/* Even */}
            <div>
              <div className="text-green-400 font-bold text-base mb-1">Even</div>
              <div className="font-mono text-3xl font-black">{evenCount}</div>
              <div className="text-muted-foreground text-sm">{((evenCount / total) * 100).toFixed(1)}%</div>
              <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(evenCount / total) * 100}%`, backgroundColor: "#22c55e" }}
                />
              </div>
            </div>

            {/* Middle live digit */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Live digit</span>
              {lastDigit !== null ? (
                <div
                  className="rounded-full flex items-center justify-center font-black border-2"
                  style={{
                    width: 60, height: 60, fontSize: 28,
                    backgroundColor: lastDigitIsEven ? "#15803d" : "#991b1b",
                    borderColor:     lastDigitIsEven ? "#22c55e" : "#ef4444",
                    color: "#fff",
                    boxShadow: lastDigitIsEven
                      ? "0 0 18px rgba(34,197,94,0.5)"
                      : "0 0 18px rgba(239,68,68,0.5)",
                  }}
                >
                  {lastDigit}
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full border border-border/40 bg-muted/30 animate-pulse" />
              )}
              <span
                className="text-xs font-black"
                style={{ color: lastDigitIsEven ? "#4ade80" : "#f87171" }}
              >
                {lastDigit !== null ? (lastDigitIsEven ? "EVEN" : "ODD") : "—"}
              </span>
            </div>

            {/* Odd */}
            <div className="text-right">
              <div className="text-red-400 font-bold text-base mb-1">Odd</div>
              <div className="font-mono text-3xl font-black">{oddCount}</div>
              <div className="text-muted-foreground text-sm">{((oddCount / total) * 100).toFixed(1)}%</div>
              <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all ml-auto"
                  style={{ width: `${(oddCount / total) * 100}%`, backgroundColor: "#ef4444" }}
                />
              </div>
            </div>
          </div>

          {/* Recent 20 bubbles — E / O labels */}
          <div>
            <div className="text-xs font-bold text-muted-foreground mb-2">
              Recent {Math.min(recent100.length, 20)} ticks
            </div>
            <div className="flex flex-wrap gap-1">
              {recent100.slice(-20).map((d, i) => {
                const isEven = d % 2 === 0;
                return (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border"
                    style={{
                      backgroundColor: isEven ? "#15803d" : "#991b1b",
                      borderColor:     isEven ? "#22c55e" : "#ef4444",
                      color: "#fff",
                    }}
                    title={`Digit ${d}`}
                  >
                    {isEven ? "E" : "O"}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── AI Signal Panel ── */}
          <AISignalPanel
            recent={displayDigits}
            evenPct={(evenCount / total) * 100}
            oddPct={(oddCount / total) * 100}
          />
        </CardContent>
      </Card>

      {/* ── Over / Under — with live digit in centre ── */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-5 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
            Over / Under · {displayDigits.length} ticks
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Threshold:</span>
            <select
              value={overUnderThreshold}
              onChange={(e) => setOverUnderThreshold(+e.target.value)}
              className="bg-background border border-border text-foreground rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {/* Three-col: Under | LIVE digit | Over */}
          <div className="grid grid-cols-3 gap-4 items-center mb-4">
            {/* Under */}
            <div>
              <div className="text-blue-400 font-bold text-base mb-1">Under {overUnderThreshold}</div>
              <div className="font-mono text-3xl font-black">{underCount}</div>
              <div className="text-muted-foreground text-sm">{((underCount / total) * 100).toFixed(1)}%</div>
              <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(underCount / total) * 100}%`, backgroundColor: "#3b82f6" }}
                />
              </div>
            </div>

            {/* Middle live digit */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Live digit</span>
              {lastDigit !== null ? (
                <div
                  className="rounded-full flex items-center justify-center font-black border-2"
                  style={{
                    width: 60, height: 60, fontSize: 28,
                    backgroundColor:
                      lastDigitClass === "UNDER" ? "#1e3a8a"
                      : lastDigitClass === "OVER"  ? "#991b1b"
                      : "#374151",
                    borderColor:
                      lastDigitClass === "UNDER" ? "#3b82f6"
                      : lastDigitClass === "OVER"  ? "#ef4444"
                      : "#6b7280",
                    color: "#fff",
                    boxShadow:
                      lastDigitClass === "UNDER" ? "0 0 18px rgba(59,130,246,0.5)"
                      : lastDigitClass === "OVER"  ? "0 0 18px rgba(239,68,68,0.5)"
                      : "none",
                  }}
                >
                  {lastDigit}
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full border border-border/40 bg-muted/30 animate-pulse" />
              )}
              <span
                className="text-xs font-black"
                style={{
                  color: lastDigitClass === "UNDER" ? "#60a5fa"
                    : lastDigitClass === "OVER"  ? "#f87171"
                    : "#9ca3af",
                }}
              >
                {lastDigitClass}
              </span>
            </div>

            {/* Over */}
            <div className="text-right">
              <div className="text-red-400 font-bold text-base mb-1">Over {overUnderThreshold}</div>
              <div className="font-mono text-3xl font-black">{overCount}</div>
              <div className="text-muted-foreground text-sm">{((overCount / total) * 100).toFixed(1)}%</div>
              <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all ml-auto"
                  style={{ width: `${(overCount / total) * 100}%`, backgroundColor: "#ef4444" }}
                />
              </div>
            </div>
          </div>

          {/* Equal row */}
          <div className="flex items-center gap-3 py-2 px-3 rounded-lg mb-4"
            style={{ background: "rgba(107,114,128,0.1)", border: "1px solid rgba(107,114,128,0.2)" }}>
            <span className="text-xs text-muted-foreground">Equal to {overUnderThreshold}:</span>
            <span className="font-mono font-bold">{equalCount}</span>
            <span className="text-muted-foreground text-xs">({((equalCount / total) * 100).toFixed(1)}%)</span>
          </div>

          {/* Recent 20 ticks — U / = / O labels */}
          <div>
            <div className="text-xs font-bold text-muted-foreground mb-2">
              Recent 20 ticks
            </div>
            <div className="flex flex-wrap gap-1">
              {displayDigits.slice(-20).map((d, i) => {
                const isUnder = d < overUnderThreshold;
                const isOver  = d > overUnderThreshold;
                return (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border"
                    style={{
                      backgroundColor: isUnder ? "#1e3a8a" : isOver ? "#991b1b" : "#374151",
                      borderColor:     isUnder ? "#3b82f6" : isOver ? "#ef4444" : "#6b7280",
                      color: "#fff",
                    }}
                    title={`Digit ${d}`}
                  >
                    {isUnder ? "U" : isOver ? "O" : "="}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Over/Under AI Signal Panel ── */}
          <OUSignalPanel digits={displayDigits} threshold={overUnderThreshold} />
        </CardContent>
      </Card>

      {/* ── Rolling tick stream ── */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-5 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Rolling Tick Stream</CardTitle>
          <span className="text-[10px] font-mono text-muted-foreground">
            last {Math.min(displayDigits.length, 200)} of {displayDigits.length}
          </span>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-1">
            {displayDigits.slice(-200).map((d, i, arr) => {
              const isLatest = i === arr.length - 1;
              return (
                <div key={i} className="relative">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${isLatest ? "ring-2 ring-purple-500 ring-offset-1 ring-offset-background" : ""}`}
                    style={{ backgroundColor: D_COLORS[d].bg, borderColor: D_COLORS[d].border, color: D_COLORS[d].text }}
                  >
                    {d}
                  </div>
                  {isLatest && (
                    <div
                      className="absolute -top-2 left-1/2 -translate-x-1/2"
                      style={{
                        width: 0, height: 0,
                        borderLeft: "5px solid transparent",
                        borderRight: "5px solid transparent",
                        borderTop: "8px solid #a855f7",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">▼ = latest tick (purple) · digit 0(indigo)→9(purple)</p>
        </CardContent>
      </Card>
    </div>
  );
}
