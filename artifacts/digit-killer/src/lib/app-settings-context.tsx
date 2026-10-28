import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type AppSettings = {
  primaryHue: number;
  fontFamily: "inter" | "roboto" | "ubuntu" | "poppins" | "jetbrains";
  cardRadius: "sharp" | "normal" | "rounded" | "pill";
  density: "compact" | "normal" | "spacious";
  sidebarGlow: boolean;
  accentPreset: "cyan" | "green" | "purple" | "orange" | "rose" | "custom";
};

export const FONT_IMPORTS: Record<AppSettings["fontFamily"], string> = {
  inter:      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  roboto:     "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
  ubuntu:     "https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap",
  poppins:    "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  jetbrains:  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
};

export const FONT_STACKS: Record<AppSettings["fontFamily"], string> = {
  inter:     "'Inter', sans-serif",
  roboto:    "'Roboto', sans-serif",
  ubuntu:    "'Ubuntu', sans-serif",
  poppins:   "'Poppins', sans-serif",
  jetbrains: "'JetBrains Mono', monospace",
};

export const ACCENT_PRESETS: Record<AppSettings["accentPreset"], { hue: number; label: string; color: string }> = {
  cyan:   { hue: 181, label: "Cyan (Default)", color: "#00d1d1" },
  green:  { hue: 142, label: "Green",          color: "#22c55e" },
  purple: { hue: 260, label: "Purple",         color: "#a855f7" },
  orange: { hue: 25,  label: "Orange",         color: "#f97316" },
  rose:   { hue: 350, label: "Rose",           color: "#f43f5e" },
  custom: { hue: 200, label: "Custom",         color: "#3b82f6" },
};

export const RADIUS_VALUES: Record<AppSettings["cardRadius"], string> = {
  sharp:   "0rem",
  normal:  "0.5rem",
  rounded: "1rem",
  pill:    "1.5rem",
};

const DEFAULTS: AppSettings = {
  primaryHue: 181,
  fontFamily: "inter",
  cardRadius: "normal",
  density: "normal",
  sidebarGlow: true,
  accentPreset: "cyan",
};

type AppSettingsContextType = {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (patch: Partial<AppSettings>, adminPin: string) => Promise<void>;
  resetSettings: (adminPin: string) => Promise<void>;
};

const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: DEFAULTS,
  loading: true,
  updateSettings: async () => {},
  resetSettings: async () => {},
});

function applySettings(s: AppSettings) {
  const root = document.documentElement;
  root.style.setProperty("--primary", `${s.primaryHue} 100% 41%`);
  root.style.setProperty("--ring",    `${s.primaryHue} 100% 41%`);
  root.style.setProperty("--sidebar-primary", `${s.primaryHue} 100% 41%`);
  root.style.setProperty("--sidebar-ring",    `${s.primaryHue} 100% 41%`);
  root.style.setProperty("--chart-1", `${s.primaryHue} 100% 41%`);
  root.style.setProperty("--radius",  RADIUS_VALUES[s.cardRadius]);
  root.style.setProperty("--font-sans", FONT_STACKS[s.fontFamily]);

  const densityPad = s.density === "compact" ? "0.75rem" : s.density === "spacious" ? "1.75rem" : "1rem";
  root.style.setProperty("--page-padding", densityPad);

  const linkId = "dk-font-import";
  let link = document.getElementById(linkId) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = FONT_IMPORTS[s.fontFamily];
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json() as AppSettings;
        setSettings(data);
        applySettings(data);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchSettings(); }, [fetchSettings]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>, adminPin: string) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    const updated = await res.json() as AppSettings;
    setSettings(updated);
    applySettings(updated);
  }, []);

  const resetSettings = useCallback(async (adminPin: string) => {
    const res = await fetch("/api/settings/reset", {
      method: "POST",
      headers: { "x-admin-pin": adminPin },
    });
    if (!res.ok) throw new Error("Failed to reset");
    const updated = await res.json() as AppSettings;
    setSettings(updated);
    applySettings(updated);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, loading, updateSettings, resetSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() { return useContext(AppSettingsContext); }
