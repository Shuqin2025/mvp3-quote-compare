// 文件：frontend/public/ui-enhance.plus.js
// 功能：只做 UI/DOM 增强；所有网络调用统一走 getApiBase()/imageProxy()/export*；不写 /v1/* 直链。
// 重要：此版假定 export-xlsx.js 与本文件在同一目录（frontend/public/）
import { getApiBase, imageProxy, exportToXlsxByItems, exportToXlsxByUrl } from './export-xlsx.js';

(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const API_BASE = getApiBase();

  // 读开关：?enhance=1 或 <meta name="ui-enhance" content="on">
  const qs = new URLSearchParams(location.search);
  const onByMeta = (document.querySelector('meta[name="ui-enhance"]')?.content || '').toLowerCase() === 'on';
  const ENHANCE_ON = (qs.get('enhance') === '1') || onByMeta || (window.UI_ENHANCE?.enhance === true);
  if (!ENHANCE_ON) return;

  const els = {
    url:   $('#txtUrl')   || $('#url') || $('input[type="url"]') || $('input'),
    limit: $('#limit')    || $('#selLimit') || $('select'),
    btnFetch:  $('#btnFetch'),
    btnExport: $('#btnExport'),
    btnClear:  $('#btnClear'),
    status: $('#status') || $('.alert') || null,
    okbar:  $('#okbar') || null,
    tbody:  $('#tbl tbody') || $('tbody'),
  };

  function toast(msg, ms = 2200) {
    try {
      let bar = document.getElementById('__toast__');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = '__toast__';
        bar.style.cssText = 'position:fixed;right:16px;top:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(bar);
      }
      const item = document.createElement('div');
      item.textContent = msg;
      item.style.cssText = 'background:rgba(17,24,39,.92);color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.15);font-size:14px;max-width:360px;';
      bar.appendChild(item);
      setTimeout(() => { item.style.opacity='0'; item.style.transition='opacity .3s'; }, ms);
      setTimeout(() => item.remove(), ms + 320);
    } catch { /* 忽略 */ }
  }

  function setBusy(b) {
    [els.url, els.limit, els.btnFetch, els.btnExport, els.btnClear].forEach(el => { if (el) el.disabled = !!b; });
    document.body.style.cursor = b ? 'progress' : 'default';
  }
  function setStatus(msg, ok = false) {
    if (els.status) { els.status.textContent = msg; els.status.style.display='block'; }
    if (els.okbar)  { els.okbar.textContent  = msg; els.okbar.style.display  = ok ? 'block' : 'none'; }
  }

  function renderRows(items = []) {
    if (!els.tbody) return;
    els.tbody.innerHTML = '';
    items.forEach((it, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${it.sku || ''}</td>
        <td>${it.img ? `<img class="thumb" src="${imageProxy(it.img,'raw')}" alt="" />` : ''}</td>
        <td>${it.title || it.desc || ''}</td>
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
      const norm = items.map(p => ({
        sku:   p.sku || p.code || p.id || '',
        img:   p.img || (Array.isArray(p.imgs) ? p.imgs[0] : ''),
        title: p.title || p.name || p.desc || '',
        price: p.price || '',
        url:   p.url || p.link || '',
      }));
      window.__rowsForExport = norm;
      renderRows(norm);
      setStatus(`抓取完成（${norm.length} 条）`, true);
      toast('抓取成功');
    } catch (e) {
      console.error(e);
      setStatus('抓取失败：' + (e?.message || e));
      toast('抓取失败');
    } finally {
      setBusy(false);
    }
  }

  async function doExport() {
    const rows = window.__rowsForExport || [];
    const url   = (els.url?.value || '').trim();
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
      toast('已触发下载');
    } catch (e) {
      console.error(e);
      setStatus('导出失败：' + (e?.message || e));
      toast('导出失败');
    } finally {
      setBusy(false);
    }
  }

  if (els.btnFetch)  els.btnFetch .addEventListener('click', fetchCatalog);
  if (els.btnExport) els.btnExport.addEventListener('click', doExport);
  if (els.btnClear && els.tbody) els.btnClear.addEventListener('click', () => { els.tbody.innerHTML=''; setStatus('已清空'); });

  // 健康检查（非阻断）
  (async () => {
    try { const r = await fetch(`${API_BASE}/health`); console.info('[health]', r.status); } catch {}
  })();
})();
