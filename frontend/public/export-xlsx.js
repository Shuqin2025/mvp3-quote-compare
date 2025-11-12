/* eslint-disable */
//
// export-xlsx.js  —  统一网关工具 + 导出逻辑（支持多路回退）
//

/** 读取并规范化 apiBase（优先 ?api=..., 再 localStorage, 最后兜底） */
export function getApiBase() {
  try {
    const search = new URLSearchParams(location.search);
    const fromQuery = (search.get('api') || '').trim();
    const fromStore = (localStorage.getItem('api_base') || '').trim();
    const fallback = 'https://yunivera-gateway.onrender.com';
    const raw = fromQuery || fromStore || fallback;
    // 允许传进来完整的 https://xxx/v1 也允许只到域名
    return raw.replace(/\/+$/g, '');
  } catch (e) {
    return 'https://yunivera-gateway.onrender.com';
  }
}

/** 组装两个候选网关前缀：/v1/api 和 /v1 */
function apiCandidates(apiBase) {
  const base = apiBase.replace(/\/+$/g, '');
  return [`${base}/v1/api`, `${base}/v1`];
}

/** 组装请求 URL（会同时返回两条候选，调用方逐个尝试） */
function buildCandidates(apiBase, path, queryObj) {
  const qs = queryObj
    ? '?' + new URLSearchParams(queryObj).toString()
    : '';
  const paths = path.replace(/^\/+/, '');
  return apiCandidates(apiBase).map(p => `${p}/${paths}${qs}`);
}

/** 尝试顺序请求第一个可用的 URL（返回 Response） */
async function tryFetch(urls, init) {
  let lastErr;
  for (const u of urls) {
    try {
      const res = await fetch(u, init);
      // 某些平台 CORS 失败会直接 throw；这里能拿到就看状态码
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} @ ${u}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No candidate url works');
}

/** ---------- 图片代理 ---------- */

/** 生成图片代理 URL（多路回退，必要时可直接返回源图） */
export function imageProxy(originUrl, opts = {}) {
  const apiBase = getApiBase();
  const query = {
    format: (opts.format || 'raw'),
    url: originUrl || '',
  };
  const [u1, u2] = buildCandidates(apiBase, 'image', query);
  // 不直接 fetch，这里只返回 URL，交给 <img> 去加载。
  // 尝试优先 /v1/api/image；如果你更想兜底原图，可在 loadfail 时切换。
  return {
    primary: u1,
    fallback: u2,
    raw: originUrl || '',
  };
}

/** ---------- 导出（优先后端，失败前端兜底 CSV） ---------- */

function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = URL.createObjectURL(blob);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

/** 前端兜底：把 rows 导出为 CSV（Excel 可直接打开） */
function exportCsvFallback(filename, rows) {
  const escapeCell = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map(r => r.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
  downloadBlob(filename.replace(/\.xlsx$/i, '') + '.xlsx', blob);
}

/** 用 URL 让后端导出（失败则前端兜底） */
export async function exportToXlsxByUrl({ url, limit = 50, lang = 'zh' }, fallbackRows = null) {
  const apiBase = getApiBase();
  const body = { url, limit, lang };
  const headers = { 'Content-Type': 'application/json' };
  const candidates = buildCandidates(apiBase, 'export-xlsx', null);

  // 优先后端导出
  try {
    const res = await tryFetch(candidates, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers,
      body: JSON.stringify(body),
    });
    // 约定后端直接返回 .xlsx 二进制
    const blob = await res.blob();
    const file = (url || '').replace(/https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'export';
    downloadBlob(file + '.xlsx', blob);
    return { ok: true, via: 'backend' };
  } catch (e) {
    // 后端失败 → 前端兜底
    if (fallbackRows && Array.isArray(fallbackRows) && fallbackRows.length) {
      exportCsvFallback('export.xlsx', fallbackRows);
      return { ok: true, via: 'frontend-csv' };
    }
    throw e;
  }
}

/** 用 items 让后端导出（失败则前端兜底） */
export async function exportToXlsxByItems({ items = [], lang = 'zh' }) {
  const apiBase = getApiBase();
  const body = { items, lang };
  const headers = { 'Content-Type': 'application/json' };
  const candidates = buildCandidates(apiBase, 'export-xlsx', null);

  try {
    const res = await tryFetch(candidates, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers,
      body: JSON.stringify(body),
    });
    const blob = await res.blob();
    downloadBlob('export.xlsx', blob);
    return { ok: true, via: 'backend' };
  } catch (e) {
    // 前端兜底：把 items 映射成二维表
    const header = ['#', 'sku', 'img', 'title', 'desc', 'price', 'url'];
    const rows = [header];
    items.forEach((it, i) => {
      rows.push([
        i + 1,
        it.sku || '',
        it.img || '',
        it.title || '',
        it.desc || '',
        it.price || '',
        it.url || '',
      ]);
    });
    exportCsvFallback('export.xlsx', rows);
    return { ok: true, via: 'frontend-csv' };
  }
}

/** ---------- 目录抓取（供 UI 使用） ---------- */

/** 通过网关 GET 解析目录（多路回退） */
export async function parseCatalogByUrl({ url, limit = 50, lang = 'zh' }) {
  const apiBase = getApiBase();
  // 后端支持 GET /catalog/parse?url=&limit=&lang=
  const candidates = buildCandidates(apiBase, 'catalog/parse', { url, limit, lang });
  const res = await tryFetch(candidates, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
  });
  return res.json(); // 约定返回 {ok, items|rows|list, ...}
}

/** 公开工具，UI 可能用到 */
export const __internal = { apiCandidates, buildCandidates, tryFetch, downloadBlob, exportCsvFallback };
