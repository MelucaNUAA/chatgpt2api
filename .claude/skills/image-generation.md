---
name: image-generation
description: 使用本项目的 OpenAI 兼容 API 生成图片。支持文生图和图生图，适用于任意 LLM 调用。
---

# 图片生成 Skill

当用户需要生成图片、绘制图像、制作海报、创作插画时，使用本项目的 OpenAI 兼容图片生成 API。

## API 端点

| 接口 | 路径 | 用途 |
|------|------|------|
| 文生图 | `POST /v1/images/generations` | 根据文字描述生成图片 |
| 图生图 | `POST /v1/images/edits` | 基于已有图片进行编辑 |

**Base URL**: `https://image.perfectisshit.com`

**认证**: `Authorization: Bearer <API_KEY>`

## 文生图请求

### 请求格式

```bash
curl -X POST "https://image.perfectisshit.com/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "图片描述文本",
    "n": 1,
    "size": "1:1",
    "response_format": "url",
    "stream": false
  }'
```

### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | 是 | - | 图片描述，越详细效果越好 |
| `model` | string | 否 | `"gpt-image-2"` | 模型名称，可选 `gpt-image-2` 或 `codex-gpt-image-2` |
| `n` | int | 否 | `1` | 生成数量，范围 1-4 |
| `size` | string | 否 | `null` | 图片比例，见下方比例表 |
| `response_format` | string | 否 | `"b64_json"` | 响应格式：`b64_json` 或 `url` |
| `stream` | bool | 否 | `false` | 是否流式返回（SSE） |

### 图片比例（size 参数）

| 值 | 含义 | 适用场景 |
|----|------|----------|
| `1:1` | 正方形 | 头像、图标、社交媒体 |
| `16:9` | 横屏宽画幅 | 风景、海报、横幅 |
| `9:16` | 竖屏 | 手机壁纸、故事封面 |
| `4:3` | 经典比例 | 通用照片 |
| `3:4` | 纵向 | 人物肖像、杂志封面 |
| `null` | 不指定 | 让模型自行决定 |

### 响应格式

**非流式响应**（`response_format: "url"`）：

```json
{
  "created": 1715000000,
  "data": [
    {
      "url": "https://image.perfectisshit.com/images/2026/05/10/xxx.png",
      "revised_prompt": "模型优化后的提示词"
    }
  ]
}
```

**非流式响应**（`response_format: "b64_json"`）：

```json
{
  "created": 1715000000,
  "data": [
    {
      "b64_json": "<base64编码的图片数据>",
      "url": "https://image.perfectisshit.com/images/2026/05/10/xxx.png",
      "revised_prompt": "模型优化后的提示词"
    }
  ]
}
```

**流式响应**（`stream: true`）：

以 `text/event-stream` 返回，每条 SSE 事件包含进度信息：

```
data: {"object":"image.generation.chunk","progress_text":"正在生成...","data":[]}

data: {"object":"image.generation.result","data":[{"url":"..."}]}

data: [DONE]
```

## 图生图请求

### 请求格式

```bash
curl -X POST "https://image.perfectisshit.com/v1/images/edits" \
  -H "Authorization: Bearer $API_KEY" \
  -F "image=@/path/to/image.png" \
  -F "prompt=将这张图片改成油画风格" \
  -F "model=gpt-image-2" \
  -F "n=1" \
  -F "response_format=url"
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | file | 是 | 原始图片文件，可上传多张 |
| `prompt` | string | 是 | 编辑指令 |
| `model` | string | 否 | 默认 `gpt-image-2` |
| `n` | int | 否 | 生成数量 1-4 |
| `size` | string | 否 | 图片比例 |
| `response_format` | string | 否 | `b64_json` 或 `url` |

响应格式与文生图一致。

## Prompt 编写指南

好的 prompt 应包含：

1. **主体**: 画面中心是什么（人物、物体、场景）
2. **风格**: 艺术风格（写实、动漫、油画、水彩、3D渲染等）
3. **细节**: 颜色、光线、构图、背景
4. **氛围**: 情绪、时间、天气

**示例 prompt**：

```
一只橘色猫咪坐在窗台上，窗外是下雨的城市夜景，
温暖的室内灯光，水彩画风格，柔和的色调，治愈系插画
```

```
赛博朋克风格的未来城市，霓虹灯倒映在雨水中，
一个人撑着透明雨伞走在街上，电影感构图，8K画质
```

## 错误处理

| HTTP 状态码 | 含义 | 处理方式 |
|-------------|------|----------|
| 401 | 认证失败 | 检查 API Key |
| 400 | 请求参数错误 | 检查 prompt 或 model 是否合法 |
| 429 | 请求过于频繁 | 稍后重试 |
| 500 | 服务器内部错误 | 联系管理员 |

## 使用示例

### Python（requests 库）

```python
import requests

BASE_URL = "https://image.perfectisshit.com"
API_KEY = "your_api_key_here"

resp = requests.post(
    f"{BASE_URL}/v1/images/generations",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "model": "gpt-image-2",
        "prompt": "一只可爱的柴犬戴着墨镜，坐在沙滩上，日落背景",
        "n": 1,
        "size": "16:9",
        "response_format": "url"
    }
)

result = resp.json()
image_url = result["data"][0]["url"]
print(f"图片地址: {image_url}")
```

### Node.js（fetch）

```javascript
const BASE_URL = "https://image.perfectisshit.com";
const API_KEY = "your_api_key_here";

const resp = await fetch(`${BASE_URL}/v1/images/generations`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-image-2",
    prompt: "水墨画风格的山水，远处有飞鸟，意境悠远",
    n: 1,
    size: "16:9",
    response_format: "url"
  })
});

const result = await resp.json();
console.log("图片地址:", result.data[0].url);
```

### 保存 base64 图片

```python
import base64

# 当 response_format 为 b64_json 时
b64_data = result["data"][0]["b64_json"]
with open("output.png", "wb") as f:
    f.write(base64.b64decode(b64_data))
```

## 注意事项

- `response_format` 建议使用 `"url"`，避免返回过大的 base64 数据
- 生成时间通常需要 10-30 秒，请设置合理的请求超时
- `n` 参数最多为 4，一次请求最多生成 4 张图片
- 图片会自动保存在服务器上，默认保留 30 天
