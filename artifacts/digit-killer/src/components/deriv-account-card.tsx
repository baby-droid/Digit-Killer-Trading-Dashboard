import { useState } from "react";
import { ShieldCheck, Unplug, WalletCards, KeyRound, AlertTriangle } from "lucide-react";
import { useDerivSession } from "@/lib/deriv-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_APP_ID = "34NPKU9CpQPBiUeK2O3S5";

export function DerivAccountCard() {
  const session = useDerivSession();
  const [token, setToken] = useState("");
  const [appId, setAppId] = useState(session.appId || DEFAULT_APP_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await session.connectWithPat({ token: token.trim(), appId: appId.trim() || DEFAULT_APP_ID });
      setToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect this Deriv account.");
    } finally {
      setBusy(false);
    }
  };

  const connected = Boolean(session.activeAccount);
  return (
    <section className="rounded-xl border border-border bg-card/90 overflow-hidden" data-testid="deriv-account-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><WalletCards className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold">Deriv trading account</h2>
            <p className="text-xs text-muted-foreground">PAT access stays in memory for this session only.</p>
          </div>
        </div>
        <span data-testid="status-deriv-connection" className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-border bg-muted text-muted-foreground"}`}>
          <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-muted-foreground"}`} />
          {String(session.status)}
        </span>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          {connected ? (
            <>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Active account</div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <strong className="font-mono text-lg">{session.activeAccount?.account_id}</strong>
                  <span className={`text-[10px] font-bold uppercase ${session.activeAccount?.account_type === "real" ? "text-amber-300" : "text-emerald-300"}`}>{session.activeAccount?.account_type}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{session.activeAccount?.currency} {Number(session.activeAccount?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {session.activeAccount?.status}</p>
              </div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground" htmlFor="deriv-account-select">Switch account</label>
              <select id="deriv-account-select" value={session.activeAccount?.account_id ?? ""} onChange={(event) => void session.switchAccount(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-deriv-account">
                {session.accounts.map((account) => <option key={account.account_id} value={account.account_id}>{account.account_id} · {account.account_type.toUpperCase()} · {account.currency} {Number(account.balance).toFixed(2)}</option>)}
              </select>
              <Button variant="outline" onClick={() => void session.disconnect()} className="w-full gap-2" data-testid="button-deriv-disconnect"><Unplug className="h-4 w-4" /> Disconnect Deriv</Button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              <KeyRound className="mb-2 h-4 w-4 text-primary" />
              Connect a Deriv Personal Access Token with trading permissions. Demo accounts are the default starting point.
            </div>
          )}
        </div>
        {!connected && (
          <form onSubmit={connect} className="space-y-3" data-testid="form-deriv-connect">
            <div>
              <label htmlFor="deriv-pat" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Personal Access Token</label>
              <Input id="deriv-pat" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste PAT — never saved" data-testid="input-deriv-pat" />
            </div>
            <div>
              <label htmlFor="deriv-app-id" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deriv App ID</label>
              <Input id="deriv-app-id" value={appId} onChange={(event) => setAppId(event.target.value)} data-testid="input-deriv-app-id" />
            </div>
            <Button disabled={!token.trim() || busy} className="w-full" data-testid="button-deriv-connect">{busy ? "Connecting…" : "Connect Deriv account"}</Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">Token is held only in memory and cleared when disconnected or the page session ends.</p>
          </form>
        )}
      </div>
      {(error || session.error) && <div role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="error-deriv-connection"><AlertTriangle className="h-4 w-4 shrink-0" />{error || session.error}</div>}
    </section>
  );
}
