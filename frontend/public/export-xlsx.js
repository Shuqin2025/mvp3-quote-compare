// frontend/public/export-xlsx.js
// 公开四个入口：getApiBase / imageProxy / exportToXlsxByItems / exportToXlsxByUrl
// 重要：本版不再把 “…/v1/api” 规范化为 “…/v1/”，统一直接走 API_BASE 下的路径

/** 读取 API Base（?api 覆盖 > <meta name="api-base"> > '/v1/api'） */
export function getApiBase() {
  try {
    const u = new URL(window.location.href);
    const qsApi = u.searchParams.get('api');
    const meta = document.querySelector('meta[name="api-base"]')?.content || '';
    const base = (qsApi || meta || '/v1/api');
    return String(base).replace(/\/+$/, ''); // 去尾 /
  } catch {
    return '/v1/api';
  }
}

// 小工具：安全拼接
function join(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

/** 统一图片代理：format 可为 raw/base64 */
export function imageProxy(originalUrl, format = 'raw') {
  const API = getApiBase();
  const url = new URL(join(API, 'image'), window.location.origin);
  url.searchParams.set('format', format);
  url.searchParams.set('url', originalUrl);
  return url.toString();
}

/** 通过“目录页 URL”发起导出（后端直连抓取） */
export async function exportToXlsxByUrl({
  url, limit = 50, withImages = true, filename = '商品数据导出.xlsx',
} = {}) {
  if (!url) throw new Error('exportToXlsxByUrl: 缺少 url');
  const API = getApiBase();
  const res = await fetch(join(API, 'export-xlsx'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit, withImages }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`导出失败(${res.status})：${txt}`);
  }
  const blob = await res.blob();
  downloadBlobAs(blob, filename);
}

/** 通过“已结构化 items”发起导出（前端本地行） */
export async function exportToXlsxByItems({
  items, withImages = true, filename = '商品数据导出.xlsx',
} = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('exportToXlsxByItems: items 为空');
  }
  const API = getApiBase();
  const res = await fetch(join(API, 'export-xlsx'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, withImages }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`导出失败(${res.status})：${txt}`);
  }
  const blob = await res.blob();
  downloadBlobAs(blob, filename);
}

// ---------- utils ----------
function downloadBlobAs(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
