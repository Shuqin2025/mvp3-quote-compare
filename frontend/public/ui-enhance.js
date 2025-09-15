/* MVP3 ui-enhance.js (browser) - 2025-09-14 stableA
 * - Fix ItemNo mapping (smart fallback from URL)
 * - Embed images into Excel (no Buffer; ArrayBuffer only)
 * - Price placeholder when missing
 */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const API_BASE = new URLSearchParams(location.search).get('api') || '';
  const els = {
    url: $('input[type="text"], #url, #input-url') || $('input'),
    btnFetch: $$('button').find(b => /抓取目录/.test(b.textContent)) || $('button[data-action="fetch"]'),
    btnExport: $$('button').find(b => /导出\s*Excel/.test(b.textContent)) || $('button[data-action="export"]'),
    selectLimit: $$('select').find(s => /预览/.test(s.parentElement?.textContent||'') || /预览/.test(s.title||'')) || $('select'),
    tableBody: $('table tbody') || $('tbody'),
    banner: $('.js-banner') || null,
  };

  let currentData = []; // normalized list we render/export

  /** utils **/
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function extFromUrl(u = '') {
    const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(u);
    let ext = (m?.[1] || 'jpg').toLowerCase();
    if (ext === 'jpg') ext = 'jpeg';
    return ext;
  }
  function priceOrPlaceholder(p) {
    if (!p || (typeof p === 'string' && !p.trim())) return '€ 0,00';
    return p;
  }
  // 看起来像编号：纯数字，或数字-数字 这类
  const isCodeLike = (s) => /^\s*\d+(?:-\d+)*\s*$/.test(String(s||''));
  // 从 url 尾部提取 id，例如 .../xxx,21,80.html -> 80
  function idFromUrl(u='') {
    const m = /,(\d+)\.html(?:[?#].*)?$/i.exec(u);
    return m ? m[1] : '';
  }
  // 规范化 ItemNo：优先 sku；不行就用 URL id；仍不行留空
  function normalizeItemNo(item) {
    const sku = (item.sku ?? '').toString().trim();
    if (isCodeLike(sku)) return sku;
    const fromUrl = idFromUrl(item.url || '');
    if (isCodeLike(fromUrl)) return fromUrl;
    return '';
  }

  /** render table **/
  function renderTable(items) {
    currentData = items.map((x, i) => ({
      idx: i + 1,
      sku: normalizeItemNo(x),
      title: (x.title ?? '').toString().trim() || '—',
      url: x.url || '',
      img: x.img || '',
      price: priceOrPlaceholder(x.price),
      moq: (x.moq ?? '').toString().trim() || '—'
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

  /** fetch catalog via backend **/
  async function fetchCatalog() {
    try {
      const url = (els.url?.value || '').trim();
      if (!url) return;
      const limit = parseInt(els.selectLimit?.value || '50', 10) || 50;

      console.log('[mvp3] action: fetch', url, {limit});
      const t0 = Date.now();
      const resp = await fetch(`${API_BASE}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${limit}`, {
        method: 'GET',
        mode: 'cors',
      });
      const json = await resp.json();

      // 后端既可能给 products，也可能给 items；优先 items
      const list = Array.isArray(json?.items) && json.items.length
        ? json.items
        : (Array.isArray(json?.products) ? json.products : []);

      // 渲染
      renderTable(list);

      // 顶部提示
      const okMsg = `抓取成功：共 ${list.length} 条（预览前 ${Math.min(list.length, limit)} 条）`;
      const tip = document.querySelector('.alert.alert-warning') || document.querySelector('.js-tip');
      if (tip) tip.textContent = okMsg;
      console.log('[mvp3] done fetch in', Date.now() - t0, 'ms');
    } catch (err) {
      console.error('[mvp3] fetch error', err);
      alert('抓取失败：' + (err?.message || err));
    }
  }

  /** export to excel **/
  async function exportExcel() {
    if (!window.ExcelJS) {
      alert('ExcelJS 未加载');
      return;
    }
    const ExcelJS = window.ExcelJS;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');

    // columns
    ws.columns = [
      { header: 'Item No.', key: 'sku', width: 18 },
      { header: 'Picture', key: 'pic', width: 22 },
      { header: 'Description', key: 'title', width: 60 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Unit Price', key: 'price', width: 14 },
      { header: 'Link', key: 'link', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    // 写行（先写文本，再补图）
    const rowsMeta = [];
    for (const row of currentData) {
      const r = ws.addRow({
        sku: row.sku || '',
        pic: '', // 留空，后面插图
        title: row.title,
        moq: row.moq,
        price: row.price,
        link: { text: '链接', hyperlink: row.url || '' },
      });

      // 设置行高，方便显示缩略图
      r.height = 78;

      rowsMeta.push({ excelRow: r.number, img: row.img });
    }

    // 嵌图（顺序拉取，确保稳定；如需极致速度可并发但要控制同域连接数）
    for (const meta of rowsMeta) {
      const imgUrl = meta.img;
      if (!imgUrl) continue;

      try {
        const proxy = `${API_BASE}/v1/api/image?url=${encodeURIComponent(imgUrl)}`;
        const res = await fetch(proxy, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();

        if (buf.byteLength === 0) throw new Error('empty image');

        const ext = extFromUrl(imgUrl); // jpeg/png/gif/webp…
        const imgId = wb.addImage({ buffer: buf, extension: ext });

        // Picture 列是第2列（B 列）；anchor 使用 0-based col/row
        const rowIdx0 = meta.excelRow - 1;
        ws.addImage(imgId, {
          tl: { col: 1, row: rowIdx0 },          // B列
          ext: { width: 120, height: 70 },
          editAs: 'oneCell',
        });
        console.log('[xlsx] embed image ok:', imgUrl);
      } catch (err) {
        console.warn('[xlsx] embed image failed:', imgUrl, err?.message || err);
        continue;
      }
    }

    // 下载
    const filename = `catalog-preview-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now()}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();

    // 顶部提示
    const tip = document.querySelector('.alert.alert-info') || document.querySelector('.js-export-tip');
    if (tip) tip.textContent = '已导出 Excel（含图片、价格占位符）';
    console.log('[mvp3] action: export', filename);
  }

  /** bind **/
  els?.btnFetch?.addEventListener('click', fetchCatalog);
  els?.btnExport?.addEventListener('click', exportExcel);

  // 支持回车
  els?.url?.addEventListener?.('keydown', e => {
    if (e.key === 'Enter') fetchCatalog();
  });

  // 小健康检查
  (async () => {
    try { await fetch(`${API_BASE}/health`, { mode: 'cors' }); } catch {}
  })();
})();
