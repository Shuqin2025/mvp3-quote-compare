// frontend/public/ui-enhance.plus.js
import { getApiBase, imageProxy, exportToXlsxByItems, exportToXlsxByUrl } from './export-xlsx.js';

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const API_BASE = getApiBase(); // <meta name="api-base"> 或 ?api= 决定，必须包含 /v1/api

  const els = {
    url: $('#txtUrl') || $('input[type="text"], input#txtUrl'),
    limit: $('#limit') || $('input[type="number"], input#limit'),
    btnFetch: $('#btnFetch'),
    btnExport: $('#btnExport'),
    btnClear: $('#btnClear'),
    table: $('#tbl') || $('#tb1'),
    status: $('#status')
  };

  function toast(msg, ms = 2000) {
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
        'background:#111827;color:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.15)';
      bar.appendChild(item);
      setTimeout(() => item.remove(), ms);
    } catch {}
  }

  function setStatus(text, ok = true) {
    if (!els.status) return;
    els.status.textContent = text || '';
    els.status.className = ok ? 'alert ok' : 'alert warn';
  }

  function buildCatalogParseUrl(siteUrl, limit) {
    const u = new URL(`${API_BASE}/catalog/parse`, window.location.origin);
    u.searchParams.set('url', siteUrl);
    u.searchParams.set('limit', String(limit || 50));
    u.searchParams.set('ts', String(Date.now()));
    return u.toString();
  }

  function fillTable(rows = []) {
    if (!els.table) return;
    // 清空 tbody
    const tbody = els.table.tBodies?.[0] || els.table.querySelector('tbody') || els.table;
    tbody.innerHTML = '';

    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');

      const tdIdx = document.createElement('td');
      tdIdx.textContent = String(idx + 1);
      tr.appendChild(tdIdx);

      const tdSku = document.createElement('td');
      tdSku.textContent = r.sku || '';
      tr.appendChild(tdSku);

      const tdImg = document.createElement('td');
      if (r.img) {
        const img = document.createElement('img');
        img.src = imageProxy(r.img, 'raw');
        img.style.cssText = 'width:72px;height:72px;object-fit:contain;border:1px solid #eee;border-radius:6px;';
        tdImg.appendChild(img);
      }
      tr.appendChild(tdImg);

      const tdDesc = document.createElement('td');
      tdDesc.textContent = r.desc || r.title || '';
      tr.appendChild(tdDesc);

      const tdPrice = document.createElement('td');
      tdPrice.textContent = r.price || '';
      tr.appendChild(tdPrice);

      const tdOpen = document.createElement('td');
      if (r.url) {
        const a = document.createElement('a');
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = '打开';
        tdOpen.appendChild(a);
      }
      tr.appendChild(tdOpen);

      tbody.appendChild(tr);
    });
  }

  async function doFetch() {
    try {
      const siteUrl = (els.url?.value || '').trim();
      const limit = Number(els.limit?.value || 50) || 50;
      if (!siteUrl) {
        toast('请输入要抓取的目录链接');
        return;
      }

      setStatus('抓取中…', true);

      const url = buildCatalogParseUrl(siteUrl, limit);
      const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        setStatus(`抓取失败：${res.status} ${res.statusText}`, false);
        return;
      }

      const data = await res.json(); // 约定：{ ok, rows, items, list, data, count }
      const rows = data?.rows || data?.items || data?.list || data?.data || [];
      fillTable(rows);
      setStatus(`抓取成功：共 ${rows.length} 条`, true);
    } catch (err) {
      setStatus(`抓取失败：${err?.message || err}`, false);
    }
  }

  async function doExportUrl() {
    try {
      const siteUrl = (els.url?.value || '').trim();
      const limit = Number(els.limit?.value || 50) || 50;
      if (!siteUrl) {
        toast('请输入目录链接再导出');
        return;
      }
      await exportToXlsxByUrl(siteUrl, { limit });
    } catch (err) {
      toast(err?.message || String(err));
    }
  }

  function doClear() {
    try {
      const tbody = els.table?.tBodies?.[0] || els.table?.querySelector('tbody') || els.table;
      if (tbody) tbody.innerHTML = '';
      setStatus('准备就绪', true);
    } catch {}
  }

  // 事件绑定
  els.btnFetch && els.btnFetch.addEventListener('click', doFetch);
  els.btnExport && els.btnExport.addEventListener('click', doExportUrl);
  els.btnClear && els.btnClear.addEventListener('click', doClear);

  // 首屏提示
  setStatus('准备就绪', true);
})();
