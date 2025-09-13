/* ui-enhance.js — MVP3 前端逻辑（抓取 + 富化 + 导出内嵌图）
   依赖：
   - window.i18n（来自 public/i18n.js）
   - ExcelJS、FileSaver（index.html 已引入）
*/

(function () {
  // ---------- DOM ----------
  const $url = document.getElementById('txtUrl');
  const $btnFetch = document.getElementById('btnFetch');
  const $btnExport = document.getElementById('btnExport');
  const $btnClear = document.getElementById('btnClear');
  const $selPreview = document.getElementById('selPreview');
  const $toast = document.getElementById('toast');

  // 如果页面没放“富化价格/MOQ”的复选框，这里自动插入一个
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

  // ---------- 状态 ----------
  let __rows = []; // 最近一次拉到的“全量”数据（未截取）
  let __apiBase = null;

  // ---------- 修复后的 API 基址解析 ----------
  function getApiBase() {
    if (__apiBase) return __apiBase;

    const cur = new URL(location.href);
    let api = (cur.searchParams.get("api") || "").trim();

    // 1) 页面未带 ?api= 参数，默认同源 /v1/api
    if (!api) {
      __apiBase = `${location.origin}/v1/api`;
      return __apiBase;
    }

    // 2) 去掉收尾多余的斜杠
    api = api.replace(/\/+$/, "");

    // 3) 去掉错误尾巴 /__version
    api = api.replace(/\/__version$/i, "");

    // 4) 规范化为“…/v1/api”
    try {
      const u = new URL(api);
      if (/\/v1\/api(\/.*)?$/i.test(u.pathname)) {
        // 已包含 /v1/api，则截到 /v1/api
        const match = u.pathname.match(/^(.*?\/v1\/api)/i);
        api = u.origin + (match ? match[1] : "/v1/api");
      } else {
        // 补上 /v1/api
        api = (api.replace(/\/+$/, "")) + "/v1/api";
      }
    } catch {
      // 相对路径情况
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
    // 后端兼容：可能是 resp.products 或 resp.items
    const arr = Array.isArray(resp?.products) ? resp.products
            : Array.isArray(resp?.items) ? resp.items
            : [];
    // 统一字段：sku/title/img/price/moq/url
    return arr.map(x => ({
      sku: x.sku || '',
      title: x.title || x.name || '',
      img: x.img || x.image || '',
      price: x.price ?? '',
      moq: x.moq ?? '',
      url: x.url || x.link || '',
    }));
  }

  // 把 ArrayBuffer 转 base64
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
      // 注意：getApiBase 已返回以 /v1/api 结尾的基址，这里不要再拼 /v1/api
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
      showToast(false, '无数据可导出');
      return;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Items');

    ws.addRow(['#', 'Item No.', 'Picture', 'Description', 'MOQ', 'Unit Price', i18n.t('link_text')]);

    // 列宽/样式
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 14; // 图片列
    ws.getColumn(4).width = 60;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 30;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const excelRow = ws.addRow([
        i + 1,
        r.sku || '',
        '', // 图片占位
        r.title || '',
        r.moq || '',
        r.price || '',
        r.url ? { text: i18n.t('link_text'), hyperlink: r.url } : ''
      ]);
      // 行高适配图片
      excelRow.height = 52;

      // 内嵌图片（通过后端代理）
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
            // 图片插入：第3列（col=3）对应“Picture”
            const rowIdx = excelRow.number;
            ws.addImage(imageId, {
              tl: { col: 2, row: rowIdx - 1 }, // (col从0开始) -> 第3列即 2
              ext: { width: 90, height: 50 }
            });
          }
        } catch {}
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `yunivera-${Date.now()}.xlsx`);
  }

  // ---------- 核心：抓取 ----------
  async function handleFetch() {
    hideToast();

    const url = ($url.value || '').trim();
    if (!url) {
      showToast(false, '请先粘贴目录型页面链接');
      return;
    }

    // 预览数量 & 富化
    const previewN = parseInt($selPreview.value || '50', 10) || 50;
    const enrich = !!($chkEnrich && $chkEnrich.checked);

    try {
      const api = getApiBase();
      const qs = new URLSearchParams({
        url,
        limit: String(Math.max(previewN, 50)), // 后端 limit 至少给大一些，前端再截
        enrich: enrich ? 'true' : 'false'
      }).toString();

      const t0 = Date.now();
      // 注意：基址已是 /v1/api，避免重复拼接
      const resp = await fetch(`${api}/catalog/parse?${qs}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      const items = normalizeItems(json);
      __rows = items.slice(); // 保存全量
      const previewRows = items.slice(0, previewN);

      // 让 index.html 里的渲染函数来画表格 & 成功提示
      if (typeof window.renderRows === 'function') {
        window.renderRows(previewRows);
      } else {
        showToast(true, `抓取成功：共 ${items.length} 条（预览前 ${previewN} 条）`);
      }

      // 控制台简单埋点
      console.log('[fetch:done]', { url, count: items.length, ms: Date.now() - t0, enrich });
    } catch (err) {
      console.error('[fetch:fail]', err);
      showToast(false, `抓取失败：${String(err.message || err)}`);
    }
  }

  // ---------- 导出 ----------
  async function handleExport() {
    try {
      if (!__rows || !__rows.length) {
        showToast(false, '暂无数据可导出');
        return;
      }
      await exportExcelWithImages(__rows);
    } catch (err) {
      console.error('[export:fail]', err);
      showToast(false, `导出失败：${String(err.message || err)}`);
    }
  }

  // ---------- 清空 ----------
  function handleClear() {
    __rows = [];
    // 页面渲染层的“清空”已经在 index.html 里实现，这里只清内存
  }

  // ---------- 绑定 ----------
  if ($btnFetch)  $btnFetch.addEventListener('click', handleFetch);
  if ($btnExport) $btnExport.addEventListener('click', handleExport);
  if ($btnClear)  $btnClear.addEventListener('click', handleClear);

  // 回车触发抓取
  if ($url) $url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleFetch();
  });

  // 初始占位提示（多语言）
  if ($url && window.i18n) {
    $url.setAttribute('placeholder', i18n.t('input_placeholder'));
  }
})();
