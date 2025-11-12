// frontend/public/ui-enhance.plus.js
// 只做“UI + 调用”，所有 URL 拼接与 API 规则统一走 export-xlsx.js

import {
  getApiBase,
  imageProxy,
  fetchCatalogByUrl,
  exportToXlsxByItems,
  exportToXlsxByUrl,
  mapItemToRow
} from './export-xlsx.js';

// --- 简易选择器 ---
const $ = (sel, root = document) => root.querySelector(sel);

// --- DOM 引用 ---
const $url   = $('#txtUrl') || $('#txtUrl'.replace('#','')); // 兼容没有 id 的极简版
const $limit = $('#txtLimit') || $('#txtLimit'.replace('#',''));
const $btnFetch  = $('#btnFetch');
const $btnExport = $('#btnExport');
const $btnClear  = $('#btnClear');
const $status    = $('#status');
const $okbar     = $('#okbar');
const $tbody     = $('#tbl')?.querySelector('tbody') || $('#tbl tbody');

// 运行时状态
let rows = [];  // 当前页面展示的行（用于导出）

// --- 状态提示 ---
function info(msg)  { if ($status) { $status.className = 'status'; $status.textContent = msg; } }
function ok(msg)    { if ($okbar)  { $okbar.style.display = ''; $okbar.textContent = msg || 'ok'; } }
function warn(msg)  { if ($status) { $status.className = 'status warn'; $status.textContent = msg; } }

// --- 渲染一行 ---
function renderRow(i, row) {
  const tr = document.createElement('tr');

  // 序号
  const tdIdx = document.createElement('td');
  tdIdx.textContent = String(i + 1);
  tr.appendChild(tdIdx);

  // 货号
  const tdSku = document.createElement('td');
  tdSku.textContent = row.sku || '';
  tr.appendChild(tdSku);

  // 图片
  const tdImg = document.createElement('td');
  if (row.img) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.src = imageProxy(row.img, 'raw');
    img.style.maxWidth = '64px';
    img.style.maxHeight = '64px';
    tdImg.appendChild(img);
  }
  tr.appendChild(tdImg);

  // 描述
  const tdDesc = document.createElement('td');
  tdDesc.textContent = row.title || '';
  tr.appendChild(tdDesc);

  // 单价
  const tdPrice = document.createElement('td');
  tdPrice.textContent = row.price || '';
  tr.appendChild(tdPrice);

  // 打开
  const tdOpen = document.createElement('td');
  const a = document.createElement('a');
  a.href = row.url || '#';
  a.target = '_blank';
  a.textContent = '打开';
  tdOpen.appendChild(a);
  tr.appendChild(tdOpen);

  return tr;
}

// --- 渲染列表 ---
function renderTable(items = []) {
  if (!$tbody) return;
  $tbody.innerHTML = '';
  items.forEach((it, i) => $tbody.appendChild(renderRow(i, it)));
}

// --- 读取输入 ---
function readInputs() {
  const listUrl = ($url?.value || '').trim();
  const limit   = parseInt($limit?.value || '50', 10) || 50;
  return { listUrl, limit };
}

// --- 绑定事件：抓取 ---
$btnFetch?.addEventListener('click', async () => {
  try {
    const { listUrl, limit } = readInputs();
    if (!listUrl) { warn('请输入目录链接'); return; }

    info('抓取中…');
    const json = await fetchCatalogByUrl(listUrl, limit);
    // 约定：后端返回 { ok, items?, rows?, data?, list? } 取最全那一个
    const src = json.items || json.rows || json.data || json.list || [];
    rows = src.map(mapItemToRow);

    renderTable(rows);
    ok(`抓取完成：共 ${rows.length} 条`);
  } catch (err) {
    console.error(err);
    warn('Failed to fetch');
  }
});

// --- 绑定事件：导出 ---
$btnExport?.addEventListener('click', async () => {
  try {
    const { listUrl, limit } = readInputs();

    info('导出中…');
    // 若页面已有 rows，就直接把 rows 交给后端流式生成；
    // 否则按 URL 让后端现抓现导。
    let blob;
    if (rows && rows.length) {
      blob = await exportToXlsxByItems(rows, '产品数据导出.xlsx');
    } else if (listUrl) {
      blob = await exportToXlsxByUrl(listUrl, limit, '产品数据导出.xlsx');
    } else {
      warn('没有可导出的数据');
      return;
    }

    // 触发下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '产品数据导出.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    ok('导出完成');
  } catch (err) {
    console.error(err);
    warn('导出失败');
  }
});

// --- 绑定事件：清空 ---
$btnClear?.addEventListener('click', () => {
  rows = [];
  renderTable([]);
  if ($okbar) $okbar.style.display = 'none';
  info('已清空');
});

// --- 启动时提示当前 API Base，方便自检 ---
(function boot() {
  const base = getApiBase();
  console.log('[ui-plus] api-base =', base || '(same-origin)');
})();
