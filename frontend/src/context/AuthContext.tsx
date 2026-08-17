import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

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
const TOKEN_KEY = "ch-access-token";
const REFRESH_KEY = "ch-refresh-token";
const USER_KEY = "ch-user";

// Supabase access tokens expire in 1 hour.
// We refresh 5 minutes before expiry to keep the session alive silently.
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 min
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ user: null, accessToken: null, isLoading: false });
  }, []);

  // Schedules a silent token refresh TOKEN_TTL_MS from now
  const scheduleRefresh = useCallback(
    (refreshToken: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const data = await authFetch<{ accessToken: string; refreshToken: string }>(
            "/auth/refresh",
            { refreshToken },
          );
          localStorage.setItem(TOKEN_KEY, data.accessToken);
          localStorage.setItem(REFRESH_KEY, data.refreshToken);
          setState((s) => ({ ...s, accessToken: data.accessToken }));
          scheduleRefresh(data.refreshToken); // chain the next refresh
        } catch {
          // Refresh token expired — force logout
          clearState();
        }
      }, TOKEN_TTL_MS);
    },
    [clearState],
  );

  const persist = useCallback(
    (user: AuthUser, accessToken: string, refreshToken: string) => {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setState({ user, accessToken, isLoading: false });
      scheduleRefresh(refreshToken);
    },
    [scheduleRefresh],
  );

  // Hydrate from localStorage on mount + kick off refresh timer
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedRefresh && storedUser) {
        const user = JSON.parse(storedUser) as AuthUser;
        setState({ user, accessToken: storedToken, isLoading: false });
        // Schedule refresh immediately — we don't know how old the stored token is
        scheduleRefresh(storedRefresh);
        return;
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    }
    setState((s) => ({ ...s, isLoading: false }));

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authFetch<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        "/auth/login",
        { email, password },
      );
      persist(data.user, data.accessToken, data.refreshToken);
    },
    [persist],
  );

  const register = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      const data = await authFetch<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        "/auth/register",
        { email, password, firstName, lastName },
      );
      persist(data.user, data.accessToken, data.refreshToken);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
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
