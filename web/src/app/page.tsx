"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-provider";
import { getDefaultRouteForRole } from "@/store/auth";

export default function HomePage() {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(session ? getDefaultRouteForRole(session.role) : "/login");
  }, [session, isLoading, router]);

  return null;
}
