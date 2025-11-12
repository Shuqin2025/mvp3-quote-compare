// 文件：frontend/public/ui-enhance.plus.js
// 说明：plus 版入口脚本 —— 仅依赖同目录的 export-xlsx.js，统一路由为 /v1/api → /v1/*

import {
  getApiBase,          // 返回类似：?api=... 或 <meta name="api-base"> 或默认 '/v1/api'
  imageProxy,          // imageProxy(originalUrl, format)
  exportToXlsxByItems, // 备用：按行导出
  exportToXlsxByUrl    // 直接让网关按 URL 抓取并导出
} from './export-xlsx.js';

// —— 小工具：状态提示小条 —— //
function toast(msg, ms = 1800) {
  let bar = document.getElementById('__toast__');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = '__toast__';
    bar.style.cssText =
      'position:fixed;right:16px;top:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(bar);
  }
  const el = document.createElement('div');
  el.textContent = String(msg || '').trim() || 'OK';
  el.style.cssText =
    'background:#111827;color:#fff;border:1px solid #374151;padding:10px 14px;border-radius:10px;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.18);max-width:56vw;line-height:1.4;';
  bar.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// —— 统一拿到 /v1/api 和 /v1/ 根 —— //
function getV1Root(apiBase) {
  // 把末尾的 /api 或 /api/ 去掉，得到 /v1/
  return String(apiBase || '/v1/api').replace(/\/api\/?$/i, '/');
}

// —— DOM 引用 —— //
const $ = (sel) => document.querySelector(sel);
const $url   = $('#txtUrl');      // 输入：目录页地址
const $limit = $('#txtLimit');    // 输入：限制条数
const $btnFetch  = $('#btnFetch');
const $btnClear  = $('#btnClear');
const $btnExport = $('#btnExport');
const $status = $('#status');
const $okbar  = $('#okbar');
const $tbody  = $('#tbl tbody');

// —— 渲染一行 —— //
function renderRow(i, item) {
  const tr = document.createElement('tr');

  const tdIndex = document.createElement('td');
  tdIndex.textContent = i + 1;

  const tdSku = document.createElement('td');
  tdSku.textContent = item.sku || '';

  const tdImg = document.createElement('td');
  if (item.img) {
    const a = document.createElement('a');
    a.href = item.url || '#';
    a.target = '_blank';
    const img = document.createElement('img');
    img.alt = item.sku || '';
    img.referrerPolicy = 'no-referrer';
    // 通过统一的图片代理
    img.src = imageProxy(item.img, 'raw');
    img.style.cssText = 'width:72px;height:72px;object-fit:contain;border:1px solid #eee;border-radius:6px;';
    a.appendChild(img);
    tdImg.appendChild(a);
  }
  const tdTitle = document.createElement('td');
  tdTitle.textContent = item.title || item.desc || '';

  const tdPrice = document.createElement('td');
  tdPrice.textContent = item.price || '';

  const tdOpen = document.createElement('td');
  if (item.url) {
    const a = document.createElement('a');
    a.textContent = '打开';
    a.href = item.url;
    a.target = '_blank';
    a.rel = 'noopener';
    tdOpen.appendChild(a);
  }

  tr.append(tdIndex, tdSku, tdImg, tdTitle, tdPrice, tdOpen);
  return tr;
}

// —— 目录抓取 —— //
async function fetchCatalog(V1, url, limit) {
  const u = new URL(`${V1}catalog/parse`, location.origin);
  u.searchParams.set('url', url);
  if (limit) u.searchParams.set('limit', String(limit));
  const res = await fetch(u.toString(), { method: 'GET', credentials: 'omit' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`目录抓取失败 ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

// —— 按当前表格导出（兜底） —— //
async function exportCurrentRowsAsXlsx() {
  try {
    const rows = Array.from($tbody.querySelectorAll('tr')).map(tr => {
      const tds = tr.querySelectorAll('td');
      return {
        '#': tds[0]?.textContent?.trim() || '',
        sku: tds[1]?.textContent?.trim() || '',
        title: tds[3]?.textContent?.trim() || '',
        price: tds[4]?.textContent?.trim() || '',
        url: tds[5]?.querySelector('a')?.href || ''
      };
    });
    if (!rows.length) throw new Error('没有可导出的数据');
    await exportToXlsxByItems(rows);
    toast('已发起导出（本页数据）');
  } catch (err) {
    console.error(err);
    toast(err.message || '导出失败');
  }
}

// —— 初始化 —— //
(async function main() {
  try {
    // 1) 统一根
    const API = await getApiBase();     // 期望 '/v1/api'
    const V1  = getV1Root(API);         // 变成 '/v1/'

    // 2) 事件绑定
    if ($btnClear) {
      $btnClear.addEventListener('click', () => {
        $tbody.innerHTML = '';
        $status.textContent = '准备就绪';
        $okbar.textContent = 'ok';
        toast('已清空表格');
      });
    }

    if ($btnFetch) {
      $btnFetch.addEventListener('click', async () => {
        try {
          const url = ($url?.value || '').trim();
          const limit = Number($limit?.value || 0) || undefined;
          if (!url) return toast('请输入目录页链接');

          $status.textContent = '抓取中...';
          $okbar.style.display = 'none';

          const data = await fetchCatalog(V1, url, limit);
          // 兼容数据结构 { ok, list:[], rows:[] }
          const list = data?.rows || data?.list || data?.data || [];
          $tbody.innerHTML = '';
          list.forEach((item, i) => $tbody.appendChild(renderRow(i, item)));

          $status.textContent = `抓取完成：共 ${list.length} 条`;
          $okbar.textContent = 'ok';
          $okbar.style.display = '';
          toast('抓取成功');
        } catch (err) {
          console.error(err);
          $status.textContent = '抓取失败';
          $okbar.style.display = 'none';
          toast(err.message || '抓取失败');
        }
      });
    }

    if ($btnExport) {
      $btnExport.addEventListener('click', async () => {
        // 优先走“网关按 URL 抓取并导出”，失败再兜底“把当前表格导出”
        try {
          const url = ($url?.value || '').trim();
          const limit = Number($limit?.value || 0) || undefined;
          if (!url) return toast('请输入目录页链接');
          await exportToXlsxByUrl(url, limit);
          toast('已发起导出（由网关执行）');
        } catch (e) {
          console.warn('远程导出失败，改用本页数据导出：', e);
          await exportCurrentRowsAsXlsx();
        }
      });
    }

    // 3) 页面就绪
    $status.textContent = '准备就绪';
    $okbar.textContent = 'ok';
    $okbar.style.display = '';
  } catch (e) {
    console.error(e);
    toast('初始化失败：' + (e.message || e));
  }
})();
