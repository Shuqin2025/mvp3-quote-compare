// /frontend/public/ui-enhance.plus.js
// 极简 + 可选增强开关版（不直拼 /v1/*，统一走 export-xlsx.js 暴露的方法）

// ------- 小工具：读取开关 / 动态 import / 轻提示 -------
const qs = new URLSearchParams(location.search);
const CFG = {
  // 开启增强的三种方式：?enhance=1；<meta name="ui-enhance" content="on">；window.UI_ENHANCE = { enhance:true }
  enhance:
    qs.get('enhance') === '1' ||
    (document.querySelector('meta[name="ui-enhance"]')?.content || '').toLowerCase() === 'on' ||
    (typeof window !== 'undefined' && window.UI_ENHANCE && window.UI_ENHANCE.enhance === true),

  // export-xlsx.js 的候选相对路径（从 frontend/public/ 出发）
  exportModuleCandidates: [
    '../../export-xlsx.js',   // 仓库根：/export-xlsx.js
    '../export-xlsx.js',      // 放在 /frontend/export-xlsx.js
    './export-xlsx.js',       // 放在 /frontend/public/export-xlsx.js（极端兜底）
    '/export-xlsx.js'         // 运行时真正网站根（若部署到根）
  ],
};

function toast(msg, ms = 2200) {
  try {
    let bar = document.getElementById('__toast__');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = '__toast__';
      bar.style.cssText =
        'position:fixed;right:16px;top:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(bar);
    }
    const item = document.createElement('div');
    item.textContent = msg;
    item.style.cssText =
      'background:rgba(17,24,39,.92);color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.15);font-size:14px;max-width:360px;';
    bar.appendChild(item);
    setTimeout(() => (item.style.opacity = '0'), ms);
    setTimeout(() => item.remove(), ms + 320);
  } catch { /* 忽略 */ }
}

async function loadExportModule() {
  const customPath =
    document.currentScript?.dataset?.exportXlsx ||
    (typeof window !== 'undefined' && window.UI_ENHANCE && window.UI_ENHANCE.exportModule);
  const tryPaths = customPath ? [customPath, ...CFG.exportModuleCandidates] : CFG.exportModuleCandidates;

  for (const p of tryPaths) {
    try {
      const m = await import(p);
      if (m?.getApiBase && m?.imageProxy) return m;
    } catch { /* 尝试下一条 */ }
  }
  throw new Error('无法加载 export-xlsx.js（请检查路径：可在 <script> 上用 data-export-xlsx 指定）');
}

