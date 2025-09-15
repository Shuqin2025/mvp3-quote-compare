/* MVP3 ui-enhance.js (browser) - 2025-09-15 stableB
 * - Excel 导出嵌入图片（ExcelJS）
 * - 兼容 catalog/parse 与 parse 两种后端
 * - 通过 {API}/v1/api/image 代理取图，避免 CORS
 * - 轻量 UI 恢复到简洁白卡样式
 */

(() => {
  /** ---------- tiny dom helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** ---------- config ---------- */
  const API_BASE = new URLSearchParams(location.search).get('api') || '';

  /** ---------- build UI skeleton if needed ---------- */
  function ensureLayout() {
    // 如果你的 React 已渲染完整 UI，这里什么都不做；
    // 如果是占位骨架/空白页，就注入一个简洁布局（与截图一致）。
    if ($('#mvp3-shell')) return;

    const root = $('#root') || document.body;
    const shell = document.createElement('div');
    shell.id = 'mvp3-shell';
    shell.innerHTML = `
      <div class="container">
        <div id="langSwitcher" style="display:flex;gap:8px;margin:6px 0 12px">
          <button class="btn">中文</button>
          <button class="btn">DE</button>
          <button class="btn">EN</button>
        </div>

        <h1 style="margin:8px 0 4px;font-size:24px;font-weight:700">云贸星 智能表格生成器</h1>
        <div style="color:#6b7280;margin-bottom:8px">输入目录型网页链接，秒生成 Excel 产品表格。</div>

        <div class="tool-row" style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
          <input id="input-url" class="url-input" placeholder="在此粘贴目录型页面链接（例如某一类目的商品列表页）" />
          <button id="btn-fetch" class="btn primary">抓取目录</button>
          <select id="sel-limit" class="btn">
            <option>50</option><option>100</option><option>200</option>
          </select>
          <button id="btn-export" class="btn">导出 Excel（.xlsx）</button>
          <button id="btn-clear" class="btn">清空数据</button>
        </div>

        <div class="alert alert-amber" id="js-tip">这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。</div>
        <div class="alert alert-green" id="js-export-tip" style="display:none">已导出 Excel（含图片、价格占位符）。</div>

        <div class="placeholder" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px">
          <table class="grid" style="width:100%;border-collapse:collapse" id="mvp3-table">
            <thead>
              <tr>
                <th style="width:48px">#</th>
                <th style="width:140px">Item No.</th>
                <th style="width:160px">Picture</th>
                <th>Description</th>
                <th style="width:100px">MOQ</th>
                <th style="width:120px">Unit Price</th>
                <th style="width:100px">Link</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="ft" style="color:#666;margin-top:12px;display:flex;gap:16px">
          <a href="#" style="color:#2563eb;text-decoration:none">支持的网站</a>
          <a href="#" style="color:#2563eb;text-decoration:none">隐私政策</a>
          <a href="#" style="color:#2563eb;text-decoration:none">联系我们</a>
        </div>
      </div>
    `;
    root.appendChild(shell);
  }

  ensureLayout();

  /** ---------- refs ---------- */
  const els = {
    url: $('input[type="text"], #url, #input-url') || $('input'),
    btnFetch: $('#btn-fetch') || $$('button').find(b => /抓取目录/.test(b.textContent)),
    btnExport: $('#btn-export') || $$('button').find(b => /导出\s*Excel/.test(b.textContent)),
    btnClear:  $('#btn-clear')  || $$('button').find(b => /清空/.test(b.textContent)),
    selectLimit: $('#sel-limit') || $('select'),
    tableBody: $('#mvp3-table tbody') || $('table tbody'),
    tip: $('#js-tip'),
    tipExport: $('#js-export-tip'),
  };

  /** ---------- state ---------- */
  let currentData = [];

  /** ---------- utils ---------- */
  const priceOrPlaceholder = (p) => (!p || (typeof p === 'string' && !p.trim())) ? '€ 0,00' : p;
  const isCodeLike = (s) => /^\s*\d+(?:-\d+)*\s*$/.test(String(s || ''));
  const idFromUrl = (u = '') => { const m = /,(\d+)\.html(?:[?#].*)?$/i.exec(u); return m ? m[1] : ''; };
  const normalizeItemNo = (item) => {
    const sku = (item.sku ?? '').toString().trim();
    if (isCodeLike(sku)) return sku;
    const fromUrl = idFromUrl(item.url || '');
    if (isCodeLike(fromUrl)) return fromUrl;
    return '';
  };
  const extFromUrl = (u = '') => {
    const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(u);
    let ext = (m?.[1] || 'jpg').toLowerCase();
    if (ext === 'jpg') ext = 'jpeg';
    return ext;
  };
  const ab2b64 = (buf) => {
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  async function fetchImageBase64(imgUrl) {
    // 你的后端图片代理：/v1/api/image?url=...（如无此路由，请按文末“后端补丁”添加）
    const proxy = `${API_BASE}/v1/api/image?url=${encodeURIComponent(imgUrl)}`;
    const res = await fetch(proxy, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) throw new Error('empty image');
    const ext = extFromUrl(imgUrl);
    const base64 = ab2b64(buf);
    const dataURL = `data:image/${ext};base64,${base64}`;
    return { dataURL, ext };
  }

  /** ---------- render ---------- */
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

  /** ---------- api: parse (with fallback) ---------- */
  async function parseCatalog(url, limit) {
    // 先试 /v1/api/catalog/parse（你截图里的路径），失败再试 /v1/api/parse
    const endpoints = [
      `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(url)}&limit=${limit}`,
      `${API_BASE}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${limit}`,
    ];
    let lastErr;
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, { method: 'GET', mode: 'cors' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const list = Array.isArray(j?.items) && j.items.length
          ? j.items
          : (Array.isArray(j?.products) ? j.products : []);
        if (list.length || j) return list;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('parse failed');
  }

  /** ---------- actions ---------- */
  async function fetchCatalog() {
    try {
      const url = (els.url?.value || '').trim();
      if (!url) return;
      const limit = parseInt(els.selectLimit?.value || '50', 10) || 50;

      const list = await parseCatalog(url, limit);
      renderTable(list);

      const okMsg = `抓取成功：共 ${list.length} 条（预览前 ${Math.min(list.length, limit)} 条）`;
      if (els.tip) { els.tip.textContent = okMsg; els.tip.style.display = 'block'; }
    } catch (err) {
      console.error('[mvp3] fetch error', err);
      alert('抓取失败：' + (err?.message || err));
    }
  }

  async function exportExcel() {
    if (!window.ExcelJS) { alert('ExcelJS 未加载'); return; }
    const ExcelJS = window.ExcelJS;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');

    ws.columns = [
      { header: 'Item No.',   key: 'sku',   width: 18 },
      { header: 'Picture',    key: 'pic',   width: 22 },
      { header: 'Description',key: 'title', width: 60 },
      { header: 'MOQ',        key: 'moq',   width: 10 },
      { header: 'Unit Price', key: 'price', width: 14 },
      { header: 'Link',       key: 'link',  width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

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

    // 串行嵌图（稳定），需要更快可做并发控制
    for (const meta of rowsMeta) {
      const imgUrl = meta.img;
      if (!imgUrl) continue;
      try {
        const { dataURL, ext } = await fetchImageBase64(imgUrl);
        const imgId = wb.addImage({ base64: dataURL, extension: ext });
        const rowIdx0 = meta.excelRow - 1; // 0-based
        ws.addImage(imgId, {
          tl:  { col: 1, row: rowIdx0 },  // B 列（Picture）
          ext: { width: 120, height: 70 },
          editAs: 'oneCell',
        });
      } catch (err) {
        console.warn('[xlsx] embed image failed:', imgUrl, err?.message || err);
      }
    }

    const filename = `catalog-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now()}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();

    if (els.tipExport) { els.tipExport.style.display = 'block'; }
  }

  function clearData() {
    currentData = [];
    if (els.tableBody) els.tableBody.innerHTML = '';
    if (els.tip) els.tip.textContent = 'ui_no_data';
  }

  /** ---------- bind ---------- */
  els?.btnFetch?.addEventListener('click', fetchCatalog);
  els?.btnExport?.addEventListener('click', exportExcel);
  els?.btnClear?.addEventListener('click', clearData);
  els?.url?.addEventListener?.('keydown', (e) => { if (e.key === 'Enter') fetchCatalog(); });

  // 健康检查（非阻塞）
  (async () => { try { await fetch(`${API_BASE}/health`, { mode: 'cors' }); } catch {} })();
})();
