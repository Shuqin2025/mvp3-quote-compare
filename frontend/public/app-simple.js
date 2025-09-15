// app-simple.js — single UI + i18n + image-embed Excel (2025-09-16)

(() => {

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const API_BASE = new URLSearchParams(location.search).get('api') || '';

  // ─────────── i18n ───────────
  const i18n = {
    zh: {
      title: '云贸星 智能表格生成器',
      subtitle: '输入目录型网页链接，秒生成 Excel 产品表格。',
      urlPh: '在此粘贴目录型页面链接（例如某一类目的商品列表页）',
      fetch: '抓取目录',
      export: '导出 Excel（.xlsx）',
      clear: '清空数据',
      th: ['#','货号','图片','描述','起订量','单价','链接'],
      okExport: '已导出 Excel（含图片、价格占位符）。',
      success: (n, m) => `抓取成功：共 ${n} 条（预览前 ${m} 条）`,
      pleaseFetch: '请先抓取目录再导出。',
      linkText: '链接',
      uiNoData: 'ui_no_data',
      failFetch: (e) => `抓取失败：${e}`,
      failExport: (e) => `导出失败：${e}`,
    },
    de: {
      title: 'Yunivera · Intelligenter Tabellen-Generator',
      subtitle: 'Fügen Sie einen Katalog-Link ein und erzeugen Sie sofort eine Excel-Tabelle.',
      urlPh: 'Katalog-/Kategorie-URL hier einfügen',
      fetch: 'Katalog abrufen',
      export: 'Excel exportieren (.xlsx)',
      clear: 'Daten leeren',
      th: ['#','Artikel-Nr.','Bild','Beschreibung','MOQ','Einzelpreis','Link'],
      okExport: 'Excel exportiert (mit Bildern).',
      success: (n, m) => `Erfolg: Insgesamt ${n} Einträge (zeige ${m}).`,
      pleaseFetch: 'Bitte zuerst Katalog abrufen.',
      linkText: 'Link',
      uiNoData: 'ui_no_data',
      failFetch: (e) => `Abruf fehlgeschlagen: ${e}`,
      failExport: (e) => `Export fehlgeschlagen: ${e}`,
    },
    en: {
      title: 'Yunivera · Smart Sheet Builder',
      subtitle: 'Paste a catalog URL and instantly create an Excel sheet.',
      urlPh: 'Paste a category/listing page URL here',
      fetch: 'Fetch Catalog',
      export: 'Export Excel (.xlsx)',
      clear: 'Clear',
      th: ['#','Item No.','Picture','Description','MOQ','Unit Price','Link'],
      okExport: 'Excel exported (with images).',
      success: (n, m) => `Success: ${n} items (showing ${m}).`,
      pleaseFetch: 'Fetch catalog before export.',
      linkText: 'Link',
      uiNoData: 'ui_no_data',
      failFetch: (e) => `Fetch failed: ${e}`,
      failExport: (e) => `Export failed: ${e}`,
    }
  };
  let lang = localStorage.getItem('mvp3_lang') || 'zh';
  function applyLang() {
    const t = i18n[lang];
    $('#title').textContent = t.title;
    $('#subtitle').textContent = t.subtitle;
    $('#url').placeholder = t.urlPh;
    $('#btnFetch').textContent = t.fetch;
    $('#btnExport').textContent = t.export;
    $('#btnClear').textContent = t.clear;
    $('#status').textContent = t.uiNoData;
    const ths = $('#tbl thead tr').children;
    t.th.forEach((tx, i) => ths[i].textContent = tx);
  }
  $('#langbar')?.addEventListener('click', e => {
    const l = e.target?.dataset?.lang;
    if (!l) return;
    lang = l; localStorage.setItem('mvp3_lang', lang); applyLang();
  });
  applyLang();

  // ─────────── helpers ───────────
  const isCodeLike = s => /^\s*\d+(?:-\d+)*\s*$/.test(String(s || ''));
  const idFromUrl = (u='') => { const m = /,(\d+)\.html(?:[?#].*)?$/i.exec(u); return m ? m[1] : ''; };
  const normalizeSku = it => {
    const sku = (it.sku ?? '').toString().trim();
    if (isCodeLike(sku)) return sku;
    const fromUrl = idFromUrl(it.url || '');
    if (isCodeLike(fromUrl)) return fromUrl;
    return sku || '';
  };
  const parseDataUrl = (dataURL) => {
    const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataURL || '');
    if (!m) return null;
    const ct = m[1].toLowerCase();
    let ext = 'jpeg';
    if (ct.includes('png')) ext = 'png';
    else if (ct.includes('webp')) ext = 'webp';
    else if (ct.includes('gif')) ext = 'gif';
    else if (ct.includes('bmp')) ext = 'bmp';
    return { raw: m[2], ext };
  };

  // ─────────── state ───────────
  let rows = [];

  // ─────────── render table ───────────
  function renderTable() {
    const tb = $('#tbl tbody');
    tb.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${r.sku || '—'}</td>
        <td>${r.img ? `<img src="${r.img}" style="height:54px;max-width:120px;object-fit:contain;border-radius:4px;background:#fff"/>` : ''}</td>
        <td>${r.title || '—'}</td>
        <td>${r.moq || '—'}</td>
        <td>${r.price || ''}</td>
        <td>${r.url ? `<a href="${r.url}" target="_blank" rel="noreferrer">${i18n[lang].linkText}</a>` : ''}</td>
      </tr>
    `).join('');
  }

  // ─────────── fetch catalog (base64 thumbnails) ───────────
  async function doFetch() {
    const t = i18n[lang];
    try {
      const url = ($('#url').value || '').trim();
      if (!url) return;
      const limit = parseInt($('#limit').value || '50', 10) || 50;

      const ep = `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(url)}&limit=${limit}&img=base64&imgCount=${limit}`;
      const r = await fetch(ep, { method: 'GET', mode: 'cors' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const list = Array.isArray(j?.items) && j.items.length ? j.items : (Array.isArray(j?.products) ? j.products : []);
      rows = list.map(x => ({
        sku: normalizeSku(x),
        title: (x.title ?? '').toString().trim() || '—',
        url: x.url || '',
        img: x.img_b64 || x.img || '',
        price: x.price || '',
        moq: (x.moq ?? '').toString().trim() || '—',
      }));
      renderTable();
      $('#status').textContent = t.success(rows.length, Math.min(rows.length, limit));
      $('#theadNote').textContent = url;
    } catch (e) {
      console.error(e);
      $('#status').textContent = t.failFetch(e.message || e);
    }
  }

  // ─────────── export to Excel (embed images) ───────────
  async function doExport() {
    const t = i18n[lang];
    if (!rows.length) { alert(t.pleaseFetch); return; }
    if (!window.ExcelJS) { alert('ExcelJS not loaded'); return; }
    const ExcelJS = window.ExcelJS;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');
    ws.columns = [
      { header: i18n[lang].th[1], key: 'sku', width: 18 },
      { header: i18n[lang].th[2], key: 'pic', width: 22 },
      { header: i18n[lang].th[3], key: 'title', width: 60 },
      { header: i18n[lang].th[4], key: 'moq', width: 10 },
      { header: i18n[lang].th[5], key: 'price', width: 14 },
      { header: i18n[lang].th[6], key: 'link', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    const metas = [];
    for (const r of rows) {
      const rr = ws.addRow({
        sku: r.sku || '',
        pic: '',
        title: r.title,
        moq: r.moq,
        price: r.price,
        link: r.url ? { text: i18n[lang].linkText, hyperlink: r.url } : '',
      });
      rr.height = 78;
      metas.push({ row: rr.number, img: r.img });
    }

    async function fetchB64ViaServer(imgUrl) {
      const ep = `${API_BASE}/v1/api/image64?url=${encodeURIComponent(imgUrl)}`;
      const r = await fetch(ep, { method: 'GET', mode: 'cors' });
      if (!r.ok) throw new Error(`image64 HTTP ${r.status}`);
      const j = await r.json();
      const parsed = parseDataUrl(j.base64);
      if (!parsed) throw new Error('bad base64');
      return parsed; // { raw, ext }
    }

    for (const m of metas) {
      try {
        let ext, raw;
        const parsed = parseDataUrl(m.img);
        if (parsed) { ext = parsed.ext; raw = parsed.raw; }
        if (!raw && m.img) {
          const p = await fetchB64ViaServer(m.img);
          ext = p.ext; raw = p.raw;
        }
        if (!raw) continue;

        const id = wb.addImage({ base64: raw, extension: ext || 'jpeg' });
        const r0 = m.row - 1;
        ws.addImage(id, { tl: { col: 1, row: r0 }, ext: { width: 120, height: 70 }, editAs: 'oneCell' });
      } catch (e) {
        console.warn('embed image failed:', m.img, e?.message || e);
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
    URL.revokeObjectURL(a.href); a.remove();

    const ok = $('#okbar'); ok.textContent = t.okExport; ok.style.display = 'block';
    setTimeout(() => ok.style.display = 'none', 2000);
  }

  // ─────────── wire up ───────────
  $('#btnFetch').addEventListener('click', doFetch);
  $('#btnExport').addEventListener('click', doExport);
  $('#btnClear').addEventListener('click', () => { rows = []; renderTable(); $('#status').textContent = i18n[lang].uiNoData; });
  $('#url').addEventListener('keydown', (e) => { if (e.key === 'Enter') doFetch(); });

  // 轻量健康检查（不阻塞）
  (async () => { try { await fetch(`${API_BASE}/health`, { mode: 'cors' }); } catch {} })();

})();
