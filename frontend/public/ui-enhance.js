/* MVP3 ui-enhance.js (browser) - 2025-09-15 stableB
 * - Embed images into Excel via Base64 (no Buffer in browser)
 * - Price placeholder when missing (€ 0,00)
 * - Gentle ItemNo fallback from URL (optional)
 */

(() => {
  /** ---------- tiny dom helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** ---------- config / refs ---------- */
  const API_BASE = new URLSearchParams(location.search).get('api') || '';
  const els = {
    url: $('input[type="text"], #url, #input-url') || $('input'),
    btnFetch: $$('button').find(b => /抓取目录/.test(b.textContent)) || $('button[data-action="fetch"]'),
    btnExport: $$('button').find(b => /导出\s*Excel/.test(b.textContent)) || $('button[data-action="export"]'),
    selectLimit: $$('select').find(s => /预览/.test(s.parentElement?.textContent || '') || /预览/.test(s.title || '')) || $('select'),
    tableBody: $('table tbody') || $('tbody'),
    tip: $('.alert.alert-warning, .js-tip') || null,
    tipExport: $('.alert.alert-info, .js-export-tip') || null,
  };

  /** ---------- state ---------- */
  let currentData = []; // 标准化后的列表，既用于渲染，也用于导出

  /** ---------- utils ---------- */
  const priceOrPlaceholder = (p) => (!p || (typeof p === 'string' && !p.trim())) ? '€ 0,00' : p;

  // 看起来像编号：纯数字，或数字-数字
  const isCodeLike = (s) => /^\s*\d+(?:-\d+)*\s*$/.test(String(s || ''));

  // 从 url 尾部提取 id，例如 .../xxx,21,80.html -> 80
  const idFromUrl = (u = '') => {
    const m = /,(\d+)\.html(?:[?#].*)?$/i.exec(u);
    return m ? m[1] : '';
  };

  // 规范化 ItemNo：优先后端的 sku；不行用 URL 里的尾号；否则留空
  const normalizeItemNo = (item) => {
    const sku = (item.sku ?? '').toString().trim();
    if (isCodeLike(sku)) return sku;
    const fromUrl = idFromUrl(item.url || '');
    if (isCodeLike(fromUrl)) return fromUrl;
    return '';
  };

  // 从 URL 猜测图片扩展名；ExcelJS 需要 png/jpeg/gif/webp 等
  const extFromUrl = (u = '') => {
    const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(u);
    let ext = (m?.[1] || 'jpg').toLowerCase();
    if (ext === 'jpg') ext = 'jpeg';
    return ext;
  };

  // ArrayBuffer -> base64（分片，避免 call stack 爆）
  const ab2b64 = (buf) => {
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  // 通过后端代理，把图片取回并转成 dataURL base64
  async function fetchImageBase64(imgUrl) {
    const proxy = `${API_BASE}/v1/api/image?url=${encodeURIComponent(imgUrl)}`;
    const res = await fetch(proxy, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) throw new Error('empty image');
    const ext = extFromUrl(imgUrl);               // e.g. jpeg/png/webp
    const base64 = ab2b64(buf);
    // ExcelJS 支持 { base64, extension }，这里同时附带 dataURL 头更清晰
    const dataURL = `data:image/${ext};base64,${base64}`;
    return { dataURL, ext };
  }

  /** ---------- render table ---------- */
  function renderTable(items) {
    currentData = items.map((x, i) => ({
      idx: i + 1,
      sku: normalizeItemNo(x),
      title: (x.title ?? '').toString().trim() || '—',
      url: x.url || '',
      img: x.img || '',
      price: priceOrPlaceholder(x.price),
      moq: (x.moq ?? '').toString().trim() || '—',
    }));

    const tbody = els.tableBody;
    if (!tbody) return;

    tbody.innerHTML = '';
    for (const row of currentData) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.idx}</td>
        <td>${row.sku || '—'}</td>
        <td><img src="${row.img || ''}" style="height:54px;max-width:92px;object-fit:contain;border-radius:4px;background:#fff"/></td>
        <td>${row.title}</td>
        <td>${row.moq}</td>
        <td>${row.price}</td>
        <td><a href="${row.url}" target="_blank" rel="noreferrer">链接</a></td>
      `;
      tbody.appendChild(tr);
    }
  }

  /** ---------- fetch catalog ---------- */
  async function fetchCatalog() {
    try {
      const url = (els.url?.value || '').trim();
      if (!url) return;
      const limit = parseInt(els.selectLimit?.value || '50', 10) || 50;

      console.log('[mvp3] action: fetch', url, { limit });
      const resp = await fetch(`${API_BASE}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${limit}`, {
        method: 'GET',
        mode: 'cors',
      });
      const json = await resp.json();

      // 后端既可能给 products，也可能给 items；优先 items
      const list = Array.isArray(json?.items) && json.items.length
        ? json.items
        : (Array.isArray(json?.products) ? json.products : []);

      renderTable(list);

      const okMsg = `抓取成功：共 ${list.length} 条（预览前 ${Math.min(list.length, limit)} 条）`;
      els.tip && (els.tip.textContent = okMsg);
    } catch (err) {
      console.error('[mvp3] fetch error', err);
      alert('抓取失败：' + (err?.message || err));
    }
  }

  /** ---------- export to excel ---------- */
  async function exportExcel() {
    if (!window.ExcelJS) {
      alert('ExcelJS 未加载');
      return;
    }
    const ExcelJS = window.ExcelJS;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');

    // 列定义
    ws.columns = [
      { header: 'Item No.',   key: 'sku',   width: 18 },
      { header: 'Picture',    key: 'pic',   width: 22 },
      { header: 'Description',key: 'title', width: 60 },
      { header: 'MOQ',        key: 'moq',   width: 10 },
      { header: 'Unit Price', key: 'price', width: 14 },
      { header: 'Link',       key: 'link',  width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    // 先写文本，再插入图片（行高稍微大一些方便缩略图）
    const rowsMeta = [];
    for (const row of currentData) {
      const r = ws.addRow({
        sku: row.sku || '',
        pic: '',
        title: row.title,
        moq: row.moq,
        price: row.price,
        link: row.url ? { text: '链接', hyperlink: row.url } : '',
      });
      r.height = 78;
      rowsMeta.push({ excelRow: r.number, img: row.img });
    }

    // 逐行嵌入图片（稳妥起见串行；如需更快可做小并发队列）
    for (const meta of rowsMeta) {
      const imgUrl = meta.img;
      if (!imgUrl) continue;

      try {
        const { dataURL, ext } = await fetchImageBase64(imgUrl);
        const imgId = wb.addImage({ base64: dataURL, extension: ext });

        // Picture 列是第 2 列（B 列）；anchor 使用 0-based col/row
        const rowIdx0 = meta.excelRow - 1;
        ws.addImage(imgId, {
          tl:  { col: 1, row: rowIdx0 },  // B列
          ext: { width: 120, height: 70 },
          editAs: 'oneCell',
        });

        console.log('[xlsx] embed image ok:', imgUrl);
      } catch (err) {
        console.warn('[xlsx] embed image failed:', imgUrl, err?.message || err);
      }
    }

    // 下载 xlsx
    const filename = `catalog-preview-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now()}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();

    els.tipExport && (els.tipExport.textContent = '已导出 Excel（含图片、价格占位符）');
    console.log('[mvp3] action: export', filename);
  }

  /** ---------- bind ---------- */
  els?.btnFetch?.addEventListener('click', fetchCatalog);
  els?.btnExport?.addEventListener('click', exportExcel);

  // 输入框回车触发抓取
  els?.url?.addEventListener?.('keydown', (e) => {
    if (e.key === 'Enter') fetchCatalog();
  });

  // 健康检查（非阻塞）
  (async () => { try { await fetch(`${API_BASE}/health`, { mode: 'cors' }); } catch {} })();
})();
