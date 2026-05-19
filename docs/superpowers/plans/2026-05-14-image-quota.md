# API Key 生图数量限制 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为访客 API Key 添加生图数量限制功能，管理员可设置限额，达到限制后自动禁用 Key。

**Architecture:** 扩展现有 `AuthService` 的 auth key 数据模型，增加 `image_limit` 和 `image_used` 字段。在 4 个图片生成端点添加配额检查。前端管理界面增加限额设置和展示。

**Tech Stack:** Python 3.13+, FastAPI, SQLAlchemy, Next.js (TypeScript), Zustand, shadcn/ui

---

## Chunk 1: 后端 — AuthService 数据模型与配额方法

### Task 1: 扩展 AuthService 数据模型

**Files:**
- Modify: `services/auth_service.py`

- [ ] **Step 1: 在 `_normalize_item` 中添加 `image_limit` 和 `image_used` 字段**

在 `_normalize_item` 方法的返回 dict 中，`last_used_at` 之后添加：

```python
image_limit_raw = raw.get("image_limit")
if image_limit_raw is None:
    image_limit = None
else:
    try:
        image_limit = int(image_limit_raw)
        if image_limit < 0:
            image_limit = None
    except (ValueError, TypeError):
        image_limit = None
image_used_raw = raw.get("image_used")
try:
    image_used = max(0, int(image_used_raw or 0))
except (ValueError, TypeError):
    image_used = 0
```

返回 dict 中添加：
```python
"image_limit": image_limit,
"image_used": image_used,
```

- [ ] **Step 2: 在 `_public_item` 中暴露新字段**

在 `_public_item` 返回 dict 中添加：
```python
"image_limit": item.get("image_limit"),
"image_used": item.get("image_used"),
```

- [ ] **Step 3: 修改 `create_key` 方法支持 `image_limit` 参数**

方法签名改为：
```python
def create_key(self, *, role: AuthRole, name: str = "", image_limit: int | None = None) -> tuple[dict[str, object], str]:
```

在 item 构建中添加：
```python
"image_limit": image_limit,
"image_used": 0,
```

- [ ] **Step 4: 修改 `update_key` 方法支持 `image_limit` 和 `image_used` 更新**

在 `update_key` 的更新逻辑中，`if "key" in updates` 之后添加：
```python
if "image_limit" in updates and updates.get("image_limit") is not None:
    limit_val = updates.get("image_limit")
    if limit_val == "" or limit_val == -1:
        next_item["image_limit"] = None
    else:
        try:
            next_item["image_limit"] = max(1, int(limit_val))
        except (ValueError, TypeError):
            pass
if updates.get("reset_image_usage"):
    next_item["image_used"] = 0
```

- [ ] **Step 5: 添加 `check_image_quota` 方法**

```python
def check_image_quota(self, key_id: str, count: int) -> None:
    """检查配额，不足则抛出 ValueError。管理员 Key（image_limit=None）跳过。"""
    with self._lock:
        self._reload_locked()
        for item in self._items:
            if item.get("id") != key_id:
                continue
            limit = item.get("image_limit")
            if limit is None:
                return  # 不限制
            used = int(item.get("image_used") or 0)
            if used + count > limit:
                raise ValueError(f"该 API Key 的生图配额已用完（已用 {used}/{limit}）")
            return
```

- [ ] **Step 6: 添加 `consume_image_quota` 方法**

```python
def consume_image_quota(self, key_id: str, count: int) -> None:
    """递增已用数量，达到上限时自动禁用 Key。"""
    with self._lock:
        self._reload_locked()
        for index, item in enumerate(self._items):
            if item.get("id") != key_id:
                continue
            limit = item.get("image_limit")
            if limit is None:
                return  # 不限制
            next_item = dict(item)
            next_item["image_used"] = int(next_item.get("image_used") or 0) + count
            if next_item["image_used"] >= limit:
                next_item["enabled"] = False
            self._items[index] = next_item
            self._save()
            return
```

