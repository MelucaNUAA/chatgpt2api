"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  FolderOpen,
  Github,
  MoreHorizontal,
  Paintbrush,
  ShoppingBag,
  ScrollText,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import webConfig from "@/constants/common-env";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-provider";
import { cn } from "@/lib/utils";
import { clearStoredAuthSession } from "@/store/auth";
import { invalidateAuthCache } from "@/lib/auth-session";

const adminNavItems = [
  { href: "/image", label: "画图" },
  { href: "/ecommerce", label: "电商配图" },
  { href: "/accounts", label: "号池管理" },
  { href: "/register", label: "注册机" },
  { href: "/image-manager", label: "图片管理" },
  { href: "/logs", label: "日志管理" },
  { href: "/settings", label: "设置" },
];

const userNavItems = [{ href: "/image", label: "画图" }];

const bottomTabItems = [
  { href: "/image", label: "画图", icon: Paintbrush },
  { href: "/accounts", label: "号池", icon: Users },
  { href: "/image-manager", label: "图片", icon: FolderOpen },
] as const;

const moreMenuItems = [
  { href: "/ecommerce", label: "电商配图", icon: ShoppingBag },
  { href: "/logs", label: "日志", icon: ScrollText },
  { href: "/register", label: "注册机", icon: UserPlus },
  { href: "/settings", label: "设置", icon: Settings },
];

function MoreMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:bg-stone-900"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
            <div className="space-y-1">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const isMoreActive = ["/ecommerce", "/logs", "/register", "/settings"].some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200/50 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-stone-950/80 sm:hidden">
        <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
          {bottomTabItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition",
                  active
                    ? "text-stone-950 dark:text-white"
                    : "text-stone-400 dark:text-stone-500",
                )}
              >
                <motion.div
                  animate={active ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Icon className="size-5" />
                </motion.div>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition",
              isMoreActive
                ? "text-stone-950 dark:text-white"
                : "text-stone-400 dark:text-stone-500",
            )}
          >
            <motion.div
              animate={isMoreActive ? { scale: 1.1 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <MoreHorizontal className="size-5" />
            </motion.div>
            更多
          </button>
        </div>
      </nav>
      <MoreMenuSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading } = useAuth();

  const handleLogout = async () => {
    invalidateAuthCache();
    await clearStoredAuthSession();
    router.replace("/login");
  };

  if (pathname === "/login" || isLoading || !session) {
    return null;
  }

  const navItems = session.role === "admin" ? adminNavItems : userNavItems;
  const roleLabel = session.role === "admin" ? "管理员" : "普通用户";
  const displayName = session.name.trim() || roleLabel;

  return (
    <header className="sticky top-0 z-50 border-b border-stone-100/50 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-stone-950/80">
      <div className="flex min-h-12 flex-col gap-1 px-3 py-2 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-0">
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <Link
            href="/image"
            className="shrink-0 py-1 text-[15px] font-bold tracking-tight text-stone-950 transition hover:text-stone-700 dark:text-stone-50 dark:hover:text-white"
          >
            chatgpt2api
          </Link>
          <a
            href="https://github.com/basketikun/chatgpt2api"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 py-1 text-sm text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200"
            aria-label="GitHub repository"
          >
            <Github className="size-4" />
            <span className="hidden md:inline">GitHub</span>
          </a>
          <div className="ml-auto sm:hidden">
            <ThemeToggle />
          </div>
          <button
            type="button"
            className="shrink-0 py-1 text-xs text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 sm:hidden"
            onClick={() => void handleLogout()}
          >
            退出
          </button>
        </div>
        <nav className="hide-scrollbar -mx-1 hidden min-w-0 flex-1 gap-1 overflow-x-auto px-1 sm:mx-0 sm:flex sm:justify-center sm:gap-8 sm:overflow-visible sm:px-0">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium transition sm:rounded-none sm:px-0 sm:text-[15px]",
                  active
                    ? "bg-stone-950 text-white sm:bg-transparent sm:font-semibold sm:text-stone-950 dark:bg-white dark:text-stone-950 dark:sm:bg-transparent dark:sm:text-white"
                    : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-0 -bottom-[1px] hidden h-0.5 bg-stone-950 dark:bg-white sm:block" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center justify-end gap-2 sm:flex sm:gap-3">
          <ThemeToggle />
          <span className="hidden rounded-md bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-500 dark:bg-white/8 dark:text-stone-300 sm:inline-block sm:text-[11px]">
            {roleLabel} · {displayName}
          </span>
          <span className="hidden rounded-md bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-500 dark:bg-white/8 dark:text-stone-300 sm:inline-block sm:text-[11px]">
            v{webConfig.appVersion}
          </span>
          <button
            type="button"
            className="py-1 text-xs text-stone-400 transition hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 sm:text-sm"
            onClick={() => void handleLogout()}
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomBar() {
  const pathname = usePathname();
  const { session, isLoading } = useAuth();

  if (pathname === "/login" || isLoading || !session) {
    return null;
  }

  if (typeof document === "undefined") return null;
  return createPortal(<BottomTabBar />, document.body);
}
