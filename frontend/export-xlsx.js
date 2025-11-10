// frontend/export-xlsx.js
// 统一：读取 <meta name="api-base">，并做智能兼容：
// - catalog / health 继续用 API_BASE（可能是 /v1/api 或 /v1）
// - image / export-xlsx 强制使用 V1_BASE（把 /v1/api 自动降级成 /v1/）

function getApiBase() {
  // 1) meta 标签优先
  const meta = document.querySelector('meta[name="api-base"]');
  const fromMeta = meta?.getAttribute('content')?.trim();
  // 2) 兜底：window.API_BASE 或同源 /v1
  const fallback = window.API_BASE || `${location.origin}/v1`;
  return (fromMeta || fallback).replace(/\/+$/, ''); // 去尾斜杠
}

const API_BASE = getApiBase();
// 把 “…/v1/api(可带/结尾)” 兼容降级为 “…/v1/”，其余保持原样
const V1_BASE = API_BASE.replace(/\/api\/?$/, '/')  // …/v1/api → …/v1/
                      .replace(/\/+$/, '/')         // 确保以单个 / 结尾
                      .replace(/\/$/, '/');         // 保留一个 /

/** 工具：下载 Blob 为文件 */
async function downloadBlobAs(blob, filename = '导出.xlsx') {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** 图片代理：默认 raw */
export function imageProxy(originalUrl, format = 'raw') {
  return `${V1_BASE}image?format=${encodeURIComponent(format)}&url=${encodeURIComponent(originalUrl)}`;
}

/** 通过“列表页 URL”发起导出（后端自行抓取解析） */
export async function exportToXlsxByUrl({
  url,
  limit = 50,
  withImages = true,
  filename = '商品数据导出.xlsx',
} = {}) {
  if (!url) throw new Error('exportToXlsxByUrl: 缺少 url');

  const res = await fetch(`${V1_BASE}export-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit, withImages }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`导出失败(${res.status}): ${text}`);
  }
  const blob = await res.blob();
  await downloadBlobAs(blob, filename);
}

/** 通过“已结构化 items”发起导出（前端已拿到 rows 的情况） */
export async function exportToXlsxByItems({
  items,
  withImages = true,
  filename = '商品数据导出.xlsx',
} = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('exportToXlsxByItems: items 为空');
  }

  const res = await fetch(`${V1_BASE}export-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, withImages }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`导出失败(${res.status}): ${text}`);
  }
  const blob = await res.blob();
  await downloadBlobAs(blob, filename);
}

// 便于其它模块使用基础地址（如需要）
export { API_BASE, V1_BASE };
