import { ArrowUpRight, Binary, ShieldCheck } from "lucide-react";
import { DerivAccountCard } from "@/components/deriv-account-card";

export default function Login() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b12] px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,209,209,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(0,209,209,0.13) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black 10%, transparent 78%)",
        }}
      />
      <div className="relative z-10 w-full max-w-xl space-y-6">
        <header className="flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_35px_rgba(0,209,209,0.15)]">
            <Binary className="h-7 w-7" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-primary/75">
            Ahmed Syntrader
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[0.12em] text-foreground sm:text-4xl">
            Digit Killer
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Connect a Deriv Personal Access Token to load your accounts and open the live analysis workspace.
          </p>
        </header>

        <DerivAccountCard />

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            Your token stays in browser memory and is cleared when you disconnect.
          </div>
          <a
            href="https://app.deriv.com/account/api-token"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Manage Deriv API tokens <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <p className="max-w-md text-[10px] leading-relaxed text-muted-foreground/80">
            Start with a demo account. Digital contracts can lose the full stake; historical pattern scores do not predict future ticks.
          </p>
        </div>
      </div>
    </main>
  );
}
