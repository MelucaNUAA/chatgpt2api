# 图片管理批量下载功能设计

## 概述

为图片管理页面（`/image-manager`）增加批量下载功能，支持选中多张图片后打包为 ZIP 文件下载，同时在图片卡片上增加单张下载按钮。

## 后端 API

### 新增端点：`POST /api/images/download`

- **权限**：admin（复用 `get_admin_user`）
- **请求体**：
  ```json
  {
    "paths": ["2024/01/01/abc.png", "2024/01/02/def.png"]
  }
  ```
- **处理逻辑**：
  1. 遍历 `paths`，从 `data/images/` 读取每个文件
  2. 用 Python 标准库 `zipfile.ZipFile` 在内存中创建 ZIP
  3. 每个文件以其相对路径作为 ZIP 内的文件名
  4. 跳过不存在的文件，不中断打包
  5. 若全部文件不存在，返回 404
- **响应**：`StreamingResponse`
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="images.zip"`

### 单张下载

单张图片直接通过前端 `<a download>` 标签触发浏览器下载，文件名为原始文件名。无需新增后端接口。

## 前端改动

### 图片卡片下载按钮

在每张图片卡片的操作栏（现有复制、删除按钮旁边）增加下载图标按钮（`Download` 图标），点击后直接下载单张原图。

### 批量下载按钮

当有图片被选中时，操作栏增加「下载所选」按钮（`Download` 图标 + 文字）。点击后：

1. 调用 `downloadImages(paths)` API
2. 将响应 blob 创建临时 URL，触发浏览器下载
3. 下载过程中按钮显示 loading 状态（禁用 + spinner）

### API 层

在 `api.ts` 中新增：

```typescript
export async function downloadImages(paths: string[]): Promise<void>
```

使用 `fetch` + `blob` 方式下载二进制数据。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `api/system.py` | 新增 `POST /api/images/download` 端点 |
| `web/src/lib/api.ts` | 新增 `downloadImages` 函数 |
| `web/src/app/image-manager/page.tsx` | 添加卡片下载按钮、批量下载按钮 |

## 错误处理

- 后端：跳过不存在的文件；全部不存在返回 404
- 前端：下载失败时 toast 提示错误信息
