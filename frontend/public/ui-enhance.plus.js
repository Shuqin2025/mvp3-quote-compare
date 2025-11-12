// frontend/public/ui-enhance.plus.js
// 统一入口（页面脚本只引用这一份）

/* ---------------- 工具：API 基址 / 图片代理 ---------------- */
function readApiBase() {
  // 先读 ?api= 覆盖；再读 <meta name="api-base">；最后兜底 '/v1'
  try {
    const u = new URL(window.location.href);
    const qp = u.searchParams.get('api');
    const meta = document.querySelector('meta[name="api-base"]')?.content || '';
    const base = (qp || meta || '/v1').replace(/\/+$/, ''); // 去尾斜杠
    return base;
  } catch {
    return '/v1';
  }
}
const API_BASE = readApiBase();

export function imageProxy(originalUrl, format = 'raw') {
  // 仅负责组合代理地址；后端未放行时，返回的 URL 访问会 404，但不会影响页面
  const src = encodeURIComponent(originalUrl || '');
  const fmt = encodeURIComponent(format || 'raw');
  return `${API_BASE}/image?format=${fmt}&url=${src}`;
}

/* ---------------- DOM 引用 ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const elUrl = $('#txtUrl');
const elLimit = $('#txtLimit');
const elTbl = $('#tbl tbody');
const elStatus = $('#status');
const elOk = $('#okbar');

/* ---------------- 渲染与状态 ---------------- */
function setStatus(type, msg) {
  elStatus.className = 'status ' + (type || '');
  elStatus.textContent = msg;
}
function clearTable() {
  elTbl.innerHTML = '';
  setStatus('', '已清空');
  elOk.style.display = 'none';
}
function renderRows(rows = []) {
  const frag = document.createDocumentFragment();
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.sku || ''}</td>
      <td>${r.img ? `<img class="img" src="${imageProxy(r.img, 'raw')}" alt="">` : ''}</td>
      <td>${r.title || ''}${r.desc ? `<div class="muted">${r.desc}</div>` : ''}</td>
      <td>${r.price || ''}</td>
      <td>${r.url ? `<a class="link" href="${r.url}" target="_blank">打开</a>` : ''}</td>
    `;
    frag.appendChild(tr);
  });
  elTbl.innerHTML = '';
  elTbl.appendChild(frag);
}

/* ---------------- 抓取目录 ---------------- */
async function fetchCatalog() {
  const url = String(elUrl.value || '').trim();
  const limit = Math.max(1, Number(elLimit.value || 50)) || 50;

  if (!url) {
    setStatus('warn', '请先输入目录链接');
    return;
  }

  setStatus('', '抓取中...');
  try {
    const api = `${API_BASE}/catalog/parse?url=${encodeURIComponent(url)}&limit=${limit}`;
    const rs = await fetch(api, { method: 'GET' });
    if (!rs.ok) throw new Error(`HTTP ${rs.status}`);
    const data = await rs.json();

    const rows = data?.rows || data?.list || data?.items || [];
    renderRows(rows);
    setStatus('ok', `抓取完成：共 ${rows.length} 条`);
    elOk.style.display = '';
  } catch (e) {
    setStatus('err', `抓取失败：${e.message || e}`);
    console.error(e);
  }
}

/* ---------------- 导出（就地行 / 后端直连） ---------------- */
async function exportXlsx(mode = 'items') {
  // 动态 import，按需加载导出模块
  const modPath = (window.UI_ENHANCE?.exportModule) || './export-xlsx.js';
  const { exportToXlsxByItems, exportToXlsxByUrl } = await import(modPath);

  try {
    if (mode === 'url') {
      // 后端直连：把目录链接交给网关导出（后端未放 /v1/export-xlsx 前，会 404）
      const url = String(elUrl.value || '').trim();
      const limit = Math.max(1, Number(elLimit.value || 50)) || 50;
      if (!url) throw new Error('缺少目录链接');
      await exportToXlsxByUrl(`${API_BASE}/catalog/parse?url=${encodeURIComponent(url)}&limit=${limit}`, {
        filename: '商品数据导出(直连).xlsx'
      });
    } else {
      // 就地行导出：从页面读取 rows 结构（最稳）
      const rows = $$('#tbl tbody tr').map(tr => {
        const tds = tr.children;
        return {
          idx: tds[0]?.textContent?.trim(),
          sku: tds[1]?.textContent?.trim(),
          img: $('img', tds[2])?.getAttribute('src') || '',
          title: tds[3]?.firstChild?.textContent?.trim() || tds[3]?.textContent?.trim() || '',
          price: tds[4]?.textContent?.trim(),
          url: $('a', tds[5])?.getAttribute('href') || ''
        };
      });
      await exportToXlsxByItems(rows, {
        filename: '商品数据导出(就地).xlsx'
      });
    }
    setStatus('ok', '导出任务已触发');
  } catch (e) {
    setStatus('err', `导出失败：${e.message || e}`);
    console.error(e);
  }
}

/* ---------------- 绑定事件 ---------------- */
$('#btnFetch')?.addEventListener('click', fetchCatalog);
$('#btnClear')?.addEventListener('click', clearTable);
$('#btnExport')?.addEventListener('click', () => exportXlsx('items'));

// 支持回车即抓取
elUrl?.addEventListener('keydown', e => { if (e.key === 'Enter') fetchCatalog(); });

/* ---------------- 首次载入：如果地址栏带 ?url= 就自动抓取 ---------------- */
try {
  const u = new URL(location.href);
  const urlInQuery = u.searchParams.get('url');
  const limitInQuery = u.searchParams.get('limit');
  if (urlInQuery) {
    elUrl.value = urlInQuery;
    if (limitInQuery) elLimit.value = limitInQuery;
    fetchCatalog();
  }
} catch {}
