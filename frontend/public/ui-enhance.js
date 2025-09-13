// ---------- helpers ----------
const API_BASE = (function () {
  try {
    const sp = new URL(location.href).searchParams;
    let p = (sp.get("api") || "").trim();
    if (!p) return "/v1/api";
    // 去尾部斜杠
    p = p.replace(/\/+$/, "");
    // 如果传的是 __version，回到 /v1/api
    if (/\/v1\/api\/__version$/.test(p)) return p.replace(/\/__version$/, "");
    // 如果本身以 /v1/api 结尾，直接用
    if (/\/v1\/api$/.test(p)) return p;
    // 若只是域名/服务根，补上 /v1/api
    return p + "/v1/api";
  } catch {
    return "/v1/api";
  }
})();

const __toastEl = document.getElementById('toast');
function showToast(ok, text) {
  if (window.__showToast) return window.__showToast(ok, text);
  if (!__toastEl) return;
  __toastEl.className = 'alert ' + (ok ? 'alert-ok' : 'alert-warn');
  __toastEl.style.display = 'block';
  __toastEl.textContent = text;
}
function hideToast() {
  if (window.__hideToast) return window.__hideToast();
  if (!__toastEl) return;
  __toastEl.style.display = 'none';
}

const T = (k, v) => (window.__T ? window.__T(k, v) : k);

// ---------- DOM ----------
const $url        = document.getElementById('txtUrl');
const $btnFetch   = document.getElementById('btnFetch');
const $btnExport  = document.getElementById('btnExport');
const $btnClear   = document.getElementById('btnClear');
const $selPreview = document.getElementById('selPreview');

// UI 容器
const $tbl   = document.getElementById('tbl');
const $tbody = document.getElementById('tbody');
const $empty = document.getElementById('empty');

// 隐藏“富化价格/MOQ”
(function hideEnrich() {
  const c = document.getElementById('chkEnrich');
  if (c && c.closest('label')) c.closest('label').style.display = 'none';
})();

let __rows = []; // 缓存当前预览行

// ---------- normalize ----------
function normalizeItems(data) {
  let arr = [];
  if (Array.isArray(data)) arr = data;
  else if (Array.isArray(data.products)) arr = data.products;
  else if (Array.isArray(data.items)) arr = data.items;

  return arr.map(p => ({
    sku:   p.sku || p.itemNo || p.article || "",
    title: p.title || p.name || "",
    url:   p.url || p.link || "",
    img:   p.img || p.image || "",
    price: (p.price ?? p.unitPrice ?? ""),
    moq:   (p.moq ?? p.minQty ?? "")
  }));
}

