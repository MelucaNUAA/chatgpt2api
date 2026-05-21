"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-provider";
import { getDefaultRouteForRole, type AuthRole, type StoredAuthSession } from "@/store/auth";

type UseAuthGuardResult = {
  isCheckingAuth: boolean;
  session: StoredAuthSession | null;
};

export function useAuthGuard(allowedRoles?: AuthRole[]): UseAuthGuardResult {
  const { session, isLoading } = useAuth();
  const router = useRouter();

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

  return { isCheckingAuth: isLoading, session };
}

export function useRedirectIfAuthenticated() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (session) {
      router.replace(getDefaultRouteForRole(session.role));
    }
  }, [session, isLoading, router]);

  return { isCheckingAuth: isLoading };
}
