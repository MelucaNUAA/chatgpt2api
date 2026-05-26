# 手机端底部 TAB 导航设计

## 概述

将手机端导航从顶部水平滚动改为底部固定 TAB 栏，符合常规 APP 设计习惯，同时优化各页面的手机端布局。

## 设计目标

- 手机端采用底部 TAB 导航，桌面端保持现有顶部导航
- 精简手机端顶栏，只保留核心信息
- 适配 iPhone 底部安全区域
- 各页面控件布局适配手机操作
- TAB 切换添加过渡动画

## 底部 TAB 结构

### 主 TAB（4 个）

| TAB | 图标 | 路由 |
|-----|------|------|
| 画图 | Paintbrush | /image |
| 号池 | Users | /accounts |
| 图片 | FolderOpen | /image-manager |
| 更多 | MoreHorizontal | 弹出菜单 |

### 「更多」菜单内容

| 项目 | 路由 |
|------|------|
| 日志 | /logs |
| 注册机 | /register |
| 设置 | /settings |

## 组件结构

### 响应式切换

- 手机端（< sm）：精简顶栏 + 底部 TAB 栏
- 桌面端（>= sm）：现有顶部导航不变

### 手机端顶栏

仅保留：
- logo（chatgpt2api）
- 主题切换按钮
- 退出按钮

移除：GitHub 链接、角色标签、版本号

### 底部 TAB 栏

- 固定定位 `fixed bottom-0`
- 毛玻璃背景 `backdrop-blur-lg`
- 4 个等分 TAB，每个包含图标 + 文字
- 选中态：图标和文字高亮 + 底部指示条
- 安全区域适配：`pb-[env(safe-area-inset-bottom)]`

### 「更多」菜单

- 点击「更多」TAB 弹出底部抽屉
- 从下往上滑入动画
- 半透明遮罩背景
- 包含日志、注册机、设置三个入口

## 页面布局适配

### 通用改动

- 所有页面内容区增加 `pb-20`（底部 TAB 栏高度 + 安全区域）
- 卡片/表格在手机端改为纵向堆叠布局

### 各页面适配

**号池管理 /accounts：**
- 账号列表从表格改为卡片式纵向排列
- 操作按钮适配窄屏

**图片管理 /image-manager：**
- 图片网格改为 2 列
- 筛选条件改为可折叠面板

**设置 /settings：**
- 设置卡片全宽纵向排列，微调间距

**日志 /logs：**
- 日志条目改为卡片式，适配窄屏

**注册机 /register：**
- 表单全宽排列

**画图 /image：**
- 画布区域占满宽度
- 工具栏适配窄屏

## 过渡动画

使用项目已有的 motion（framer-motion）库：

- 页面切换：TAB 切换时内容区 fade-in 动画，持续 200ms
- 更多菜单：底部抽屉从下往上滑入，带半透明遮罩
- TAB 指示条：选中 TAB 时底部指示条平滑过渡

## 改动文件清单

| 文件 | 改动 |
|------|------|
| web/src/components/top-nav.tsx | 重构：手机端精简顶栏 + 新增底部 TAB 栏 + 更多菜单 |
| web/src/app/layout.tsx | 内容区增加底部 padding 适配 |
| web/src/app/image/page.tsx | 手机端布局优化 |
| web/src/app/accounts/page.tsx | 手机端布局优化 |
| web/src/app/image-manager/page.tsx | 手机端布局优化 |
| web/src/app/logs/page.tsx | 手机端布局优化 |
| web/src/app/settings/page.tsx | 手机端布局优化 |
| web/src/app/register/page.tsx | 手机端布局优化 |
