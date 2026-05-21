"use client";

import { login } from "@/lib/api";
import { clearStoredAuthSession, getStoredAuthSession, setStoredAuthSession, type StoredAuthSession } from "@/store/auth";

const VALIDATION_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存

let cachedSession: StoredAuthSession | null = null;
let cachedAt = 0;

export async function getValidatedAuthSession(): Promise<StoredAuthSession | null> {
  const now = Date.now();

  // TTL 内直接返回缓存，不请求后端
  if (cachedSession && now - cachedAt < VALIDATION_TTL_MS) {
    return cachedSession;
  }

  const storedSession = await getStoredAuthSession();
  if (!storedSession) {
    cachedSession = null;
    cachedAt = 0;
    return null;
  }

  try {
    const data = await login(storedSession.key);
    const nextSession: StoredAuthSession = {
      key: storedSession.key,
      role: data.role,
      subjectId: data.subject_id,
      name: data.name,
    };
    await setStoredAuthSession(nextSession);
    cachedSession = nextSession;
    cachedAt = now;
    return nextSession;
  } catch {
    await clearStoredAuthSession();
    cachedSession = null;
    cachedAt = 0;
    return null;
  }
}

/** 强制清除验证缓存（登出时调用） */
export function invalidateAuthCache() {
  cachedSession = null;
  cachedAt = 0;
}

