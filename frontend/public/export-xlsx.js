// frontend/public/export-xlsx.js
// 公开四个入口：getApiBase / imageProxy / exportToXlsxByItems / exportToXlsxByUrl
// 规范：
// - 目录/健康：由其它模块用 API_BASE（通常是 /v1/api）
// - 图片代理/导出：强制走 V1_BASE（把 “…/v1/api” 自动降为 “…/v1”）

/** 读取 API Base（?api 覆盖 > <meta name="api-base"> > '/v1/api'） */
export function getApiBase() {
  try {
    const u = new URL(window.location.href);
    const fromQs = u.searchParams.get('api');
    const fromMeta = document.querySelector('meta[name="api-base"]')?.content || '';
    const base = (fromQs || fromMeta || '/v1/api').trim();
    return String(base).replace(/\/+$/, ''); // 去尾斜杠
  } catch {
    return '/v1/api';
  }
}

/** 内部：把 “…/v1/api(/)?” 兼容降为 “…/v1” */
function getV1Base() {
  const api = getApiBase();
  return api.replace(/\/api\/?$/, ''); // 末尾 /api -> 空
}

/** 安全拼接 URL 片段 */
function join(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

/** 统一图片代理：返回可直接用于 <img src=""> 的 URL；format: 'raw' | 'base64' */
export function imageProxy(originalUrl, format = 'raw') {
  const V1 = getV1Base();
  const url = new URL(join(V1, 'image'), window.location.origin);
  url.searchParams.set('format', format);
  url.searchParams.set('url', originalUrl);
  return url.toString();
}

/** 通过“目录页 URL”发起导出（后端直连抓取） */
export async function exportToXlsxByUrl({
  url,
  limit = 50,
  withImages = true,
  filename = '商品数据导出.xlsx',
} = {}) {
  if (!url) throw new Error('exportToXlsxByUrl: 缺少 url');
  const V1 = getV1Base();
  const res = await fetch(join(V1, 'export-xlsx'), {
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
  items,
  withImages = true,
  filename = '商品数据导出.xlsx',
} = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('exportToXlsxByItems: items 为空');
  }
  const V1 = getV1Base();
  const res = await fetch(join(V1, 'export-xlsx'), {
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

/** 下载 Blob 为文件 */
function downloadBlobAs(blob, filename = '导出.xlsx') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