- [ ] **Step 7: 运行验证**

```bash
cd /home/ubuntu/chatgpt2api
python -c "from services.auth_service import AuthService; print('import ok')"
```

- [ ] **Step 8: 提交**

```bash
git add services/auth_service.py
git commit -m "feat: AuthService 增加生图配额字段和检查方法"
```

---

## Chunk 2: 后端 — API 端点扩展

### Task 2: 更新用户密钥 CRUD 端点

**Files:**
- Modify: `api/accounts.py`

- [ ] **Step 1: 修改 `UserKeyCreateRequest` 模型**

```python
class UserKeyCreateRequest(BaseModel):
    name: str = ""
    image_limit: int | None = Field(default=10, ge=1, description="生图数量限制，null 表示不限制")
```

- [ ] **Step 2: 修改 `UserKeyUpdateRequest` 模型**

```python
class UserKeyUpdateRequest(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    key: str | None = None
    image_limit: int | None = Field(default=None, description="生图数量限制，-1 或空字符串表示不限制")
    reset_image_usage: bool = Field(default=False, description="重置已用生图计数")
```

- [ ] **Step 3: 修改 `create_user_key` 端点**

将 `auth_service.create_key(role="user", name=body.name)` 改为：
```python
item, raw_key = auth_service.create_key(role="user", name=body.name, image_limit=body.image_limit)
```

- [ ] **Step 4: 修改 `update_user_key` 端点的 updates 构建**

在 updates dict 构建中添加 `image_limit` 和 `reset_image_usage`：
```python
updates = {
    key: value
    for key, value in {
        "name": body.name,
        "enabled": body.enabled,
        "key": body.key,
        "image_limit": body.image_limit,
        "reset_image_usage": body.reset_image_usage,
    }.items()
    if value is not None and value is not False and value != ""
}
```

注意：`image_limit` 需要特殊处理，因为 `None` 表示"不限制"而不是"不更新"。需要用哨兵值区分。改为：

```python
updates: dict[str, object] = {}
if body.name is not None:
    updates["name"] = body.name
if body.enabled is not None:
    updates["enabled"] = body.enabled
if body.key is not None:
    updates["key"] = body.key
if body.image_limit is not None:
    updates["image_limit"] = body.image_limit
if body.reset_image_usage:
    updates["reset_image_usage"] = True
```

- [ ] **Step 5: 提交**

```bash
git add api/accounts.py
git commit -m "feat: 用户密钥 API 支持生图限额参数"
```

---

## Chunk 3: 后端 — 图片生成端点配额拦截

### Task 3: 在 4 个图片生成端点添加配额检查

**Files:**
- Modify: `api/ai.py`
- Modify: `api/image_tasks.py`

- [ ] **Step 1: 在 `api/ai.py` 中添加配额检查辅助函数**

在文件顶部 import 区域添加：
```python
from services.auth_service import auth_service
```

在 `create_router` 函数之前添加辅助函数：
```python
def _check_and_consume_image_quota(identity: dict[str, object], count: int) -> None:
    """检查并消耗生图配额。legacy admin 跳过。"""
    key_id = str(identity.get("id") or "")
    if not key_id or key_id == "admin":
        return  # legacy admin，跳过
    if identity.get("role") == "admin":
        return  # 管理员 Key，跳过
    auth_service.check_image_quota(key_id, count)
    auth_service.consume_image_quota(key_id, count)
```

- [ ] **Step 2: 在 `generate_images` 端点添加配额检查**

在 `await filter_or_log(call, body.prompt)` 之后、`return await call.run(...)` 之前添加：
```python
_check_and_consume_image_quota(identity, body.n)
```

- [ ] **Step 3: 在 `edit_images` 端点添加配额检查**

在 `await filter_or_log(call, prompt)` 之后、构建 payload 之前添加：
```python
_check_and_consume_image_quota(identity, n)
```

