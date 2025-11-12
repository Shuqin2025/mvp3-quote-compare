// frontend/public/export-xlsx.js
// 目的：把 API 基址解析做“多来源、可容错、强规范化”
// 结论：最终可用的基址（V1_BASE）必定以 “…/v1” 结尾；
//       如果你给的是 “…/v1/api”，会被自动降级成 “…/v1”。

/** 读取 <meta name="api-base">、URL ?api=、或兜底同源，得到原始 base（可能没有 /v1） */
function readRawBase() {
  // 1) URL ?api=
  try {
    const u = new URL(window.location.href);
    const fromQuery = (u.searchParams.get('api') || '').trim();
    if (fromQuery) return fromQuery;
  } catch {}

  // 2) <meta name="api-base">
  try {
    const meta = document.querySelector('meta[name="api-base"]');
    const fromMeta = meta?.getAttribute('content')?.trim();
    if (fromMeta) return fromMeta;
  } catch {}

  // 3) 兜底：同源（仅用于本地/同源部署时）
  return `${location.origin}`;
}

/** 去掉多余斜杠 */
function trimSlashes(s) {
  return String(s || '').replace(/\/+$/, '');
}

/** 统一把 base 规范到 “…/v1” */
function toV1Base(rawBase) {
  let b = trimSlashes(rawBase);

  // 允许直接给网关根，如：https://yunivera-gateway.onrender.com
  // 允许给含 /v1 或 /v1/ 结尾
  // 允许给含 /v1/api 或 /v1/api/ 结尾（自动降级到 /v1）
  if (/\/v1\/?$/i.test(b)) {
    return b + '';
  }
  if (/\/v1\/api\/?$/i.test(b)) {
    return b.replace(/\/api\/?$/i, '');
  }

  // 都不是：自动补一个 /v1
  return b + '/v1';
}

/** 对外暴露：返回“…/v1”（不带尾斜杠） */
export function getApiBase() {
  return trimSlashes(toV1Base(readRawBase()));
}

/** 便捷常量：以 “…/v1” 为准（不带尾斜杠） */
const V1_BASE = getApiBase();

/** 小工具：发起 GET，返回 JSON */
async function getJSON(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`请求失败(${res.status}): ${text || url}`);
  }
  return res.json().catch(() => ({}));
}

/** 小工具：下载 Blob 为文件 */
async function downloadBlobAs(blob, filename = '导出.xlsx') {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename || '导出.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** 图片代理：默认 raw 格式 */
export function imageProxy(originalUrl, format = 'raw') {
  const qs = new URLSearchParams({
    format: String(format || 'raw'),
    url: String(originalUrl || ''),
  });
  // 强制走 /v1/image
  return `${V1_BASE}/image?${qs.toString()}`;
}

/** 目录解析（可选：供页面直接用；也便于你本地调试） */
export async function parseCatalog(url, limit = 50) {
  const qs = new URLSearchParams({ url: String(url || ''), limit: String(limit || 50) });
  // 强制走 /v1/catalog/parse
  return getJSON(`${V1_BASE}/catalog/parse?${qs.toString()}`);
}

/** 由 URL 让网关直连抓取并生成 xlsx（带图） */
export async function exportToXlsxByUrl({
  url,
  limit = 50,
  withImages = true,
  filename = '商品数据导出.xlsx',
} = {}) {
  if (!url) throw new Error('exportToXlsxByUrl: 缺少 url');

  const res = await fetch(`${V1_BASE}/export-xlsx`, {
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

/** 由前端表格行导出 xlsx（带图） */
export async function exportToXlsxByItems({
  items = [],
  withImages = true,
  filename = '商品数据导出.xlsx',
} = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('exportToXlsxByItems: items 为空');
  }

  const res = await fetch(`${V1_BASE}/export-xlsx`, {
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

// 便于其它模块需要时获取已规范化的根
export { V1_BASE };
