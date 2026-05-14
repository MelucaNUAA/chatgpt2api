# API Key 生图数量限制设计

## 概述

管理员在创建访客 API Key 时，可以设置生图数量限制。默认限制为 10 张。达到限制后 API Key 自动禁用。管理员 Key 豁免此限制。

## 需求

- 每个 API Key 独立计数，按生成的图片张数计算（n=4 算 4 张）
- 默认限制 10 张，达到后自动禁用 Key（enabled=false）
- 管理员 Key（legacy admin 和 role=admin）不受限制
- 管理员可以后续修改限额和重置已用计数
- 仅针对图片生成请求（4 个端点），不影响文本对话等其他 API

## 数据模型

在现有 auth key 数据中增加两个字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `image_limit` | `int \| None` | 生图数量上限。`None` 表示不限制 |
| `image_used` | `int` | 已使用的生图数量 |

- 管理员 Key：`image_limit=None`（不限），`image_used=0`
- 访客 Key：`image_limit=10`（可自定义），`image_used=0`
- 存量 Key 迁移：缺少这两个字段的 Key 自动补全默认值

## 后端改动

### AuthService 扩展

1. `_normalize_item`：增加 `image_limit` 和 `image_used` 字段的解析和默认值处理
2. `_public_item`：暴露 `image_limit` 和 `image_used` 字段
3. `create_key`：增加可选参数 `image_limit`，访客 Key 默认 10
4. `update_key`：支持更新 `image_limit` 和重置 `image_used`
5. 新增 `check_image_quota(key_id, count)`：检查配额是否足够
6. 新增 `consume_image_quota(key_id, count)`：递增已用数量，达到上限时自动禁用

### 图片生成端点配额拦截

在以下 4 个端点添加配额检查：

- `POST /v1/images/generations`（同步文生图）
- `POST /v1/images/edits`（同步图生图）
- `POST /api/image-tasks/generations`（异步文生图）
- `POST /api/image-tasks/edits`（异步图生图）

流程：
1. 从 `identity` 获取 Key ID
2. 如果是 legacy admin 身份，跳过配额检查
3. 调用 `check_image_quota(key_id, n)` 检查配额
4. 生图成功后调用 `consume_image_quota(key_id, n)` 递增计数
5. 配额不足时返回 `403 Forbidden`

### API 端点改动

- `POST /api/auth/users`：增加可选参数 `image_limit`
- `POST /api/auth/users/{key_id}`：支持更新 `image_limit`、重置 `image_used`
- `GET /api/auth/users`：返回中包含 `image_limit` 和 `image_used`

## 前端改动

在 Key 管理页面中：

- 创建 Key 时：增加"生图限额"输入框，默认值 10
- Key 列表：显示 `已用/限额` 列（如 `5/10`），管理员 Key 显示"不限"
- 编辑 Key 时：可修改限额、可重置已用计数

## 配额耗尽响应

当 Key 配额耗尽时，返回 HTTP 403：

```json
{
  "error": {
    "message": "该 API Key 的生图配额已用完（已用 10/10）",
    "type": "quota_exceeded",
    "code": "image_limit_exceeded"
  }
}
```
