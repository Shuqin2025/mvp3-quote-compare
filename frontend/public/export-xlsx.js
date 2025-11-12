// --- export-xlsx.js --------------------------------------------------------
// 统一导出：getApiBase / imageProxy / exportToXlsxByItems / exportToXlsxByUrl
// 关键修复：任何 URL 拼接都使用 joinUrl 保证单个斜杠，避免 ...onrender.comcatalog 之类错误。

/** 将 base 与 path 安全拼接：永远只有一个斜杠 */
function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/g, '');
  const p = String(path || '').replace(/^\/+/g, '');
  return `${b}/${p}`;
}

/** 统一把相对 v1 路径补齐为 v1/* */
function withV1(path) {
  const p = String(path || '');
  if (/^v1\//i.test(p)) return p;
  return `v1/${p.replace(/^\/+/, '')}`;
}

/** 解析 URLSearchParams */
function getSearchParams() {
  try { return new URLSearchParams(location.search); }
  catch { return new URLSearchParams(); }
}

/** 读取 <meta name="api-base"> */
function getMetaApiBase() {
  const meta = document.querySelector('meta[name="api-base"]');
  return meta?.content?.trim() || '';
}

/** 计算 API Base：优先 ?api= ，然后 <meta> ，最后空串（同源） */
export function getApiBase() {
  const qs = getSearchParams();
  const fromQuery = (qs.get('api') || '').trim();           // 例如 https://yunivera-gateway.onrender.com
  const fromMeta  = getMetaApiBase();                        // 例如 https://yunivera-gateway.onrender.com/v1/api
  let base = fromQuery || fromMeta || '';

  // 如果 meta 里给到的是带 /v1/api 的“完全前缀”，也没关系，后面统一按 joinUrl 处理
  // 确保是绝对或相对都能用：空串意味着走同源
  return base;
}

/** 生成完整 API URL（自动补 v1/ 前缀、并安全拼接斜杠） */
function apiUrl(path) {
  const base = getApiBase();
  return joinUrl(base || '', withV1(path));
}

/** 图片代理地址（format: raw | webp | ...） */
export function imageProxy(originalUrl, format = 'raw') {
  const u = apiUrl('image');
  const q = `format=${encodeURIComponent(format)}&url=${encodeURIComponent(originalUrl || '')}`;
  return `${u}?${q}`;
}

/** 由商品条目数组导出（POST JSON -> blob 下载） */
export async function exportToXlsxByItems(items = [], filename = '商品数据导出.xlsx') {
  const u = apiUrl('export-xlsx');
  const res = await fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) throw new Error(`导出失败：${res.status} ${res.statusText}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/** 由目录 URL 直接导出（GET 触发下载） */
export async function exportToXlsxByUrl(listUrl, limit = 50, filename = '商品数据导出.xlsx') {
  const u = apiUrl('export-xlsx');
  const qs = new URLSearchParams({ url: String(listUrl || ''), limit: String(limit || 50) });
  const res = await fetch(`${u}?${qs.toString()}`, { method: 'GET' });
  if (!res.ok) throw new Error(`导出失败：${res.status} ${res.statusText}`);

  // 有些后端会直接以 attachment 响应；兜底为 blob 下载
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// 供其它模块使用（少量工具）
export const _util = { joinUrl, withV1, apiUrl };
