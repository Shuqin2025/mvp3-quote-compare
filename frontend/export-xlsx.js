// /export-xlsx.js
// Four public exports only: getApiBase / imageProxy / exportToXlsxByItems / exportToXlsxByUrl

export function getApiBase() {
  try {
    const u = new URL(window.location.href);
    const qsApi = u.searchParams.get('api');
    const meta = document.querySelector('meta[name="api-base"]')?.content || '';
    const base = (qsApi || meta || '/v1/api');
    return String(base).replace(/\/+$/, '');
  } catch {
    return '/v1/api';
  }
}

function getV1Root() {
  const api = getApiBase();
  return api.replace(/\/api\/?$/, '/').replace(/\/+$/, '/');
}

export function imageProxy(originalUrl, format = 'raw') {
  const V1 = getV1Root();
  return `${V1}image?format=${encodeURIComponent(format)}&url=${encodeURIComponent(originalUrl)}`;
}

export async function exportToXlsxByUrl({ url, limit = 50, withImages = true, filename = '商品数据导出.xlsx' } = {}) {
  if (!url) throw new Error('exportToXlsxByUrl: 缺少 url');
  const V1 = getV1Root();
  const res = await fetch(`${V1}export-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit, withImages }),
  });
  if (!res.ok) throw new Error(`导出失败(${res.status})：${await res.text().catch(()=> '')}`);
  const blob = await res.blob();
  downloadBlobAs(blob, filename);
}

export async function exportToXlsxByItems({ items, withImages = true, filename = '商品数据导出.xlsx' } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('exportToXlsxByItems: items 为空');
  const V1 = getV1Root();
  const res = await fetch(`${V1}export-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, withImages }),
  });
  if (!res.ok) throw new Error(`导出失败(${res.status})：${await res.text().catch(()=> '')}`);
  const blob = await res.blob();
  downloadBlobAs(blob, filename);
}

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
