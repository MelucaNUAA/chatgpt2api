# 统一创作页面设计文档

## 概述

将现有的 `/image`（画图）页面重构为 `/creation`（创作）统一页面，支持在同一会话中混合使用聊天和生图两种模式。导航栏"画图"更名为"创作"。

## 1. 路由与导航

- `/image` → `/creation`（旧路径 301 重定向）
- 导航栏：画图 → 创作
- `/image-manager` 路由不变

## 2. 数据模型

```typescript
type ChatRole = "user" | "assistant" | "system";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  images?: string[];
  createdAt: string;
};

type ChatTurn = {
  id: string;
  type: "chat";
  messages: ChatMessage[];
  model: string;
  status: "streaming" | "done" | "error";
  error?: string;
  createdAt: string;
};

type ImageTurn = {
  // 保持现有 ImageTurn 结构
  type: "image";
  // ...existing fields...
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: (ChatTurn | ImageTurn)[];
};
```

兼容：没有 `type` 字段的旧 turn 自动识别为 `image`。

## 3. 前端组件架构

```
CreationPage
  └── CreationPageContent
        ├── CreationSidebar（统一侧边栏）
        │     ├── 会话列表，显示类型标签（💬 / 🖼️ / 💬🖼️）
        │     └── 新建对话、清空历史、重命名、删除
        ├── ChatResults（聊天消息渲染区）
        │     ├── 用户消息气泡（右侧）
        │     ├── AI 回复气泡（左侧，Markdown + 代码高亮）
        │     ├── 流式打字效果
        │     └── 图片消息内嵌显示
        ├── ImageResults（现有生图结果区，保持不变）
        ├── CreationComposer（统一输入框）
        │     ├── 模式切换：[聊天] [生图]
        │     ├── 聊天模式：文本框 + 图片上传 + 模型选择 + 发送
        │     └── 生图模式：文本框 + 参考图 + 张数 + 比例 + 发送
        ├── ImageLightbox（保持不变）
        └── 删除确认 Dialog
```

模式切换不影响会话，同一会话可混合两种 turn。

Markdown 渲染：`react-markdown` + `remark-gfm` + `react-syntax-highlighter`。

模型选择：调用 `/v1/models` 获取列表，默认 `"auto"`。

## 4. 后端 API

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/chat/stream` | POST | 流式聊天（SSE） |
| `/api/models` | GET | 获取可用模型列表 |

`/api/chat/stream` 内部调用已有 `openai_v1_chat_complete.handle()`，不需要重新实现。

前端用 `fetch` + `ReadableStream` 消费 SSE（需要 POST 请求）。

## 5. 改动范围

### 新增文件

| 文件 | 用途 |
|------|------|
| `web/src/app/creation/page.tsx` | 统一创作页面 |
| `web/src/app/creation/components/creation-composer.tsx` | 统一输入框 |
| `web/src/app/creation/components/creation-sidebar.tsx` | 统一侧边栏 |
| `web/src/app/creation/components/chat-results.tsx` | 聊天消息渲染 |
| `web/src/store/conversations.ts` | 统一会话存储 |
| `api/chat.py` | 聊天 API 端点 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `web/src/components/top-nav.tsx` | "画图" → "创作"，`/image` → `/creation` |
| `web/src/app/image/page.tsx` | 重定向到 `/creation` |
| `web/src/app/page.tsx` | 默认重定向改为 `/creation` |
| `web/src/lib/api.ts` | 新增 `streamChat()`、`fetchModels()` |
| `api/app.py` | 注册 chat router |

### 保持不变

- `web/src/app/image/components/*` — 供创作页面复用
- `web/src/app/image-manager/*` — 不变
- 后端已有 API（`/v1/chat/completions` 等）— 不变

### 新增依赖

- `react-markdown`
- `remark-gfm`
- `react-syntax-highlighter`
