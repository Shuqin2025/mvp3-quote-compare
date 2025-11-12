// 文件：frontend/public/ui-enhance.plus.js
// 说明：保持“极简 + 可选增强开关”，但在此处强制修正图片代理与后端导出两个接口到 /v1/api/*。
// 仅依赖：同目录下的 export-xlsx.js 提供 getApiBase()

import { getApiBase } from './export-xlsx.js';

// -------- 工具 --------
const $ = (s, r = document) => r.querySelector(s);
const API_BASE = getApiBase(); // 读取 <meta name="api-base"> 或 ?api= 覆盖，返回 .../v1/api

function setBusy(on) {
  const els = ['#txtUrl', '#limit', '#btnFetch', '#btnExport', '#btnClear']
    .map(s => $(s)).filter(Boolean);
  els.forEach(el => el.disabled = !!on);
  document.body.style.cursor = on ? 'progress' : 'default';
}
function setStatus(msg, ok = false) {
  const status = $('#status');
  const okbar = $('#okbar');
  if (status) { status.textContent = msg; status.style.display = 'block'; }
  if (okbar) { okbar.textContent = msg; okbar.style.display = ok ? 'block' : 'none'; }
}

// -------- 这里覆盖两个“易 404”的后端接口 --------
// 统一走 /v1/api/*，避免被其它封装剪掉 /api 变成 /v1/*
function imageProxy(url, format = 'raw') {
  const qs = new URLSearchParams({ url, format });
  return `${API_BASE}/image?${qs}`;
}
async function exportToXlsxByUrl(url, limit = 50, opts = {}) {
  const qs = new URLSearchParams({ url, limit: String(limit) });
  const endpoint = `${API_BASE}/export-xlsx?${qs}`;
  const res = await fetch(endpoint, { method: 'GET' });
  if (!res.ok) throw new Error(`导出失败：HTTP ${res.status}`);
  // 文件下载
  const blob = await res.blob();
  const fname = opts.filename || 'catalog.xlsx';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// -------- 渲染 & 采集 --------
function renderRows(items = []) {
  const tbody = $('#tbl tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  items.forEach((it, i) => {
    const tr = document.createElement('tr');
    const img = it.img ? `<img class="thumb" src="${imageProxy(it.img, 'raw')}" alt=""/>` : '';
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${it.sku || ''}</td>
      <td>${img}</td>
      <td>${it.title || it.desc || ''}</td>
      <td>${it.price || ''}</td>
      <td>${it.url ? `<a href="${it.url}" target="_blank" rel="noreferrer">打开</a>` : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function fetchCatalog() {
  const url = ($('#txtUrl')?.value || '').trim();
  const limit = parseInt($('#limit')?.value || '50', 10) || 50;
  if (!url) { setStatus('请输入目录链接'); return; }

  setBusy(true);
  setStatus('抓取中…');
  try {
    const qs = new URLSearchParams({ url, limit: String(limit) });
    const endpoint = `${API_BASE}/catalog/parse?${qs}`;
    const resp = await fetch(endpoint, { method: 'GET' });
    if (!resp.ok) {
      throw new Error(`抓取失败：HTTP ${resp.status}`);
    }
    const data = await resp.json();
    const list = data?.items || data?.rows || data?.data || data?.list || [];
    const norm = list.map(p => ({
      sku: p.sku || p.code || p.id || '',
      img: p.img || (Array.isArray(p.imgs) ? p.imgs[0] : ''),
      title: p.title || p.name || p.desc || '',
      price: p.price || '',
      url: p.url || p.link || ''
    }));
    window.__rowsForExport = norm;
    renderRows(norm);
    setStatus(`抓取完成：${norm.length} 条`, true);
  } catch (e) {
    console.error(e);
    setStatus(e?.message || '抓取失败');
  } finally {
    setBusy(false);
  }
}

async function doExport() {
  const rows = window.__rowsForExport || [];
  const url = ($('#txtUrl')?.value || '').trim();
  const limit = parseInt($('#limit')?.value || '50', 10) || 50;

  setBusy(true);
  setStatus('导出中…');
  try {
    if (Array.isArray(rows) && rows.length > 0) {
      // 为了稳定，统一走后端 URL 导出（后端直连图片）
      await exportToXlsxByUrl(url || '_probe_', limit, { filename: 'catalog.xlsx' });
    } else if (url) {
      await exportToXlsxByUrl(url, limit, { filename: 'catalog.xlsx' });
    } else {
      setStatus('没有可以导出的数据'); 
      return;
    }
    setStatus('已触发下载', true);
  } catch (e) {
    console.error(e);
    setStatus(e?.message || '导出失败');
  } finally {
    setBusy(false);
  }
}

// -------- 事件 & 健康探针 --------
function bindEvents() {
  $('#btnFetch')?.addEventListener('click', fetchCatalog);
  $('#btnExport')?.addEventListener('click', doExport);
  $('#btnClear')?.addEventListener('click', () => {
    const tbody = $('#tbl tbody');
    if (tbody) tbody.innerHTML = '';
    window.__rowsForExport = [];
    setStatus('已清空');
  });
}

async function healthProbe() {
  try {
    // /v1/api/health（API层），以及 /v1/health（网关层）都试探一下，非阻断
    await fetch(`${API_BASE}/health`).catch(() => {});
    const root = API_BASE.replace(/\/api\/?$/, '/'); // 网关根：.../v1/
    await fetch(`${root}health`).catch(() => {});
  } catch {}
}

// -------- 启动 --------
(function main() {
  const meta = document.querySelector('meta[name="ui-enhance"]')?.content || '';
  const flag = (window.UI_ENHANCE?.enhance ?? meta === 'on');
  if (!flag) return;

  bindEvents();
  healthProbe();
  setStatus('准备就绪');
})();
