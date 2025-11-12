// 文件：frontend/public/ui-enhance.plus.js
// 方案A：固定与 export-xlsx.js 同目录
// —— 仅做 UI/DOM 增强；网络请求与导出统一走工具函数；不出现任何 /v1/* 直链。

import {
  getApiBase,
  imageProxy,
  exportToXlsxByItems,
  exportToXlsxByUrl,
} from './export-xlsx.js';

(function () {
  // -------- 启用开关（支持三种方式，任一命中即启用） --------
  // 1) URL ?enhance=1
  // 2) <meta name="ui-enhance" content="on">
  // 3) window.UI_ENHANCE = { enhance:true }
  const qs = new URLSearchParams(location.search);
  const enabledByQs = ['1', 'true', 'on'].includes((qs.get('enhance') || '').toLowerCase());
  const enabledByMeta =
    (document.querySelector('meta[name="ui-enhance"]')?.content || '').toLowerCase() === 'on';
  const enabledByGlobal = typeof window !== 'undefined' && window.UI_ENHANCE && window.UI_ENHANCE.enhance === true;
  const ENHANCE_ON = enabledByQs || enabledByMeta || enabledByGlobal;

  if (!ENHANCE_ON) {
    console.info('[ui-plus] enhancement disabled.');
    return;
  }

  // -------- DOM 快速查询 --------
  const $ = (sel, root = document) => root.querySelector(sel);
  const API_BASE = getApiBase();

  const els = {
    url: $('#txtUrl') || $('#url') || $('input[type="url"]') || $('input'),
    limit: $('#limit') || $('#selLimit') || $('select'),
    btnFetch: $('#btnFetch'),
    btnExport: $('#btnExport'),
    btnClear: $('#btnClear'),
    status: $('#status') || $('.alert') || null,
    okbar: $('#okbar') || null,
    table: $('#tbl') || $('table'),
    tbody: $('#tbl tbody') || $('table tbody') || $('tbody'),
  };

  // -------- 小工具：Toast --------
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
      setTimeout(() => item.remove(), ms + 300);
    } catch {
      alert(msg);
    }
  }

  function setBusy(b) {
    [els.url, els.limit, els.btnFetch, els.btnExport, els.btnClear].forEach((el) => {
      if (el) el.disabled = !!b;
    });
    document.body.style.cursor = b ? 'progress' : 'default';
  }

  function setStatus(text, ok = false) {
    if (els.status) {
      els.status.textContent = text;
      els.status.style.display = 'block';
    }
    if (els.okbar) {
      els.okbar.textContent = text;
      els.okbar.style.display = ok ? 'block' : 'none';
    }
  }

  // -------- 表格渲染 --------
  function ensureTableHead() {
    if (!els.table) return;
    const thead = els.table.tHead || els.table.createTHead();
    if (!thead.rows.length) {
      const tr = thead.insertRow();
      ['#', '货号', '图片', '描述', '单价', '打开'].forEach((t) => {
        const th = document.createElement('th');
        th.textContent = t;
        tr.appendChild(th);
      });
    }
  }

  function renderRows(items = []) {
    ensureTableHead();
    if (!els.tbody) return;
    els.tbody.innerHTML = '';
    items.forEach((it, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${it.sku || ''}</td>
        <td>${it.img ? `<img class="thumb" src="${imageProxy(it.img, 'raw')}" alt="" />` : ''}</td>
        <td>${it.title || it.desc || ''}</td>
        <td>${it.price || ''}</td>
        <td>${it.url ? `<a href="${it.url}" target="_blank" rel="noreferrer">打开</a>` : ''}</td>
      `;
      els.tbody.appendChild(tr);
    });
  }

  // -------- 抓取目录 --------
  async function fetchCatalog() {
    const url = (els.url?.value || '').trim();
    const limit = parseInt(els.limit?.value || '50', 10) || 50;
    if (!url) {
      setStatus('请输入目录链接');
      return;
    }
    setBusy(true);
    setStatus('抓取中…');
    try {
      const qs = new URLSearchParams({ url, limit: String(limit) });
      const resp = await fetch(`${API_BASE}/catalog/parse?${qs.toString()}`, { method: 'GET' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const items = data?.items || data?.rows || data?.data || data?.list || data || [];
      const norm = items.map((p) => ({
        sku: p.sku || p.code || p.id || '',
        img: p.img || (Array.isArray(p.imgs) ? p.imgs[0] : ''),
        title: p.title || p.name || p.desc || '',
        price: p.price || '',
        url: p.url || p.link || '',
      }));
      window.__rowsForExport = norm;
      renderRows(norm);
      setStatus(`抓取完成：${norm.length} 条`, true);
      toast(`抓取成功：${norm.length} 条`);
    } catch (e) {
      console.error('[ui-plus] fetchCatalog error:', e);
      setStatus('抓取失败：' + (e?.message || e));
      toast('抓取失败');
    } finally {
      setBusy(false);
    }
  }

  // -------- 导出 --------
  async function doExport() {
    const rows = window.__rowsForExport || [];
    const url = (els.url?.value || '').trim();
    const limit = parseInt(els.limit?.value || '50', 10) || 50;

    setBusy(true);
    setStatus('导出中…');
    try {
      if (Array.isArray(rows) && rows.length > 0) {
        await exportToXlsxByItems({ items: rows, withImages: true, filename: 'catalog.xlsx' });
      } else if (url) {
        await exportToXlsxByUrl({ url, limit, withImages: true, filename: 'catalog.xlsx' });
      } else {
        setStatus('没有可以导出的数据');
        return;
      }
      setStatus('已触发下载', true);
      toast('导出成功，已触发下载');
    } catch (e) {
      console.error('[ui-plus] export error:', e);
      setStatus('导出失败：' + (e?.message || e));
      toast('导出失败');
    } finally {
      setBusy(false);
    }
  }

  // -------- 清空 --------
  function doClear() {
    if (els.tbody) els.tbody.innerHTML = '';
    window.__rowsForExport = [];
    setStatus('已清空');
  }

  // 事件绑定
  if (els.btnFetch) els.btnFetch.addEventListener('click', fetchCatalog);
  if (els.btnExport) els.btnExport.addEventListener('click', doExport);
  if (els.btnClear) els.btnClear.addEventListener('click', doClear);

  // 非阻断健康检查
  (async () => {
    try {
      const r = await fetch(`${API_BASE}/health`);
      console.info('[ui-plus] health:', r.status);
    } catch {}
  })();

  console.info('[ui-plus] enhancement enabled. API_BASE =', API_BASE);
})();
