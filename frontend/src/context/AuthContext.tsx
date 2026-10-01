import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { getAccessToken, setAccessToken } from "@/lib/auth-session";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: "customer" | "admin" | "store_manager" | "product_manager";
  firstName: string;
  lastName: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean; // true only during the initial hydration check
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (accessToken: string, refreshToken: string, newPassword: string) => Promise<void>;
}

// ─── Storage keys ──────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const LEGACY_TOKEN_KEYS = ["ch-access-token", "ch-refresh-token", "ch-user"];

// Supabase access tokens expire in 1 hour.
// We refresh 5 minutes before expiry to keep the session alive silently.
const TOKEN_TTL_MS = 55 * 60 * 1000; // refresh every 55 min

// ─── Context ───────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Request helper ────────────────────────────────────────────────────────

async function authFetch<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : Object.values(data.error as Record<string, string[]>)
            .flat()
            .join(", ");
    throw new Error(message);
  }
  return data as T;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });

  // Ref so the refresh timer can read the latest token without stale closure
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearState = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setAccessToken(null);
    for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
    setState({ user: null, accessToken: null, isLoading: false });
  }, []);

  // Schedules a silent token refresh TOKEN_TTL_MS from now
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await authFetch<{ accessToken: string }>("/auth/refresh", {});
        setAccessToken(data.accessToken);
        setState((s) => ({ ...s, accessToken: data.accessToken }));
        scheduleRefresh();
      } catch {
        // Refresh token expired — force logout
        clearState();
      }
    }, TOKEN_TTL_MS);
  }, [clearState]);

  const persist = useCallback(
    (user: AuthUser, accessToken: string) => {
      setAccessToken(accessToken);
      setState({ user, accessToken, isLoading: false });
      scheduleRefresh();
    },
    [scheduleRefresh],
  );

  // Restore the session from the HttpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;
    for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);

    void (async () => {
      try {
        const refreshed = await authFetch<{ accessToken: string }>("/auth/refresh", {});
        const me = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${refreshed.accessToken}` },
          credentials: "include",
        });
        if (!me.ok) throw new Error("Session user unavailable");
        const { user } = (await me.json()) as { user: AuthUser };
        if (!cancelled) persist(user, refreshed.accessToken);
      } catch {
        if (!cancelled) clearState();
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [clearState, persist]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authFetch<{ user: AuthUser; accessToken: string }>("/auth/login", {
        email,
        password,
      });
      persist(data.user, data.accessToken);
    },
    [persist],
  );

  const register = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      const data = await authFetch<{ user: AuthUser; accessToken: string }>("/auth/register", {
        email,
        password,
        firstName,
        lastName,
      });
      persist(data.user, data.accessToken);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    const token = getAccessToken();
    if (token) {
      await authFetch("/auth/logout", {}, token).catch(() => {});
    }
    clearState();
  }, [clearState]);

  const forgotPassword = useCallback(async (email: string) => {
    await authFetch("/auth/forgot-password", { email });
  }, []);

  const resetPassword = useCallback(
    async (accessToken: string, refreshToken: string, newPassword: string) => {
      await authFetch("/auth/reset-password", { accessToken, refreshToken, newPassword });
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, forgotPassword, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
