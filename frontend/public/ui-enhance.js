// --- i18n 兜底：无论 i18n.js 是否加载成功，这里都不会报错 ---
const T = (key, vars = {}) => {
  try {
    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, vars);
    }
  } catch (e) {}
  const fallback = {
    'link_text': '链接',
    'toast_zero': '暂无数据（预览前 {{m}} 条）',
    'toast_success': '抓取成功：共 {{n}} 条（预览前 {{m}} 条）',
    'export_generating': '正在生成 Excel…',
    'export_done': 'Excel 已导出',
    'export_fail': '导出失败'
  };
  let txt = fallback[key] || key;
  Object.keys(vars || {}).forEach(k => {
    txt = txt.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), vars[k]);
  });
  return txt;
};

/* ui-enhance.js — MVP3 前端逻辑（抓取 + 富化 + 导出内嵌图） */
(function () {
  const $url = document.getElementById('txtUrl');
  const $btnFetch = document.getElementById('btnFetch');
  const $btnExport = document.getElementById('btnExport');
  const $btnClear = document.getElementById('btnClear');
  const $selPreview = document.getElementById('selPreview');
  const $toast = document.getElementById('toast');

  (function ensureEnrichCheckbox() {
    const toolbar = $btnFetch?.parentElement;
    if (!toolbar) return;
    if (document.getElementById('chkEnrich')) return;
    const box = document.createElement('label');
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.gap = '6px';
    box.style.marginLeft = '4px';
    box.innerHTML = `<input id="chkEnrich" type="checkbox"/> <span>富化价格/MOQ</span>`;
    toolbar.appendChild(box);
  })();
  const $chkEnrich = document.getElementById('chkEnrich');

  let __rows = [];
  let __apiBase = null;

  function getApiBase() {
    if (__apiBase) return __apiBase;
    const cur = new URL(location.href);
    let api = (cur.searchParams.get("api") || "").trim();
    if (!api) {
      __apiBase = `${location.origin}/v1/api`;
      return __apiBase;
    }
    api = api.replace(/\/+$/, "");
    api = api.replace(/\/__version$/i, "");
    try {
      const u = new URL(api);
      if (/\/v1\/api(\/.*)?$/i.test(u.pathname)) {
        const match = u.pathname.match(/^(.*?\/v1\/api)/i);
        api = u.origin + (match ? match[1] : "/v1/api");
      } else {
        api = (api.replace(/\/+$/, "")) + "/v1/api";
      }
    } catch {
      api = location.origin + "/" + api.replace(/^\/+/, "");
      if (!/\/v1\/api(\/.*)?$/i.test(new URL(api).pathname)) {
        api = api.replace(/\/+$/, "") + "/v1/api";
      }
    }
    __apiBase = api.replace(/\/+$/, "");
    return __apiBase;
  }

  function showToast(ok, text) {
    $toast.className = 'alert ' + (ok ? 'alert-ok' : 'alert-warn');
    $toast.style.display = 'block';
    $toast.textContent = text;
  }
  function hideToast() { $toast.style.display = 'none'; }

  function normalizeItems(resp) {
    const arr = Array.isArray(resp?.products) ? resp.products
            : Array.isArray(resp?.items) ? resp.items
            : [];
    return arr.map(x => ({
      sku: x.sku || '',
      title: x.title || x.name || '',
      img: x.img || x.image || '',
      price: x.price ?? '',
      moq: x.moq ?? '',
      url: x.url || x.link || '',
    }));
  }

  function ab2b64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function fetchProxyImageAsBase64(imgUrl) {
    if (!imgUrl) return null;
    try {
      const api = getApiBase();
      const resp = await fetch(`${api}/image?url=${encodeURIComponent(imgUrl)}`);
      if (!resp.ok) return null;
      const buf = await resp.arrayBuffer();
      return ab2b64(buf);
    } catch {
      return null;
    }
  }

  async function exportExcelWithImages(rows) {
    if (!rows || !rows.length) {
      showToast(false, T('export_fail'));
      return;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Items');
    ws.addRow(['#', 'Item No.', 'Picture', 'Description', 'MOQ', 'Unit Price', T('link_text')]);
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 60;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 30;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const excelRow = ws.addRow([
        i + 1,
        r.sku || '',
        '',
        r.title || '',
        r.moq || '',
        r.price || '',
        r.url ? { text: T('link_text'), hyperlink: r.url } : ''
      ]);
      excelRow.height = 52;
      if (r.img) {
        try {
          const b64 = await fetchProxyImageAsBase64(r.img);
          if (b64) {
            const ext = (r.img.split('.').pop() || 'jpg').toLowerCase();
            const usePng = ext.includes('png');
            const mime = usePng ? 'image/png' : 'image/jpeg';
            const imageId = wb.addImage({
              base64: `data:${mime};base64,${b64}`,
              extension: usePng ? 'png' : 'jpeg'
            });
            const rowIdx = excelRow.number;
            ws.addImage(imageId, {
              tl: { col: 2, row: rowIdx - 1 },
              ext: { width: 90, height: 50 }
            });
          }
        } catch {}
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `yunivera-${Date.now()}.xlsx`);
  }

  async function handleFetch() {
    hideToast();
    const url = ($url.value || '').trim();
    if (!url) {
      showToast(false, '请先粘贴目录型页面链接');
      return;
    }
    const previewN = parseInt($selPreview.value || '50', 10) || 50;
    const enrich = !!($chkEnrich && $chkEnrich.checked);

    try {
      const api = getApiBase();
      const qs = new URLSearchParams({
        url,
        limit: String(Math.max(previewN, 50)),
        enrich: enrich ? 'true' : 'false'
      }).toString();
      const t0 = Date.now();
      const resp = await fetch(`${api}/catalog/parse?${qs}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const items = normalizeItems(json);
      __rows = items.slice();
      const previewRows = items.slice(0, previewN);
      if (typeof window.renderRows === 'function') {
        window.renderRows(previewRows);
      } else {
        showToast(true, T('toast_success', { n: items.length, m: previewN }));
      }
      console.log('[fetch:done]', { url, count: items.length, ms: Date.now() - t0, enrich });
    } catch (err) {
      console.error('[fetch:fail]', err);
      showToast(false, `抓取失败：${String(err.message || err)}`);
    }
  }

  async function handleExport() {
    try {
      if (!__rows || !__rows.length) {
        showToast(false, T('toast_zero', { m: 0 }));
        return;
      }
      await exportExcelWithImages(__rows);
    } catch (err) {
      console.error('[export:fail]', err);
      showToast(false, `${T('export_fail')}: ${String(err.message || err)}`);
    }
  }

  function handleClear() {
    __rows = [];
  }

  if ($btnFetch) $btnFetch.addEventListener('click', handleFetch);
  if ($btnExport) $btnExport.addEventListener('click', handleExport);
  if ($btnClear) $btnClear.addEventListener('click', handleClear);

  if ($url) $url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleFetch();
  });

  if ($url) {
    $url.setAttribute('placeholder', T('input_placeholder'));
  }
})();