// ------- 极简：抓取 / 渲染 / 导出 -------
(async () => {
  const { getApiBase, imageProxy, exportToXlsxByItems, exportToXlsxByUrl } = await loadExportModule();
  const API_BASE = getApiBase();

  // DOM 钩子（按你的 index.html 约定的 id）
  const $ = (s, r = document) => r.querySelector(s);
  const els = {
    url: $('#txtUrl') || $('#url') || $('input[type="url"]') || $('input'),
    limit: $('#limit') || $('#selLimit') || $('select'),
    btnFetch: $('#btnFetch'),
    btnExport: $('#btnExport'),
    btnClear: $('#btnClear'),
    status: $('#status') || $('.alert') || null,
    okbar: $('#okbar') || null,
    tbody: $('#tbl tbody') || $('tbody'),
    thead: $('#tbl thead'),
  };

  function setBusy(b) {
    [els.url, els.limit, els.btnFetch, els.btnExport, els.btnClear].forEach(el => { if (el) el.disabled = !!b; });
    document.body.style.cursor = b ? 'progress' : 'default';
  }
  function setStatus(msg, ok = false) {
    if (els.status) { els.status.textContent = msg; els.status.style.display = 'block'; }
    if (els.okbar) { els.okbar.textContent = msg; els.okbar.style.display = ok ? 'block' : 'none'; }
  }

  function renderRows(items = []) {
    if (!els.tbody) return;
    els.tbody.innerHTML = '';
    items.forEach((it, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${it.sku || it.code || it.id || ''}</td>
        <td>${it.img ? `<img class="thumb" loading="lazy" src="${imageProxy(it.img,'raw')}" alt="" />` : ''}</td>
        <td>${it.title || it.name || it.desc || ''}</td>
        <td>${it.price || ''}</td>
        <td>${it.url ? `<a href="${it.url}" target="_blank" rel="noreferrer">打开</a>` : ''}</td>
      `;
      els.tbody.appendChild(tr);
    });
  }

  async function fetchCatalog() {
    const url = (els.url?.value || '').trim();
    const limit = parseInt((els.limit?.value || '50'), 10) || 50;
    if (!url) { setStatus('请输入目录链接'); return; }
    setBusy(true); setStatus('抓取中…');
    try {
      const qs = new URLSearchParams({ url, limit: String(limit) });
      const resp = await fetch(`${API_BASE}/catalog/parse?${qs.toString()}`, { method: 'GET' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const items = data?.items || data?.rows || data?.data || data?.list || data || [];
      renderRows(items.map(p => ({
        sku: p.sku || p.code || p.id || '',
        img: p.img || (Array.isArray(p.imgs) ? p.imgs[0] : ''),
        title: p.title || p.name || p.desc || '',
        price: p.price || '',
        url: p.url || p.link || '',
      })));
      window.__rowsForExport = items;
      setStatus(`抓取完成：${items.length} 条`, true);
    } catch (e) {
      console.error(e);
      setStatus('抓取失败：' + (e?.message || e));
      window.__rowsForExport = [];
    } finally {
      setBusy(false);
    }
  }

  async function doExport() {
    const rows = window.__rowsForExport || [];
    const url = (els.url?.value || '').trim();
    const limit = parseInt((els.limit?.value || '50'), 10) || 50;

    setBusy(true); setStatus('导出中…');
    try {
      if (Array.isArray(rows) && rows.length > 0) {
        await exportToXlsxByItems({ items: rows, withImages: true, filename: 'catalog.xlsx' });
      } else if (url) {
        await exportToXlsxByUrl({ url, limit, withImages: true, filename: 'catalog.xlsx' });
      } else {
        setStatus('没有可以导出的数据'); return;
      }
      setStatus('已触发下载', true);
    } catch (e) {
      console.error(e);
      setStatus('导出失败：' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  // 绑定（极简必需）
  if (els.btnFetch) els.btnFetch.addEventListener('click', fetchCatalog);
  if (els.btnExport) els.btnExport.addEventListener('click', doExport);
  if (els.btnClear && els.tbody) els.btnClear.addEventListener('click', () => { els.tbody.innerHTML = ''; setStatus('已清空'); });

  // 健康检查（非阻断）
  (async () => { try { const r = await fetch(`${API_BASE}/health`); console.info('[health]', r.status); } catch {} })();

  // ------- 增强：仅在 CFG.enhance = true 时启用（完全不影响极简路径） -------
  if (!CFG.enhance) return;

  // 1) 输入增强：自动补 http 前缀 / 回车即抓取 / 简单防抖
  if (els.url) {
    const ensureHttp = v => (/^https?:\/\//i.test(v) ? v : (v ? `https://${v}` : v));
    let t = 0;
    els.url.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { els.url.value = els.url.value.trim(); }, 300);
    });
    els.url.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { els.url.value = ensureHttp(els.url.value.trim()); fetchCatalog(); }
    });
    els.btnFetch?.addEventListener('click', () => { els.url.value = ensureHttp(els.url.value.trim()); });
  }

  // 2) 键盘快捷键：Ctrl/Cmd+E 导出
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); doExport(); }
  });

  // 3) 表头排序（点击 “货号 / 描述 / 单价” 列头）
  if (els.thead && els.tbody) {
    const idxMap = { sku: 1, title: 3, price: 4 };
    [...els.thead.querySelectorAll('th')].forEach((th, i) => {
      if (![idxMap.sku, idxMap.title, idxMap.price].includes(i)) return;
      let asc = true;
      th.style.cursor = 'pointer';
      th.title = '点击排序';
      th.addEventListener('click', () => {
        const rows = Array.from(els.tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
          const av = a.children[i]?.textContent?.trim() || '';
          const bv = b.children[i]?.textContent?.trim() || '';
          const na = parseFloat(av.replace(/[^\d.]/g, ''));
          const nb = parseFloat(bv.replace(/[^\d.]/g, ''));
          const bothNum = !Number.isNaN(na) && !Number.isNaN(nb);
          const res = bothNum ? (na - nb) : av.localeCompare(bv);
          return asc ? res : -res;
        });
        els.tbody.innerHTML = ''; rows.forEach(r => els.tbody.appendChild(r));
        asc = !asc;
      });
    });
  }

  // 4) 图片预览增强：移入放大
  document.addEventListener('mouseover', (e) => {
    const img = e.target.closest('img.thumb'); if (!img) return;
    let pop = document.createElement('div');
    pop.style.cssText = 'position:fixed;z-index:100000;border:1px solid #e5e7eb;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:6px;border-radius:8px;';
    const large = new Image();
    large.src = img.src; large.style.cssText = 'max-width:360px;max-height:360px;object-fit:contain;display:block;';
    pop.appendChild(large);
    document.body.appendChild(pop);
    const move = (ev) => { pop.style.left = (ev.clientX + 16) + 'px'; pop.style.top = (ev.clientY + 16) + 'px'; };
    const leave = () => { document.removeEventListener('mousemove', move); img.removeEventListener('mouseleave', leave); pop.remove(); };
    document.addEventListener('mousemove', move); img.addEventListener('mouseleave', leave);
  });

  // 5) 成功/失败轻提示（基于 setStatus + toast）
  const origSetStatus = setStatus;
  setStatus = (m, ok = false) => { origSetStatus(m, ok); toast(m); }; // 覆盖本地闭包引用

})();
