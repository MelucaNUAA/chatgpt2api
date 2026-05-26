# 手机端底部 TAB 导航 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机端采用底部固定 TAB 导航，精简顶栏，适配安全区域，优化各页面手机端布局。

**Architecture:** 改造现有 TopNav 组件，手机端（< sm）显示精简顶栏 + 底部 TAB 栏，桌面端（>= sm）保持不变。底部 TAB 4 个：画图、号池、图片、更多。更多菜单弹出底部抽屉包含日志、注册机、设置。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, motion (framer-motion), lucide-react icons

---

## Chunk 1: 底部 TAB 栏与顶栏改造

### Task 1: 改造 TopNav 组件 - 手机端精简顶栏

**Files:**
- Modify: `web/src/components/top-nav.tsx`

- [ ] **Step 1: 精简手机端顶栏**

将 `TopNav` 组件中手机端（`sm:` 以下）的顶栏简化为：logo + 主题切换 + 退出按钮。移除手机端的 GitHub 链接、角色标签、版本号。

修改 `top-nav.tsx`，将现有的手机端顶栏部分替换为精简版本：

```tsx
// 在 TopNav 组件中，修改 return 部分
// 手机端顶栏：只保留 logo、主题切换、退出
// 桌面端：保持不变
```

具体改动：
- GitHub 链接的 `<span className="hidden md:inline">GitHub</span>` 已经有 `hidden md:inline`，但图标仍然显示。给整个 `<a>` 标签添加 `hidden sm:inline-flex`
- 手机端的退出按钮和主题切换按钮保持在顶部
- 桌面端的角色标签和版本号保持 `hidden sm:inline-block`

- [ ] **Step 2: 验证手机端顶栏精简效果**

在浏览器中缩小窗口到手机宽度，确认：
- 顶部只显示 logo、主题切换、退出按钮
- GitHub 链接、角色标签、版本号在手机端隐藏

- [ ] **Step 3: Commit**

```bash
git add web/src/components/top-nav.tsx
git commit -m "refactor: 精简手机端顶栏，移除多余信息"
```

### Task 2: 添加底部 TAB 栏组件

**Files:**
- Modify: `web/src/components/top-nav.tsx`

- [ ] **Step 1: 添加底部 TAB 栏**

在 `top-nav.tsx` 中新增 `BottomTabBar` 组件，在 `TopNav` 组件底部渲染。

底部 TAB 结构：
- 固定定位 `fixed bottom-0 left-0 right-0 z-50`
- 毛玻璃背景 `bg-white/80 dark:bg-stone-950/80 backdrop-blur-lg border-t`
- 4 个等分 TAB：画图、号池、图片、更多
- 每个 TAB 包含 lucide 图标 + 文字
- 选中态：图标和文字高亮色
- 安全区域：`pb-[env(safe-area-inset-bottom)]`
- 仅在手机端显示（`sm:hidden`）

图标选择：
- 画图：`Paintbrush`
- 号池：`Users`
- 图片：`FolderOpen`
- 更多：`MoreHorizontal`

```tsx
const bottomTabItems = [
  { href: "/image", label: "画图", icon: Paintbrush },
  { href: "/accounts", label: "号池", icon: Users },
  { href: "/image-manager", label: "图片", icon: FolderOpen },
] as const;

function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const isMoreActive = ["/logs", "/register", "/settings"].some(
    (path) => pathname === path || pathname.startsWith(path + "/")
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
                    : "text-stone-400 dark:text-stone-500"
                )}
              >
                <Icon className="size-5" />
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
                : "text-stone-400 dark:text-stone-500"
            )}
          >
            <MoreHorizontal className="size-5" />
            更多
          </button>
        </div>
      </nav>
      {/* 更多菜单抽屉 - 下一个 Task 实现 */}
      <MoreMenuSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
```

- [ ] **Step 2: 在 TopNav 中渲染底部 TAB 栏**

在 `TopNav` 组件的 return 中，在 header 之后添加 `<BottomTabBar />`，但仅在用户已登录且非 login 页面时显示。

- [ ] **Step 3: 验证底部 TAB 栏显示**

在手机端确认：
- 底部显示 4 个 TAB（画图、号池、图片、更多）
- 选中态正确高亮
- 安全区域有 padding

- [ ] **Step 4: Commit**

```bash
git add web/src/components/top-nav.tsx
git commit -m "feat: 添加手机端底部 TAB 栏"
```

### Task 3: 实现「更多」菜单抽屉

**Files:**
- Modify: `web/src/components/top-nav.tsx`

- [ ] **Step 1: 实现 MoreMenuSheet 组件**

使用 motion 库实现底部抽屉组件：

```tsx
import { AnimatePresence, motion } from "motion/react";

const moreMenuItems = [
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
```

- [ ] **Step 2: 验证更多菜单**

在手机端点击「更多」TAB：
- 弹出底部抽屉，从下往上滑入
- 显示日志、注册机、设置三个入口
- 点击遮罩或菜单项后关闭
- 当前在日志/注册机/设置页面时，「更多」TAB 高亮

- [ ] **Step 3: Commit**

```bash
git add web/src/components/top-nav.tsx
git commit -m "feat: 实现更多菜单底部抽屉"
```

### Task 4: 调整布局适配底部 TAB 栏

**Files:**
- Modify: `web/src/app/layout.tsx`

- [ ] **Step 1: 增加底部 padding**

在 `layout.tsx` 的 main 元素中，给手机端增加底部 padding 以避免内容被底部 TAB 栏遮挡。

