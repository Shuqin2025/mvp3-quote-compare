// 文件：frontend/public/ui-enhance.plus.js
// 职责：只做 UI/DOM 增强；网络统一走 getApiBase()/imageProxy()/export*；不手写 /v1/* 直链
// 目录：与 ./export-xlsx.js 同目录（frontend/public/）
import {
  getApiBase,
  imageProxy,
  exportToXlsxByItems,
  exportToXlsxByUrl,
} from './export-xlsx.js';

(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const API_BASE = getApiBase();

  // —— 开关：?enhance=1 | <meta name="ui-enhance" content="on"> | window.UI_ENHANCE.enhance === true
  const qs = new URLSearchParams(location.search);
  const onByMeta = (document.querySelector('meta[name="ui-enhance"]')?.content || '').toLowerCase() === 'on';
  const cfgWin = (window.UI_ENHANCE || {});
  const ENHANCE_ON = (qs.get('enhance') === '1') || onByMeta || (cfgWin.enhance === true);
  if (!ENHANCE_ON) return;

  // 基础 DOM
  const els = {
    url:   $('#txtUrl') || $('#url') || $('input[type="url"]') || $('input'),
    limit: $('#limit') || $('#selLimit') || $('select'),
    btnFetch:  $('#btnFetch'),
    btnExport: $('#btnExport'),
    btnClear:  $('#btnClear'),
    status: $('#status') || $('.alert') || null,
    okbar:  $('#okbar') || null,
    tbody:  $('#tbl tbody') || $('tbody'),
  };

  // 轻提示
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
    } catch {}
  }

  function setBusy(b) {
    [els.url, els.limit, els.btnFetch, els.btnExport, els.btnClear].forEach(el => { if (el) el.disabled = !!b; });
    document.body.style.cursor = b ? 'progress' : 'default';
  }
  function setStatus(msg, ok=false) {
    if (els.status) { els.status.textContent = msg; els.status.style.display='block'; }
    if (els.okbar)  { els.okbar.textContent  = msg; els.okbar.style.display  = ok ? 'block' : 'none'; }
  }

  // ---------- 代理/导出能力探测（一次性、温和失败） ----------
  let IMAGE_PROXY_OK = true;
  let EXPORT_API_OK  = true;

  async function probeOnce() {
    try {
      // /health（非阻断）
      fetch(`${API_BASE}/health`).catch(()=>{});
    } catch {}

    // 允许外部强制开关
    if (typeof cfgWin.forceImageProxy === 'boolean') {
      IMAGE_PROXY_OK = !!cfgWin.forceImageProxy;
      if (!IMAGE_PROXY_OK) toast('提示：已关闭图片代理（UI 使用直链图）');
    } else {
      // 轻探测 /image 是否存在
      try {
        const v1 = API_BASE.replace(/\/api\/?$/,'/'); // 与 export-xlsx.js 内部逻辑一致
        const r = await fetch(`${v1}image?format=raw&url=data:,ping`, { method:'HEAD' });
        IMAGE_PROXY_OK = r.ok;
        if (!IMAGE_PROXY_OK) toast('图片代理不可用：UI 将改用直链图片');
      } catch {
        IMAGE_PROXY_OK = false;
        toast('图片代理不可用：UI 将改用直链图片');
      }
    }

    if (typeof cfgWin.withImages === 'boolean') {
      EXPORT_API_OK = true; // 导出 API 还在，但是否带图由 withImages 决定
    } else {
      // 轻探测 /export-xlsx 是否存在
      try {
        const v1 = API_BASE.replace(/\/api\/?$/,'/');
        const r = await fetch(`${v1}export-xlsx?_=${Date.now()}`, { method:'OPTIONS' });
        EXPORT_API_OK = r.ok;
        if (!EXPORT_API_OK) toast('导出直连不可用：将采用本地行导出或无图导出');
      } catch {
        EXPORT_API_OK = false;
        toast('导出直连不可用：将采用本地行导出或无图导出');
      }
    }
  }
  probeOnce();

  // UI 渲染
  function resolveImg(url) {
    if (!url) return '';
    // 若代理可用 → 走代理；否则直链
    return IMAGE_PROXY_OK ? imageProxy(url, 'raw') : url;
  }

  function renderRows(items=[]) {
    if (!els.tbody) return;
    els.tbody.innerHTML = '';
    items.forEach((it, i) => {
      const tr = document.createElement('tr');
      const img = it.img ? `<img class="thumb" src="${resolveImg(it.img)}" alt="" />` : '';
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${it.sku || ''}</td>
        <td>${img}</td>
        <td>${it.title || it.desc || ''}</td>
        <td>${it.price || ''}</td>
        <td>${it.url ? `<a href="${it.url}" target="_blank" rel="noreferrer">打开</a>` : ''}</td>
      `;
      els.tbody.appendChild(tr);
    });
  }

  // 抓取
  async function fetchCatalog() {
    const url = (els.url?.value || '').trim();
    const limit = parseInt((els.limit?.value || '50'), 10) || 50;
    if (!url) { setStatus('请输入目录链接'); return; }
    setBusy(true); setStatus('抓取中…');
    try {
      const sp = new URLSearchParams({ url, limit: String(limit) });
      const resp = await fetch(`${API_BASE}/catalog/parse?${sp.toString()}`, { method:'GET' });
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

  // 导出
  async function doExport() {
    const rows  = window.__rowsForExport || [];
    const url   = (els.url?.value || '').trim();
    const limit = parseInt((els.limit?.value || '50'), 10) || 50;

    // 是否带图：优先外部设置，其次跟随图片代理可用性
    const withImages = (typeof cfgWin.withImages === 'boolean')
      ? !!cfgWin.withImages
      : !!IMAGE_PROXY_OK;

    setBusy(true); setStatus(withImages ? '导出中（含图片）…' : '导出中（不含图片）…');
    try {
      if (Array.isArray(rows) && rows.length > 0) {
        await exportToXlsxByItems({ items: rows, withImages, filename: 'catalog.xlsx' });
      } else if (url) {
        // 若直连导出接口不可用 → 退回按行导出（需要先抓取）
        if (!EXPORT_API_OK) {
          if (!rows.length) throw new Error('请先抓取后导出（直连导出不可用）');
          await exportToXlsxByItems({ items: rows, withImages, filename: 'catalog.xlsx' });
        } else {
          await exportToXlsxByUrl({ url, limit, withImages, filename: 'catalog.xlsx' });
        }
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

  // 末尾做一次健康检查（非阻断）
  (async () => {
    try { const r = await fetch(`${API_BASE}/health`); console.info('[health]', r.status); } catch {}
  })();
})();
