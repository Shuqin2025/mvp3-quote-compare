// frontend/public/export-xlsx.js
// 只暴露：getApiBase / imageProxy / exportToXlsxByItems / exportToXlsxByUrl

export function getApiBase() {
  // 1) URL ?api= 覆盖  2) <meta name="api-base">  3) 默认 /v1/api
  try {
    const u = new URL(window.location.href);
    const qsApi = u.searchParams.get('api');
    if (qsApi && qsApi.trim()) return qsApi.trim().replace(/\/+$/, '');
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.content) return String(meta.content).trim().replace(/\/+$/, '');
  } catch {}
  return '/v1/api';
}

// 统一的图片代理（raw/thumb等由后端决定）
export function imageProxy(originalUrl, format = 'raw') {
  const base = getApiBase();
  const u = new URL(`${base}/image`, window.location.origin);
  u.searchParams.set('format', format);
  u.searchParams.set('url', originalUrl || '');
  return u.toString();
}

// 由后端直连导出（给“导出 Excel（后端直连）”按钮）
export async function exportToXlsxByUrl(catalogUrl, { limit = 50, filename = '产品数据导出.xlsx' } = {}) {
  if (!catalogUrl) throw new Error('exportToXlsxByUrl: 缺少 catalogUrl');

  const base = getApiBase();
  const url = new URL(`${base}/export-xlsx`, window.location.origin);
  url.searchParams.set('url', catalogUrl);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('ts', String(Date.now()));

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`导出失败：${res.status} ${res.statusText}`);

  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// 由前端已有行就地导出（给“导出 Excel（就地行）”按钮）
export async function exportToXlsxByItems(rows = [], { filename = '产品数据导出.xlsx' } = {}) {
  const base = getApiBase();
  const url = new URL(`${base}/export-xlsx/by-items`, window.location.origin);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows })
  });

  if (!res.ok) throw new Error(`导出失败：${res.status} ${res.statusText}`);

  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}
