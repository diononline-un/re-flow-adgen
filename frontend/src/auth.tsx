import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, ApiError } from "./api";

export interface User {
  id: string;
  username: string;
  preferred_ui_lang?: string;
  last_listing_lang?: string;
  support_tier?: boolean;
  blocked?: boolean;
  gens_free_used?: number;
  api_key_encrypted?: string;
  api_key_provider?: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string, fingerprintHash: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error("not ready");
  },
  register: async () => {
    throw new Error("not ready");
  },
  logout: () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const res = await api<{ user: User }>("/me");
        if (alive) setUserState(res.user);
      } catch {
        setToken(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  };

  const register = async (username: string, password: string, fingerprintHash: string): Promise<User> => {
    const res = await api<{ token: string; user: User; blocked: boolean }>("/auth/register", {
      method: "POST",
      body: { username, password, fingerprintHash },
    });
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUserState(null);
  };

  return (
    <Ctx.Provider
      value={{ user, loading, login, register, logout, setUser: setUserState }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