- [ ] **Step 4: 在 `api/image_tasks.py` 中添加配额检查**

在文件顶部 import 区域添加：
```python
from services.auth_service import auth_service
```

添加同样的辅助函数 `_check_and_consume_image_quota`。

- [ ] **Step 5: 在 `create_generation_task` 端点添加配额检查**

在 `await filter_or_log(...)` 之后、`try:` 之前添加：
```python
_check_and_consume_image_quota(identity, 1)
```

- [ ] **Step 6: 在 `create_edit_task` 端点添加配额检查**

在 `await filter_or_log(...)` 之后、`uploads = [...]` 之前添加：
```python
_check_and_consume_image_quota(identity, 1)
```

- [ ] **Step 7: 提交**

```bash
git add api/ai.py api/image_tasks.py
git commit -m "feat: 图片生成端点添加生图配额检查"
```

---

## Chunk 4: 前端 — TypeScript 类型与 API 函数

### Task 4: 更新前端类型定义和 API 函数

**Files:**
- Modify: `web/src/lib/api.ts`

- [ ] **Step 1: 更新 `UserKey` 类型**

```typescript
export type UserKey = {
  id: string;
  name: string;
  role: "user";
  enabled: boolean;
  created_at: string | null;
  last_used_at: string | null;
  image_limit: number | null;
  image_used: number;
};
```

- [ ] **Step 2: 更新 `createUserKey` 函数**

```typescript
export async function createUserKey(name: string, imageLimit?: number | null) {
  return httpRequest<{ item: UserKey; key: string; items: UserKey[] }>("/api/auth/users", {
    method: "POST",
    body: { name, image_limit: imageLimit ?? 10 },
  });
}
```

- [ ] **Step 3: 更新 `updateUserKey` 函数**

```typescript
export async function updateUserKey(
  keyId: string,
  updates: { enabled?: boolean; name?: string; key?: string; image_limit?: number; reset_image_usage?: boolean },
) {
  return httpRequest<{ item: UserKey; items: UserKey[] }>(`/api/auth/users/${keyId}`, {
    method: "POST",
    body: updates,
  });
}
```

- [ ] **Step 4: 提交**

```bash
git add web/src/lib/api.ts
git commit -m "feat: 前端 API 类型支持生图限额字段"
```

---

## Chunk 5: 前端 — 用户密钥管理界面

### Task 5: 更新 UserKeysCard 组件

**Files:**
- Modify: `web/src/app/settings/components/user-keys-card.tsx`

- [ ] **Step 1: 添加 state 变量**

在现有 state 声明区域添加：
```typescript
const [imageLimit, setImageLimit] = useState("10");
const [editImageLimit, setEditImageLimit] = useState("");
const [isResettingUsage, setIsResettingUsage] = useState(false);
```

- [ ] **Step 2: 更新创建对话框**

在"名称"输入框之后添加"生图限额"输入框：
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-stone-700">生图限额</label>
  <Input
    value={imageLimit}
    onChange={(event) => setImageLimit(event.target.value)}
    placeholder="10"
    type="number"
    min="1"
    className="h-11 rounded-xl border-stone-200 bg-white"
  />
  <p className="text-xs text-stone-500">该密钥最多可生成的图片数量，留空表示不限制。</p>
</div>
```

- [ ] **Step 3: 更新 `handleCreate` 函数**

```typescript
const handleCreate = async () => {
  setIsCreating(true);
  try {
    const limit = imageLimit.trim() ? Math.max(1, parseInt(imageLimit, 10)) : null;
    const data = await createUserKey(name.trim(), limit);
    setItems(data.items);
    setRevealedKey(data.key);
    setName("");
    setImageLimit("10");
    setIsDialogOpen(false);
    toast.success("用户密钥已创建");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "创建用户密钥失败");
  } finally {
    setIsCreating(false);
  }
};
```

- [ ] **Step 4: 在 Key 列表中显示配额信息**

在每个 item 的 `flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500` div 中添加：
```tsx
<span>
  生图 {item.image_limit === null ? "不限" : `${item.image_used}/${item.image_limit}`}
