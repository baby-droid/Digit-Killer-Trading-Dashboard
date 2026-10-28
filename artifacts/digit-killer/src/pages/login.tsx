import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Shield, User, Eye, EyeOff, Zap, AlertCircle, Loader2 } from "lucide-react";

export default function Login() {
  const { loginAdmin, loginUser } = useAuth();
  const [tab, setTab]         = useState<"admin" | "user">("admin");
  const [pin, setPin]         = useState("");
  const [userId, setUserId]   = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError]     = useState("");
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const shake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginAdmin(pin)) {
      setError("Invalid admin PIN. Access denied.");
      shake();
      setPin("");
    }
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const ok = await loginUser(userId);
      if (!ok) {
        setError("Invalid or revoked User ID.");
        shake();
        setUserId("");
      }
    } catch {
      setError("Could not reach server. Check your connection.");
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 30%, #001a1a 0%, #0a0d14 60%, #000000 100%)",
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,209,209,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,209,209,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow orb */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 500, height: 500,
          top: "50%", left: "50%",
          transform: "translate(-50%, -60%)",
          background: "radial-gradient(circle, rgba(0,209,209,0.05) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative z-10 w-full max-w-sm px-4"
        style={{ animation: shaking ? "shake 0.4s ease-in-out" : undefined }}
      >
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`.replace("//", "/")}
            alt="Logo"
            className="w-24 h-24 rounded-full"
            style={{ filter: "drop-shadow(0 0 20px rgba(0,209,209,0.6))" }}
          />
          <div className="text-center">
            <div
              className="text-3xl font-black tracking-[0.25em] text-primary"
              style={{ textShadow: "0 0 20px rgba(0,209,209,0.6)", fontFamily: "monospace" }}
            >
              DIGIT KILLER
            </div>
            <div className="text-xs tracking-[0.4em] text-primary/50 mt-1">
              AHMED SYNTRADER · AI SYSTEM
            </div>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-card border border-border rounded-lg p-1 mb-4">
          {(["admin", "user"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${
                tab === t
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "admin" ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              {t === "admin" ? "ADMIN" : "USER LOGIN"}
            </button>
          ))}
        </div>

        <Card className="bg-card/80 border-primary/20 backdrop-blur">
          <CardContent className="pt-6">
            {tab === "admin" ? (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">
                    Admin PIN
                  </label>
                  <div className="relative">
                    <Input
                      type={showPin ? "text" : "password"}
                      placeholder="Enter PIN..."
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="pr-10 font-mono tracking-widest bg-background border-border"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full py-3 bg-primary text-primary-foreground font-black tracking-widest rounded-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  style={{ boxShadow: "0 0 20px rgba(0,209,209,0.3)" }}
                >
                  <Shield className="w-4 h-4" /> AUTHENTICATE
                </button>
              </form>
            ) : (
              <form onSubmit={handleUserLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">
                    User ID
                  </label>
                  <Input
                    placeholder="e.g. DK-XK8J2F"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value.toUpperCase())}
                    className="font-mono tracking-widest bg-background border-border uppercase"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || !userId.trim()}
                  className="w-full py-3 bg-primary text-primary-foreground font-black tracking-widest rounded-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ boxShadow: "0 0 20px rgba(0,209,209,0.3)" }}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> VERIFYING…</>
                    : <><Zap className="w-4 h-4" /> ACCESS PLATFORM</>}
                </button>
                <p className="text-xs text-center text-muted-foreground">
                  Get your User ID from the admin.
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground mt-6 tracking-widest">
          AHMED AI v2.1.0 · SECURE ACCESS ONLY
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%  { transform: translateX(-8px); }
          40%  { transform: translateX(8px); }
          60%  { transform: translateX(-6px); }
          80%  { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
