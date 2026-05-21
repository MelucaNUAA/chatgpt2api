"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getValidatedAuthSession } from "@/lib/auth-session";
import { getStoredAuthSession, getDefaultRouteForRole, type StoredAuthSession } from "@/store/auth";

type AuthContextValue = {
  session: StoredAuthSession | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ session: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // 先从缓存读取，立即显示
    getStoredAuthSession().then((cached) => {
      if (active && cached) {
        setSession(cached);
        setIsLoading(false);
      }
    });

    // 后台验证 token 有效性
    getValidatedAuthSession().then((validated) => {
      if (active) {
        setSession(validated);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthGuard(allowedRoles?: string[]) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  const isCheckingAuth = isLoading;
  const allowedRoleList = allowedRoles || [];

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    if (allowedRoleList.length > 0 && !allowedRoleList.includes(session.role)) {
      router.replace(getDefaultRouteForRole(session.role));
    }
  }, [session, isLoading, router, allowedRoleList.join(",")]);

  return { isCheckingAuth, session };
}
