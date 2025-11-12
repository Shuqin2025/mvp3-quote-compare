// frontend/public/export-xlsx.js
// 统一的 API Base 解析与 /v1 补全；对外只导出四个方法：
// getApiBase / imageProxy / exportToXlsxByItems / exportToXlsxByUrl

function readApiBaseFromPage() {
  try {
    const u = new URL(window.location.href);
    const qsApi = u.searchParams.get('api'); // ?api=...
    const meta = document.querySelector('meta[name="api-base"]')?.content || '';
    // 优先 URL，其次 meta
    const raw = (qsApi || meta || '').trim();
    return raw;
  } catch {
    return '';
  }
}

/** 规范化成形如 https://host[:port]/v1 */
function normalizeToV1(base) {
  // 空：走相对路径
  if (!base) return '/v1';

  // 去掉尾部斜杠
  let b = String(base).trim().replace(/\/+$/, '');

  // 已经包含 /v1 或 /v1/xxx，直接返回到 /v1 层级
  if (/\/v1($|\/)/i.test(b)) {
    // 统一成以 /v1 结尾
    b = b.replace(/\/v1(?:\/.*)?$/i, '/v1');
    return b;
  }
  // 没带 /v1，则补上
  return `${b}/v1`;
}

/** 获取最终 API Base（保证以 /v1 结尾；无尾斜杠） */
export function getApiBase() {
  const raw = readApiBaseFromPage();
  const v1 = normalizeToV1(raw);
  return v1.replace(/\/+$/, ''); // 去尾斜杠，形如 https://host/v1
}

/** 便捷：返回某个 /v1 子路径的完整 URL */
function v1url(pathname) {
  const base = getApiBase(); // 已是 .../v1
  const p = String(pathname || '').replace(/^\/+/, ''); // 去掉开头斜杠
  return `${base}/${p}`;
}

/** 图片代理：format = 'raw' | 'thumb'（示例），原图 URL 必须传 */
export function imageProxy(originalUrl, format = 'raw') {
  const url = new URL(v1url('image'));
  url.searchParams.set('format', String(format || 'raw'));
  url.searchParams.set('url', String(originalUrl || ''));
  return url.toString();
}

/** 由“已解析的 items”导出为 xlsx（前端 POST 结构化数据给网关） */
export async function exportToXlsxByItems(items, { filename = '产品数据导出.xlsx' } = {}) {
  const url = v1url('export-xlsx');
  const rs = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list: items || [], name: filename }),
  });
  if (!rs.ok) throw new Error(`导出失败：${rs.status} ${rs.statusText}`);

  // 后端返回的是二进制流（或直链）。这里以 blob 下载：
  const blob = await rs.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 由“目录 URL”让网关去抓取并生成 xlsx */
export async function exportToXlsxByUrl(catalogUrl, { limit = 50, withImages = true, filename = '商品数据导出.xlsx' } = {}) {
  const url = new URL(v1url('export-xlsx'));
  url.searchParams.set('url', String(catalogUrl || ''));
  url.searchParams.set('limit', String(limit || 50));
  url.searchParams.set('img', withImages ? '1' : '0');
  const rs = await fetch(url.toString(), { method: 'GET' });
  if (!rs.ok) throw new Error(`导出失败：${rs.status} ${rs.statusText}`);

  const blob = await rs.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
