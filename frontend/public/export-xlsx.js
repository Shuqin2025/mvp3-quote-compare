// frontend/public/export-xlsx.js
// 统一导出的小工具：获取 API Base、构造 URL、图片代理、导出 xlsx、目录抓取等。

/** 读取 ?api= 或 <meta name="api-base">；若都没有，默认同域 */
export function getApiBase() {
  try {
    const u = new URL(window.location.href);
    const override = u.searchParams.get('api') || '';
    const meta = document.querySelector('meta[name="api-base"]')?.content || '';
    const base = (override || meta || '').trim();
    if (!base) return ''; // 同域
    return base;
  } catch (_) {
    return '';
  }
}

/** 规范化拼接：确保 base + '/v1/' + endpoint 之间只有一个斜杠 */
function joinApi(base, endpoint) {
  const b = (base || '').replace(/\/+$/g, '');      // 去掉 base 尾部斜杠
  const ep = String(endpoint || '').replace(/^\/+/g, ''); // 去掉 endpoint 头部斜杠
  // 强制加 /v1/。如果 base 已经是 /v1 结尾也无妨（上面已去重）
  return `${b}/v1/${ep}`;
}

/** 构造带查询串的 API URL */
function buildApiUrl(base, endpoint, params = {}) {
  const url = new URL(joinApi(base, endpoint));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.toString();
}

/** 图片代理：默认 raw（透传），也可 'webp' 等 */
export function imageProxy(originalUrl, format = 'raw') {
  const base = getApiBase();
  return buildApiUrl(base, 'image', { format, url: originalUrl });
}

/** 从接口按 URL 抓取目录（后端：GET /v1/catalog/parse?url=...&limit=...） */
export async function fetchCatalogByUrl(listUrl, limit = 50) {
  const base = getApiBase();
  const api = buildApiUrl(base, 'catalog/parse', { url: listUrl, limit });
  const res = await fetch(api, { credentials: 'omit' });
  if (!res.ok) throw new Error(`抓取失败：${res.status} ${res.statusText}`);
  const json = await res.json();
  return json;
}

/** 将列表导出为 xlsx（后端：POST /v1/export-xlsx，body: {items, filename}） */
export async function exportToXlsxByItems(items = [], filename = '产品数据导出.xlsx') {
  const base = getApiBase();
  const api = buildApiUrl(base, 'export-xlsx');
  const res = await fetch(api, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items, filename })
  });
  if (!res.ok) throw new Error(`导出失败：${res.status} ${res.statusText}`);
  // 返回文件流
  const blob = await res.blob();
  return blob;
}

/** 直接按 URL 让后端抓取并导出 xlsx（后端：GET /v1/export-xlsx?url=...&limit=...） */
export async function exportToXlsxByUrl(listUrl, limit = 50, filename = '产品数据导出.xlsx') {
  const base = getApiBase();
  const api = buildApiUrl(base, 'export-xlsx', { url: listUrl, limit, filename });
  const res = await fetch(api);
  if (!res.ok) throw new Error(`导出失败：${res.status} ${res.statusText}`);
  const blob = await res.blob();
  return blob;
}

/** 小工具：把一条 item 映射成渲染用的行数据（容错空字段） */
export function mapItemToRow(item = {}) {
  return {
    sku: item.sku || '',
    title: item.title || item.desc || '',
    price: item.price || '',
    url: item.url || '#',
    img: item.img || ''
  };
}
