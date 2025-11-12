// --- ui-enhance.plus.js ----------------------------------------------------
// 负责：读取表单，调用 /v1/catalog/parse 抓取，渲染表格，接入导出与图片代理。
// 关键修复：所有接口路径均经过 export-xlsx.js 的 apiUrl/joinUrl 处理，彻底杜绝拼接错误。

import {
  getApiBase,
  imageProxy,
  exportToXlsxByItems,
  exportToXlsxByUrl,
  _util
} from './export-xlsx.js';

// 简单选择器
const $ = (sel, el = document) => el.querySelector(sel);

// DOM
const iptUrl   = $('#txtUrl')      || $('[type="text"]');
const iptLimit = $('#txtLimit')    || $('[type="number"]');
const btnFetch = $('#btnFetch')    || document.getElementById('btnFetch');
const btnExport= $('#btnExport')   || document.getElementById('btnExport');
const btnClear = $('#btnClear')    || document.getElementById('btnClear');
const statusBar= $('#status')      || document.getElementById('status');
const okBar    = $('#okbar')       || document.getElementById('okbar');
const tblBody  = $('#tbl tbody')   || document.querySelector('#tbl tbody');

// 运行开关（可由 ?enhance=1 或 <meta name="ui-enhance" content="on"> 控制）
(function bootstrapEnable() {
  const qs = new URLSearchParams(location.search);
  const meta = document.querySelector('meta[name="ui-enhance"]')?.content?.trim().toLowerCase();
  const global = window.UI_ENHANCE?.enhance === true;
  const on = (qs.get('enhance') === '1') || meta === 'on' || global;
  if (!on) return;
  console.log('[ui-plus] enabled, apiBase =', getApiBase() || '(same-origin)');
})();

// UI 辅助
function toast(msg, ms = 2000) {
  let bar = document.getElementById('__toast__');
  if (!bar) {
    bar = document.createElement('div'); bar.id = '__toast__';
    bar.style.cssText = 'position:fixed;right:16px;top:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(bar);
  }
  const item = document.createElement('div');
  item.textContent = msg;
  item.style.cssText = 'padding:10px 12px;border-radius:8px;background:#222;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.15)';
  bar.appendChild(item);
  setTimeout(() => item.remove(), ms);
}

function setStatus(text, isOk = false) {
  if (statusBar) statusBar.textContent = text || '';
  if (okBar) okBar.style.display = isOk ? 'block' : 'none';
}

function clearTable() {
  if (tblBody) tblBody.innerHTML = '';
}

// 抓取目录：调用 /v1/catalog/parse?url=&limit=
async function fetchCatalog(listUrl, limit = 50) {
  const u = _util.apiUrl('catalog/parse');
  const qs = new URLSearchParams({ url: String(listUrl || ''), limit: String(limit || 50) });
  const res = await fetch(`${u}?${qs.toString()}`, { method: 'GET' });
  if (!res.ok) throw new Error(`抓取失败：${res.status} ${res.statusText}`);
  return await res.json(); // 期望 { ok, rows: [ {sku,title,img,desc,moq,price,url} ] }
}

function renderRows(rows = []) {
  clearTable();
  if (!tblBody) return;
  const frag = document.createDocumentFragment();
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');

    const tdIdx = document.createElement('td'); tdIdx.textContent = String(i + 1); tr.appendChild(tdIdx);

    const tdSku = document.createElement('td'); tdSku.textContent = r.sku || ''; tr.appendChild(tdSku);

    const tdImg = document.createElement('td');
    if (r.img) {
      const img = document.createElement('img');
      img.src = imageProxy(r.img, 'raw');
      img.referrerPolicy = 'no-referrer';
      img.style.cssText = 'width:84px;height:84px;object-fit:contain;border:1px solid #eee;border-radius:6px;background:#fff';
      tdImg.appendChild(img);
    }
    tr.appendChild(tdImg);

    const tdDesc = document.createElement('td'); tdDesc.textContent = r.title || r.desc || ''; tr.appendChild(tdDesc);

    const tdPrice = document.createElement('td'); tdPrice.textContent = r.price || ''; tr.appendChild(tdPrice);

    const tdOpen = document.createElement('td');
    if (r.url) {
      const a = document.createElement('a'); a.href = r.url; a.textContent = '打开'; a.target = '_blank';
      tdOpen.appendChild(a);
    }
    tr.appendChild(tdOpen);

    frag.appendChild(tr);
  });
  tblBody.appendChild(frag);
}

// 事件绑定
btnFetch?.addEventListener('click', async () => {
  try {
    const listUrl = iptUrl?.value?.trim();
    const limit = Number(iptLimit?.value || 50) || 50;
    if (!listUrl) { toast('请输入目录链接'); return; }
    setStatus('抓取中…'); btnFetch.disabled = true;
    const data = await fetchCatalog(listUrl, limit);
    if (!data?.ok) throw new Error('后端返回失败');
    renderRows(data.rows || data.list || []);
    setStatus(`抓取成功：共 ${(data.count ?? (data.rows?.length || 0))} 条`, true);
  } catch (err) {
    console.error(err);
    toast(`抓取失败：${err.message || err}`);
    setStatus('抓取失败');
  } finally {
    btnFetch.disabled = false;
  }
});

btnClear?.addEventListener('click', () => {
  clearTable(); setStatus('已清空');
});

btnExport?.addEventListener('click', async () => {
  try {
    const listUrl = iptUrl?.value?.trim();
    const limit = Number(iptLimit?.value || 50) || 50;

    // 如果表格已有数据，用 items 导出；否则走 URL 直链导出
    const rows = Array.from(tblBody?.querySelectorAll('tr') || []).map(tr => {
      const tds = tr.querySelectorAll('td');
      return {
        sku:   tds[1]?.textContent?.trim(),
        img:   tds[2]?.querySelector('img')?.src || '',
        title: tds[3]?.textContent?.trim(),
        price: tds[4]?.textContent?.trim(),
        url:   tds[5]?.querySelector('a')?.href || ''
      };
    }).filter(x => x.sku || x.title || x.url);

    setStatus('导出中…'); btnExport.disabled = true;
    if (rows.length > 0) {
      await exportToXlsxByItems(rows, '商品数据导出.xlsx');
    } else if (listUrl) {
      await exportToXlsxByUrl(listUrl, limit, '商品数据导出.xlsx');
    } else {
      toast('没有可导出的数据'); return;
    }
    setStatus('导出完成', true);
  } catch (err) {
    console.error(err);
    toast(`导出失败：${err.message || err}`);
    setStatus('导出失败');
  } finally {
    btnExport.disabled = false;
  }
});

// 语言按钮（保留）
['zh','de','en'].forEach(lang => {
  const btn = document.getElementById(`btnLang${lang.toUpperCase()}`);
  btn?.addEventListener('click', () => {
    localStorage.setItem('mvp_lang', lang);
    toast(`语言已切换：${lang}`);
  });
});
