"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  canEdit: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`));
  }, [router]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }, [router]);

  if (!user) return <>{fallback}</>;

  return (
    <AuthContext.Provider
      value={{ user, canEdit: user.role === "admin" || user.role === "hr", isAdmin: user.role === "admin", logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