// ---------- fallback renderer ----------
function renderRowsFallback(rows) {
  if (!$tbody || !$tbl || !$empty) return;

  // 清空
  $tbody.innerHTML = "";

  if (!rows || !rows.length) {
    $tbl.style.display = 'none';
    $empty.style.display = 'block';
    return;
  }

  // 显示表格
  $empty.style.display = 'none';
  $tbl.style.display = 'table';

  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.sku || ''}</td>
      <td>${r.img ? `<img src="${r.img}" style="height:36px">` : ''}</td>
      <td>${r.title || ''}</td>
      <td>${r.moq || ''}</td>
      <td>${r.price || ''}</td>
      <td>${r.url ? `<a href="${r.url}" target="_blank">${T('link_text') || '链接'}</a>` : ''}</td>
    `;
    $tbody.appendChild(tr);
  });
}

// ---------- fetch catalog ----------
async function handleFetch() {
  const u = ($url.value || '').trim();
  if (!u) {
    showToast(false, T('toast_need_url') || '请输入链接');
    return;
  }
  const previewN = parseInt($selPreview?.value || '50', 10);

  try {
    showToast(true, T('fetch_loading') || 'Loading…');
    const resp = await fetch(`${API_BASE}/catalog/parse?url=${encodeURIComponent(u)}`);
    if (!resp.ok) {
      // 例如 404 时，直接把文本扔给错误提示
      const txt = await resp.text();
      throw new Error(`${resp.status} ${resp.statusText} — ${txt.replace(/\s+/g,' ').slice(0,160)}`);
    }
    const json = await resp.json();
    const items = normalizeItems(json);

    __rows = items.slice(0, previewN);

    // 若页面提供了自定义渲染器，就走它；否则走内建回退渲染器
    if (typeof window.renderRows === 'function') {
      window.renderRows(__rows);
    } else {
      renderRowsFallback(__rows);
    }

    // 绿色提示交给页面顶上那块（如果已经有）；这里不重复
    hideToast();
  } catch (err) {
    console.error('[fetch:fail]', err);
    showToast(false, `${T('fetch_fail') || '抓取失败'}: ${err.message || err}`);
    // 抓取失败也切换到“暂无数据”
    renderRowsFallback([]);
  }
}

// ---------- image proxy (for Excel embedding) ----------
async function fetchProxyImageAsBase64(imgUrl) {
  const r = await fetch(`${API_BASE}/image?url=${encodeURIComponent(imgUrl)}`);
  if (!r.ok) throw new Error(`image ${r.status}`);
  const { base64 } = await r.json(); // 后端返回 { base64:"..." }
  return base64;
}

// ---------- export ----------
async function exportExcelWithImages(rows) {
  if (!rows || !rows.length) {
    showToast(false, T('export_fail_nodata') || '导出失败：无数据');
    return;
  }
  showToast(true, T('export_generating') || '正在生成 Excel…');

  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Items');
    ws.addRow(['#','Item No.','Picture','Description','MOQ','Unit Price', T('link_text') || '链接']);
    ws.getColumn(1).width=5;  ws.getColumn(2).width=14; ws.getColumn(3).width=14;
    ws.getColumn(4).width=60; ws.getColumn(5).width=10; ws.getColumn(6).width=14; ws.getColumn(7).width=30;

    for (let i=0; i<rows.length; i++) {
      const r = rows[i];
      const row = ws.addRow([
        i+1, r.sku||'', '', r.title||'', r.moq||'', r.price||'',
        r.url ? { text: (T('link_text')||'链接'), hyperlink:r.url } : ''
      ]);
      row.height = 52;

      if (r.img) {
        try {
          const b64 = await fetchProxyImageAsBase64(r.img);
          if (b64) {
            const ext = (r.img.split('.').pop()||'jpg').toLowerCase();
            const usePng = ext.includes('png');
            const imgId = wb.addImage({
              base64: `data:${usePng?'image/png':'image/jpeg'};base64,${b64}`,
              extension: usePng ? 'png' : 'jpeg'
            });
            ws.addImage(imgId, { tl:{ col:2, row: row.number-1 }, ext:{ width:90, height:50 } });
          }
        } catch(e) { /* 单图失败忽略 */ }
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `yunivera-${Date.now()}.xlsx`);
    showToast(true, T('export_done') || 'Excel 已导出');
    setTimeout(hideToast, 1200);
  } catch (err) {
    console.error('[export:fail]', err);
    showToast(false, `${T('export_fail')||'导出失败'}：${err.message||err}`);
  }
}

async function handleExport() {
  if (!__rows || !__rows.length) {
    showToast(false, T('toast_zero', { m: 0 }) || '暂无数据');
    return;
  }
  await exportExcelWithImages(__rows);
}

function handleClear() {
  __rows = [];
  renderRowsFallback([]);
  hideToast();
}

// ---------- bind ----------
$btnFetch   && $btnFetch.addEventListener('click', handleFetch);
$btnExport  && $btnExport.addEventListener('click', handleExport);
$btnClear   && $btnClear.addEventListener('click', handleClear);
$url        && $url.addEventListener('keydown', e => { if (e.key === 'Enter') handleFetch(); });
$selPreview && $selPreview.addEventListener('change', () => {
  if (!__rows?.length) return;
  const n = parseInt($selPreview.value || '50', 10);
  const part = __rows.slice(0, n);
  if (typeof window.renderRows === 'function') window.renderRows(part);
  else renderRowsFallback(part);
});
