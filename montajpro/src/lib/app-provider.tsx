"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";
import { Store, store } from "./db/store";
import { syncNow } from "./db/sync";
import {
  DEFAULT_CURRENCY,
  DEFAULT_MATERIAL_CATEGORIES,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_RATES,
} from "./constants";
import { EXPENSE_CATEGORIES } from "./types";
import type { Settings } from "./types";
import { uid } from "./utils";

const LOCAL_USER_KEY = "montajpro.local-user";
const LOCAL_MODE_KEY = "montajpro.local-mode";
const SYNC_INTERVAL_MS = 60_000;

export type AppMode = "cloud" | "local" | "unknown";

interface AuthState {
  mode: AppMode;
  userId: string;
  email: string | null;
}

interface AppContextValue extends AuthState {
  ready: boolean;
  settings: Settings | null;
  currency: string;
  syncStatus: string;
  pendingChanges: number;
  lastSyncAt: string | null;
  syncError: string | null;
  online: boolean;
  sync: () => Promise<void>;
  signOut: () => Promise<void>;
  startLocalMode: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* Ajutoare în afara React                                             */
/* ------------------------------------------------------------------ */

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Stocarea poate fi blocată (Safari privat) — continuăm în memorie.
  }
}

/** Identitatea folosită în modul local, stabilă între sesiuni. */
function ensureLocalUser(): string {
  const existing = readStorage(LOCAL_USER_KEY);
  if (existing) return existing;
  const created = uid();
  writeStorage(LOCAL_USER_KEY, created);
  return created;
}

function fromSession(session: Session | null): AuthState | null {
  if (!session?.user) return null;
  return {
    mode: "cloud",
    userId: session.user.id,
    email: session.user.email ?? null,
  };
}

/**
 * Cu ce cont pornim: sesiunea Supabase, modul local ales anterior, sau nimic
 * (caz în care ecranul de autentificare preia controlul).
 */
async function resolveInitialAuth(): Promise<AuthState> {
  const supabase = getSupabase();
  if (!supabase) {
    return { mode: "local", userId: ensureLocalUser(), email: null };
  }
  const { data } = await supabase.auth.getSession();
  const fromCloud = fromSession(data.session);
  if (fromCloud) return fromCloud;
  if (readStorage(LOCAL_MODE_KEY) === "1") {
    return { mode: "local", userId: ensureLocalUser(), email: null };
  }
  return { mode: "cloud", userId: "", email: null };
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function defaultSettings(userId: string): Settings {
  const timestamp = new Date().toISOString();
  return {
    id: uid(),
    user_id: userId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    full_name: null,
    phone: null,
    email: null,
    company: null,
    logo_path: null,
    logo_local_key: null,
    currency: DEFAULT_CURRENCY,
    units: "metric",
    default_rates: { ...DEFAULT_RATES },
    expense_categories: [...EXPENSE_CATEGORIES],
    material_categories: [...DEFAULT_MATERIAL_CATEGORIES],
    notification_prefs: { ...DEFAULT_NOTIFICATION_PREFS },
    vat_percent: 0,
    quote_terms: null,
  };
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const state = useSyncExternalStore(
    store.subscribe,
    () => store.getState(),
    () => store.getState(),
  );
  // Starea sincronizării nu trăiește în React; ne abonăm la ea ca să
  // re-randăm indicatorul din antet.
  const syncState = useSyncExternalStore(
    store.subscribe,
    store.getSyncState,
    () => Store.initialSyncState,
  );

  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true,
  );

  const [auth, setAuth] = useState<AuthState>({
    mode: isSupabaseConfigured ? "unknown" : "local",
    userId: "",
    email: null,
  });
  const [booted, setBooted] = useState(false);
  const bootedFor = useRef("");

  /* ----------------------- sesiune ---------------------------------- */

  useEffect(() => {
    let cancelled = false;

    void resolveInitialAuth().then((next) => {
      if (!cancelled) setAuth(next);
    });

    const supabase = getSupabase();
    if (!supabase)
      return () => {
        cancelled = true;
      };

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        const next = fromSession(session);
        if (next) {
          writeStorage(LOCAL_MODE_KEY, null);
          setAuth(next);
        } else {
          setAuth({ mode: "cloud", userId: "", email: null });
        }
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const startLocalMode = useCallback(() => {
    writeStorage(LOCAL_MODE_KEY, "1");
    setAuth({ mode: "local", userId: ensureLocalUser(), email: null });
  }, []);

  /* ----------------------- pornirea store-ului ---------------------- */

  useEffect(() => {
    const { userId, mode } = auth;
    if (!userId || bootedFor.current === userId) return;
    bootedFor.current = userId;

    let cancelled = false;
    void store.boot(userId).then(() => {
      if (cancelled) return;
      setBooted(true);
      if (mode === "cloud") void syncNow();
      else store.setSyncStatus("local");
    });

    return () => {
      cancelled = true;
    };
  }, [auth]);

  /* ----------------------- rândul de setări ------------------------- */

  const settings = useMemo(
    () => state.settings.find((row) => !row.deleted_at) ?? null,
    [state.settings],
  );

  useEffect(() => {
    if (!booted || !auth.userId || settings) return;
    void store.insert("settings", defaultSettings(auth.userId));
  }, [booted, auth.userId, settings]);

  /* ----------------------- sincronizare periodică ------------------- */

  useEffect(() => {
    if (auth.mode !== "cloud" || !auth.userId) return;

    if (!online) {
      store.setSyncStatus("offline");
      return;
    }

    void syncNow();

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void syncNow(), SYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [auth.mode, auth.userId, online]);

  /* ----------------------- ieșire din cont -------------------------- */

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    writeStorage(LOCAL_MODE_KEY, null);
    if (supabase) await supabase.auth.signOut();
    await store.wipeLocal();
    bootedFor.current = "";
    setBooted(false);
    setAuth({
      mode: isSupabaseConfigured ? "cloud" : "local",
      userId: "",
      email: null,
    });
    router.replace("/login");
  }, [router]);

  const value = useMemo<AppContextValue>(
    () => ({
      ...auth,
      ready: booted && syncState.ready,
      settings,
      currency: settings?.currency || DEFAULT_CURRENCY,
      syncStatus: syncState.status,
      pendingChanges: syncState.pending,
      lastSyncAt: syncState.lastSyncAt,
      syncError: syncState.error,
      online,
      sync: syncNow,
      signOut,
      startLocalMode,
    }),
    [auth, booted, settings, online, signOut, startLocalMode, syncState],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context)
    throw new Error("useApp trebuie folosit în interiorul <AppProvider>");
  return context;
}

export function useCurrency(): string {
  return useApp().currency;
}
