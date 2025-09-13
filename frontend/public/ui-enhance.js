// ---------- helpers ----------
const API_BASE = (function () {
  try {
    const p = new URL(location.href).searchParams.get("api");
    return p ? p.replace(/\/+$/,'') : "/v1/api";
  } catch { return "/v1/api"; }
})();

const __toastEl = document.getElementById('toast');
function showToast(ok, text){
  if (window.__showToast) return window.__showToast(ok, text);
  __toastEl.className = 'alert ' + (ok ? 'alert-ok' : 'alert-warn');
  __toastEl.style.display = 'block';
  __toastEl.textContent = text;
}
function hideToast(){ if(window.__hideToast) return window.__hideToast(); __toastEl.style.display='none'; }

const T = (k,v)=> (window.__T ? window.__T(k,v) : k);

// ---------- DOM ----------
const $url  = document.getElementById('txtUrl');
const $btnFetch  = document.getElementById('btnFetch');
const $btnExport = document.getElementById('btnExport');
const $btnClear  = document.getElementById('btnClear');
const $selPreview= document.getElementById('selPreview');

let __rows = []; // 缓存当前预览行

// ---------- normalize ----------
function normalizeItems(data){
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

// ---------- fetch catalog ----------
async function handleFetch(){
  const u = ($url.value || '').trim();
  if (!u){
    showToast(false, '请输入链接');
    return;
  }
  const previewN = parseInt($selPreview.value || '50', 10);

  try{
    showToast(true, 'Loading…');
    const resp = await fetch(`${API_BASE}/catalog/parse?url=${encodeURIComponent(u)}`);
    const json = await resp.json();

    const items = normalizeItems(json);
    __rows = items.slice(0, previewN);
    if (window.renderRows) window.renderRows(__rows);
    else showToast(true, `OK (${__rows.length})`);
  }catch(err){
    console.error('[fetch:fail]', err);
    showToast(false, `抓取失败: ${err.message || err}`);
  }
}

// ---------- image proxy (for Excel embedding) ----------
async function fetchProxyImageAsBase64(imgUrl){
  const r = await fetch(`${API_BASE}/image?url=${encodeURIComponent(imgUrl)}`);
  if (!r.ok) throw new Error(`image ${r.status}`);
  const { base64 } = await r.json(); // 后端已返回 {base64:"..."}
  return base64;
}

// ---------- export ----------
async function exportExcelWithImages(rows){
  if (!rows || !rows.length){
    showToast(false, '导出失败：无数据');
    return;
  }
  showToast(true, T('export_generating') || '正在生成 Excel…');
  try{
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Items');
    ws.addRow(['#','Item No.','Picture','Description','MOQ','Unit Price', T('link_text') || '链接']);
    ws.getColumn(1).width=5; ws.getColumn(2).width=14; ws.getColumn(3).width=14; ws.getColumn(4).width=60; ws.getColumn(5).width=10; ws.getColumn(6).width=14; ws.getColumn(7).width=30;

    for (let i=0;i<rows.length;i++){
      const r = rows[i];
      const row = ws.addRow([i+1, r.sku||'', '', r.title||'', r.moq||'', r.price||'', r.url ? { text: (T('link_text')||'链接'), hyperlink:r.url } : '' ]);
      row.height = 52;

      if (r.img){
        try{
          const b64 = await fetchProxyImageAsBase64(r.img);
          if (b64){
            const ext = (r.img.split('.').pop()||'jpg').toLowerCase();
            const usePng = ext.includes('png');
            const imgId = wb.addImage({ base64:`data:${usePng?'image/png':'image/jpeg'};base64,${b64}`, extension: usePng?'png':'jpeg' });
            ws.addImage(imgId, { tl:{ col:2, row: row.number-1 }, ext:{ width:90, height:50 } });
          }
        }catch(e){ /* 忽略单图失败 */ }
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `yunivera-${Date.now()}.xlsx`);
    showToast(true, T('export_done') || 'Excel 已导出');
    setTimeout(hideToast, 1200);
  }catch(err){
    console.error('[export:fail]', err);
    showToast(false, `${T('export_fail')||'导出失败'}：${err.message||err}`);
  }
}

async function handleExport(){
  if (!__rows || !__rows.length){
    showToast(false, T('toast_zero', {m:0}) || '暂无数据');
    return;
  }
  await exportExcelWithImages(__rows);
}

function handleClear(){
  __rows = [];
  if (document.getElementById('tbody')){
    document.getElementById('tbody').innerHTML = '';
  }
  const tbl = document.getElementById('tbl');
  const empty = document.getElementById('empty');
  if (tbl) tbl.style.display='none';
  if (empty) empty.style.display='block';
  hideToast();
}

// ---------- bind ----------
$btnFetch && $btnFetch.addEventListener('click', handleFetch);
$btnExport && $btnExport.addEventListener('click', handleExport);
$btnClear && $btnClear.addEventListener('click', handleClear);
$url && $url.addEventListener('keydown', e => { if (e.key==='Enter') handleFetch(); });