</span>
```

如果 `image_limit !== null && image_used >= image_limit`，显示一个"配额已用完"的 Badge。

- [ ] **Step 5: 更新 `openEditDialog` 函数**

```typescript
const openEditDialog = (item: UserKey) => {
  setEditingItem(item);
  setEditName(item.name);
  setEditKey("");
  setEditImageLimit(item.image_limit === null ? "" : String(item.image_limit));
  setIsResettingUsage(false);
};
```

- [ ] **Step 6: 更新编辑对话框**

在"新的专用密钥"输入框之后添加：
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-stone-700">生图限额</label>
  <Input
    value={editImageLimit}
    onChange={(event) => setEditImageLimit(event.target.value)}
    placeholder="留空表示不限制"
    type="number"
    min="1"
    className="h-11 rounded-xl border-stone-200 bg-white"
  />
  <p className="text-xs text-stone-500">
    当前已使用 {editingItem?.image_used ?? 0} 张
    {editingItem?.image_limit !== null ? `（上限 ${editingItem?.image_limit}）" : "（不限制）"}
  </p>
</div>
<div className="flex items-center gap-2">
  <Button
    type="button"
    variant="outline"
    className="h-9 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
    onClick={() => setIsResettingUsage(true)}
    disabled={isResettingUsage || (editingItem?.image_used ?? 0) === 0}
  >
    重置已用计数
  </Button>
  {isResettingUsage && (
    <span className="text-xs text-emerald-600">保存后重置为 0</span>
  )}
</div>
```

- [ ] **Step 7: 更新 `handleEdit` 函数**

```typescript
const handleEdit = async () => {
  if (!editingItem) return;
  const item = editingItem;
  const trimmedName = editName.trim();
  const trimmedKey = editKey.trim();
  const limitValue = editImageLimit.trim() ? Math.max(1, parseInt(editImageLimit, 10)) : -1;
  const hasNameChange = trimmedName !== item.name;
  const hasKeyChange = !!trimmedKey;
  const hasLimitChange = limitValue !== (item.image_limit ?? -1);
  const hasReset = isResettingUsage;

  if (!hasNameChange && !hasKeyChange && !hasLimitChange && !hasReset) {
    setEditingItem(null);
    return;
  }

  setItemPending(item.id, true);
  try {
    const data = await updateUserKey(item.id, {
      ...(hasNameChange ? { name: trimmedName } : {}),
      ...(hasKeyChange ? { key: trimmedKey } : {}),
      ...(hasLimitChange ? { image_limit: limitValue } : {}),
      ...(hasReset ? { reset_image_usage: true } : {}),
    });
    setItems(data.items);
    setEditingItem(null);
    setEditKey("");
    toast.success("用户密钥已更新");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "更新用户密钥失败");
  } finally {
    setItemPending(item.id, false);
  }
};
```

- [ ] **Step 8: 提交**

```bash
git add web/src/app/settings/components/user-keys-card.tsx
git commit -m "feat: 用户密钥管理界面支持生图限额设置和展示"
```

---

## 最终验证

- [ ] **Step 1: 构建前端**

```bash
cd /home/ubuntu/chatgpt2api/web && pnpm build
```

- [ ] **Step 2: 运行后端**

```bash
cd /home/ubuntu/chatgpt2api && python main.py
```

- [ ] **Step 3: 手动测试**

1. 管理员登录，创建一个访客 Key，设置生图限额为 2
2. 用该 Key 调用生图 API，验证计数递增
3. 生图达到 2 张后，验证 Key 自动禁用
4. 管理员编辑该 Key，重置计数并重新启用
5. 验证管理员 Key 不受限制

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: 完成 API Key 生图数量限制功能"
```
