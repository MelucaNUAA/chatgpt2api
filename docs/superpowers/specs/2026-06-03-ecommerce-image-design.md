# 电商配图生成页面设计文档

## 概述

为 ChatGPT2API 新增独立的电商配图生成页面 (`/ecommerce`)，面向 Admin 用户。用户上传商品照片并填写产品信息后，由 AI 自动规划多维度图片方案（主图、细节展示、场景图、包装展示等），用户审核修改后批量或逐张生成。

## 核心流程

```
上传商品照片 + 填写产品信息
        ↓
   点击"生成方案"
        ↓
  前端调用 ChatGPT 生成图片方案（结构化 JSON）
        ↓
  用户审核：编辑提示词、调整文字内容、删除/排序方案卡片
        ↓
  确认后点击"全部生成"或逐张生成
        ↓
  结果展示：预览、下载、单张重试
```

## 页面布局

### 整体结构：左右分栏

- **左侧面板**（约 35% 宽度）：商品信息输入区
- **右侧面板**（约 65% 宽度）：上半部分方案编辑区 + 下半部分结果展示区

移动端堆叠为上下布局。

### 左侧面板 - 商品信息表单

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 商品照片 | 文件上传 | 是 | 支持多张，拖拽 + 点击，直接作为参考图 |
| 产品名称 | 文本输入 | 是 | |
| 产品描述 | 多行文本 | 否 | |
| 图片比例 | 选择器 | 是 | 1:1, 16:9, 4:3, 3:4, 9:16 |
| 图片数量 | 数字输入 | 否 | 可选，留空则由 AI 自动推荐 |
| 生成方案 | 按钮 | - | 触发 AI 规划 |

### 右上区域 - 方案编辑区

AI 生成的图片方案以卡片列表展示。每张卡片包含：

- **图片类型标签**：主图 / 细节展示 / 使用场景 / 包装展示 / ...
- **提示词**：可编辑的文本区域
- **文字叠加**：
  - 模式切换：提示词内生成文字 / Canvas 叠加
  - 主标题、副标题、说明文字输入
  - 是否启用文字的开关
- **操作**：删除方案卡片、拖拽排序
- **生成按钮**：单张生成

### 右下区域 - 结果展示区

- 图片网格展示已生成的图片
- 支持：大图预览、下载、单张重试
- 加载中/错误状态显示

## AI 方案规划

### 调用方式

前端通过 `/v1/chat/completions` 调用 ChatGPT，使用多模态能力分析商品照片。

### 输入

- 商品照片（作为图片输入）
- 产品名称
- 产品描述（如有）
- 期望图片数量（或"自动推荐"）
- 期望比例

### 输出格式

AI 返回结构化 JSON 数组：

```json
[
  {
    "type": "主图",
    "prompt": "A sleek wireless headphone on a white marble surface, studio lighting, product photography, high detail",
    "textOverlay": {
      "title": "Pro Sound X1",
      "subtitle": "Hi-Fi Wireless Headphones",
      "description": "40dB Active Noise Cancellation",
      "enabled": true
    }
  },
  {
    "type": "细节展示",
    "prompt": "Close-up of the headphone ear cushion, showing premium protein leather material, macro photography",
    "textOverlay": {
      "title": "Premium Comfort",
      "subtitle": "Protein Leather Cushion",
      "description": "",
      "enabled": false
    }
  },
  {
    "type": "使用场景",
    "prompt": "A person wearing wireless headphones in a cozy coffee shop, warm ambient lighting, lifestyle photography",
    "textOverlay": {
      "title": "Immerse Yourself",
      "subtitle": "Anywhere You Go",
      "description": "",
      "enabled": true
    }
  }
]
```

## 文字叠加

### 模式 A：提示词内生成文字

- 在提示词中追加文字要求
- 直接调用现有异步图片生成接口
- 优点：简单，一步到位
- 缺点：文字质量取决于模型

### 模式 B：前端 Canvas 叠加

- 提示词中不含文字要求，生成干净图片
- 生成完成后用 Canvas API 叠加文字
- 可配置：文字位置（上/中/下）、字体、颜色
- 优点：文字质量可控
- 缺点：需要额外编辑步骤

默认使用模式 A，用户可在方案卡片上切换。

## 数据模型

```typescript
// 电商配图项目
interface EcommerceProject {
  id: string
  productName: string
  productDescription: string
  productImages: StoredReferenceImage[]
  aspectRatio: string
  schemes: ImageScheme[]
  results: GeneratedResult[]
  createdAt: number
  updatedAt: number
}

// 图片方案
interface ImageScheme {
  id: string
  type: string                    // "主图" | "细节" | "场景" | "包装" | ...
  prompt: string
  textOverlay: TextOverlay
  textMode: "prompt" | "canvas"
  status: "draft" | "generating" | "done" | "error"
  resultImageId?: string
}

// 文字叠加配置
interface TextOverlay {
  enabled: boolean
  title: string
  subtitle: string
  description: string
  position: "top" | "center" | "bottom"
  color: string
}

// 生成结果
interface GeneratedResult {
  id: string
  schemeId: string
  taskId: string
  status: "loading" | "success" | "error"
  b64_json?: string
  url?: string
  error?: string
}
```

## 文件结构

```
web/src/app/ecommerce/
├── page.tsx                    # 主页面（左右分栏布局）
├── components/
│   ├── product-form.tsx        # 左侧商品信息表单
│   ├── scheme-list.tsx         # 右上方案卡片列表
│   ├── scheme-card.tsx         # 单个方案卡片
│   ├── result-grid.tsx         # 右下生成结果网格
│   └── text-overlay-editor.tsx # 文字叠加编辑器
├── store/
│   └── ecommerce.ts            # Zustand store + localforage 持久化
└── lib/
    └── scheme-planner.ts       # AI 方案规划逻辑
```

## 需要修改的现有文件

- `web/src/components/top-nav.tsx`：新增 Ecommerce 导航项（仅 Admin）
- `web/src/store/auth.ts`：无需修改（admin 默认路由保持 accounts）

## 复用的现有能力

- 异步任务管线：`createImageGenerationTask` + `fetchImageTasks`
- 参考图上传：文件上传、压缩、粘贴支持
- UI 组件库：Button, Card, Input, Textarea, Select, Dialog, Badge 等
- 图片预览：lightbox
- 认证：auth guard + 角色控制
- 图片比例选择器：现有的比例选项

## 非目标（YAGNI）

- 不做图片后处理（裁剪、滤镜、增强）
- 不做后端存储（仅浏览器本地）
- 不做多用户协作
- 不做图片模板库（首版不做，后续可扩展）
- 不做自动抠图/背景移除（依赖模型能力）