将：
```tsx
<main className="min-h-screen overflow-x-hidden bg-stone-50 px-4 pt-0 pb-2 text-stone-900 dark:bg-stone-950 dark:text-stone-100 sm:px-6 sm:pt-2 lg:px-8">
```

改为：
```tsx
<main className="min-h-screen overflow-x-hidden bg-stone-50 px-4 pt-0 pb-20 text-stone-900 dark:bg-stone-950 dark:text-stone-100 sm:px-6 sm:pt-2 sm:pb-2 lg:px-8">
```

`pb-20` 在手机端生效，`sm:pb-2` 在桌面端恢复原值。

- [ ] **Step 2: 验证布局**

在手机端确认：
- 页面内容不会被底部 TAB 栏遮挡
- 桌面端布局不受影响

- [ ] **Step 3: Commit**

```bash
git add web/src/app/layout.tsx
git commit -m "feat: 增加底部 padding 适配 TAB 栏"
```

---

## Chunk 2: 各页面手机端布局优化

### Task 5: 号池管理页面手机端适配

**Files:**
- Modify: `web/src/app/accounts/page.tsx`

- [ ] **Step 1: 指标卡片改为 2 列网格**

将指标卡片的网格从 `md:grid-cols-3 xl:grid-cols-6` 改为 `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`：

```tsx
<div className="grid gap-2 grid-cols-2 md:gap-3 md:grid-cols-3 xl:grid-cols-6">
```

- [ ] **Step 2: 操作按钮区域适配**

将顶部操作按钮区域在手机端改为纵向排列，按钮全宽：

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
```

每个按钮在手机端添加 `w-full sm:w-auto`。

- [ ] **Step 3: 筛选区域适配**

搜索和筛选下拉框在手机端全宽排列：

```tsx
<div className="flex flex-col gap-2 lg:flex-row lg:items-center">
```

- [ ] **Step 4: 表格操作栏适配**

表格内的批量操作按钮在手机端改为换行排列。

- [ ] **Step 5: 验证并 Commit**

```bash
git add web/src/app/accounts/page.tsx
git commit -m "feat: 号池管理页面手机端布局适配"
```

### Task 6: 图片管理页面手机端适配

**Files:**
- Modify: `web/src/app/image-manager/page.tsx`

- [ ] **Step 1: 图片网格改为 2 列**

将图片网格从 `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` 改为 `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`：

```tsx
<div className="grid gap-0 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
```

- [ ] **Step 2: 筛选区域适配**

日期筛选和操作按钮在手机端改为纵向排列。

- [ ] **Step 3: 验证并 Commit**

```bash
git add web/src/app/image-manager/page.tsx
git commit -m "feat: 图片管理页面手机端布局适配"
```

### Task 7: 日志页面手机端适配

**Files:**
- Modify: `web/src/app/logs/page.tsx`

- [ ] **Step 1: 筛选区域适配**

筛选按钮在手机端改为纵向排列：

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
```

- [ ] **Step 2: 表格操作栏适配**

批量操作区域在手机端改为换行排列。

- [ ] **Step 3: 验证并 Commit**

```bash
git add web/src/app/logs/page.tsx
git commit -m "feat: 日志页面手机端布局适配"
```

### Task 8: 画图页面手机端适配

**Files:**
- Modify: `web/src/app/image/page.tsx`

- [ ] **Step 1: 调整高度计算**

画图页面的高度计算需要考虑底部 TAB 栏。将：

```tsx
className="... h-[calc(100dvh-6.5rem)] ... sm:h-[calc(100dvh-5.25rem)] ..."
```

改为：

```tsx
className="... h-[calc(100dvh-10rem)] ... sm:h-[calc(100dvh-5.25rem)] ..."
```

手机端多减去底部 TAB 栏的高度（约 3.5rem）。

- [ ] **Step 2: 验证并 Commit**

```bash
git add web/src/app/image/page.tsx
git commit -m "feat: 画图页面手机端高度适配底部 TAB 栏"
```

---

## Chunk 3: 过渡动画与最终验证

### Task 9: 添加 TAB 切换动画

**Files:**
- Modify: `web/src/components/top-nav.tsx`

- [ ] **Step 1: 给底部 TAB 图标添加选中动画**

使用 motion 给选中的 TAB 图标添加缩放动画：

```tsx
<motion.div
  animate={active ? { scale: 1.1 } : { scale: 1 }}
  transition={{ type: "spring", stiffness: 400, damping: 20 }}
>
  <Icon className="size-5" />
</motion.div>
```

- [ ] **Step 2: 验证动画效果**

在手机端切换 TAB，确认图标有轻微缩放动画。

- [ ] **Step 3: Commit**

```bash
git add web/src/components/top-nav.tsx
git commit -m "feat: 添加底部 TAB 选中动画"
```

### Task 10: 全端验证与收尾

- [ ] **Step 1: 手机端完整验证**

在手机端（或浏览器窄窗口）逐一验证：
- 底部 TAB 栏正确显示 4 个 TAB
- 点击「更多」弹出抽屉菜单
- 各页面内容不被底部 TAB 遮挡
- 顶栏只显示 logo、主题切换、退出
- 各页面布局在窄屏下正常

- [ ] **Step 2: 桌面端回归验证**

在桌面端验证：
- 顶部导航保持不变
- 底部 TAB 栏不显示
- 所有页面布局不受影响

- [ ] **Step 3: 构建验证**

```bash
cd web && pnpm build
```

确认构建无错误。

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat: 手机端底部 TAB 导航与布局优化完成"
```
