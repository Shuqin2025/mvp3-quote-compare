// frontend/export-xlsx.js  — unified caller for the gateway
// Exposes two helpers and also binds them to window for plain <script> usage:
//   - exportToXlsx(items, {withImages, filename})
//   - exportToXlsxByUrl(url, {limit, withImages, filename})
//
// Why this file?
// - Your backend routes live under /v1/api/* (e.g. /v1/api/export-xlsx).
//   The previous JS pointed at /v1/export-xlsx, which produced "Cannot GET /v1/export-xlsx".
// - This version always talks to /v1/api/export-xlsx and works with BOTH
//   POST (items array) and GET (?url=...&limit=...).

function getApiBase () {
  try {
    // Priority 1: URL param ?api=...
    const u = new URL(typeof location !== 'undefined' ? location.href : 'http://local');
    const qApi = u.searchParams.get('api');

    // Priority 2: <meta name="api-base">
    const meta = (typeof document !== 'undefined')
      ? document.querySelector('meta[name="api-base"]')
      : null;
    const mApi = meta?.content;

    // Priority 3: window.API_BASE or Vite env
    const env = (typeof window !== 'undefined' && window.API_BASE)
             || (typeof import !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE);

    // Priority 4: same-origin fallback '/v1/api'
    const fallback = (typeof location !== 'undefined' && location.origin)
      ? location.origin.replace(/\/+$/,'') + '/v1/api'
      : '/v1/api';

    const base = (qApi || mApi || env || fallback);
    return String(base).replace(/\/+$/,'');
  } catch {
    return '/v1/api';
  }
}
return '/v1/api';
}

function safeFilename(name, def = 'products.xlsx') {
  const n = String(name || '').trim();
  if (!n) return def;
  return n.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ');
}

function triggerDownload(blob, filename = 'products.xlsx') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export already-parsed items (array of { sku,title,url,img,desc,moq,price })
 * via POST -> /v1/api/export-xlsx
 */
export async function exportToXlsx(items, opts = {}) {
  const api = getApiBase();
  const { withImages = true, filename = '产品数据.xlsx' } = opts;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('没有可导出的数据');
  }
  const res = await fetch(`${api}/export-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, withImages })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`导出失败 (${res.status}) ${text}`);
  }
  const blob = await res.blob();
  triggerDownload(blob, filename);
  return true;
}

/**
 * Export by giving a catalog URL.
 * GET -> /v1/api/export-xlsx?url=...&limit=50&withImages=true
 */
export async function exportToXlsxByUrl(url, opts = {}) {
  const api = getApiBase();
  const { limit = 50, withImages = true, filename = '产品数据.xlsx' } = opts;
  if (!url || typeof url !== 'string') throw new Error('缺少目录链接 url');
  const qs = new URLSearchParams({
    url,
    limit: String(limit),
    withImages: String(withImages)
  });
  const res = await fetch(`${api}/export-xlsx?${qs.toString()}`, {
    method: 'GET'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`导出失败 (${res.status}) ${text}`);
  }
  const blob = await res.blob();
  triggerDownload(blob, filename);
  return true;
}

// Bind to window for <script> usage
if (typeof window !== 'undefined') {
  window.exportToXlsx = exportToXlsx;
  window.exportToXlsxByUrl = exportToXlsxByUrl;
}

export default { exportToXlsx, exportToXlsxByUrl };
