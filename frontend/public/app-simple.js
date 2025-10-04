// app-simple.js — single UI + i18n + image-embed Excel
// 2025-09-20：默认用 POST /api/catalog/parse；404 时自动切换是否带 /v1

(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

  // ───────── API base 选择 ─────────
  const apiParam = new URLSearchParams(location.search).get('api');
  const fromBoot =
    (typeof window !== 'undefined') &&
    (window.__API_BASE__ || window.API_BASE || window.__API_BASE_EFFECTIVE__);

  let fromEnv;
  try {
    const hasImportMeta = (typeof import.meta !== 'undefined');
    fromEnv = (hasImportMeta && import.meta?.env?.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : undefined;
  } catch { fromEnv = undefined; }

  const fromMeta = document.querySelector('meta[name="api-base"]')?.content;
  const FALLBACK_GATEWAY = 'https://yunivera-gateway.onrender.com';

  const API_BASE =
    (isHttp(apiParam) && apiParam) ||
    (isHttp(fromBoot) && fromBoot) ||
    (isHttp(fromEnv) && fromEnv) ||
    (isHttp(fromMeta) && fromMeta) ||
    FALLBACK_GATEWAY;

  window.__API_BASE_EFFECTIVE__ = API_BASE;

  // ───────── Authorization（可选） ─────────
  const authParam = new URLSearchParams(location.search).get('auth');
  const fromBootAuth = (typeof window !== 'undefined') && (window.__API_AUTH__ || window.API_AUTH);
  let fromEnvAuth;
  try {
    const hasImportMeta = (typeof import.meta !== 'undefined');
    fromEnvAuth = (hasImportMeta && import.meta?.env?.VITE_API_AUTH) ? import.meta.env.VITE_API_AUTH : undefined;
  } catch { fromEnvAuth = undefined; }
  const fromMetaAuth = document.querySelector('meta[name="api-auth"]')?.content;
  const fromLocalAuth = localStorage.getItem('mvp3_auth') || '';

  const AUTH =
    (authParam && String(authParam)) ||
    (fromBootAuth && String(fromBootAuth)) ||
    (fromEnvAuth && String(fromEnvAuth)) ||
    (fromMetaAuth && String(fromMetaAuth)) ||
    (fromLocalAuth && String(fromLocalAuth)) || '';

  const AUTH_HEADERS = AUTH ? { Authorization: AUTH } : {};
  window.__API_AUTH_EFFECTIVE__ = AUTH || '(none)';

  // ───────── 自动探测 /v1 前缀 ─────────
  let API_PREFIX = '';
  window.__API_PREFIX__ = API_PREFIX;

  async function detectPrefix() {
    try {
      const r = await fetch(`${API_BASE}/v1/health`, { mode: 'cors', headers: AUTH_HEADERS });
      if (r.ok) { API_PREFIX = '/v1'; window.__API_PREFIX__ = API_PREFIX; return; }
    } catch {}
    try {
      const r = await fetch(`${API_BASE}/health`, { mode: 'cors' });
      if (r.ok) { API_PREFIX = ''; window.__API_PREFIX__ = API_PREFIX; return; }
    } catch {}
  }

  // ───────── i18n ─────────
  const i18n = {
    zh: { title:'云贸星 智能表格生成器', subtitle:'输入目录型网页链接，秒生成 Excel 产品表格。',
      urlPh:'在此粘贴目录型页面链接（例如某一类目的商品列表页）', fetch:'抓取目录', export:'导出 Excel（.xlsx）',
      clear:'清空数据', th:['#','货号','图片','描述','起订量','单价','链接'],
      okExport:'已导出 Excel（含图片、价格占位符）。',
      success:(n,m)=>`抓取成功：共 ${n} 条（预览前 ${m} 条）`, pleaseFetch:'请先抓取目录再导出。',
      linkText:'链接', uiNoData:'ui_no_data', failFetch:e=>`抓取失败：${e}`, failExport:e=>`导出失败：${e}`,
      loading:'抓取中…（如需从详情覆写 SKU，可能需要十几秒）' },
    de: { title:'Yunivera · Intelligenter Tabellen-Generator',
      subtitle:'Fügen Sie einen Katalog-Link ein und erzeugen Sie sofort eine Excel-Tabelle.',
      urlPh:'Katalog-/Kategorie-URL hier einfügen', fetch:'Katalog abrufen', export:'Excel exportieren (.xlsx)',
      clear:'Daten leeren', th:['#','Artikel-Nr.','Bild','Beschreibung','MOQ','Einzelpreis','Link'],
      okExport:'Excel exportiert (mit Bildern).',
      success:(n,m)=>`Erfolg: Insgesamt ${n} Einträge (zeige ${m}).`, pleaseFetch:'Bitte zuerst Katalog abrufen.',
      linkText:'Link', uiNoData:'ui_no_data', failFetch:e=>`Abruf fehlgeschlagen: ${e}`, failExport:e=>`Export fehlgeschlagen: ${e}`,
      loading:'Abruf läuft… (falls SKU aus Detailseite überschrieben wird, kann es einige Sekunden dauern)' },
    en: { title:'Yunivera · Smart Sheet Builder', subtitle:'Paste a catalog URL and instantly create an Excel sheet.',
      urlPh:'Paste a category/listing page URL here', fetch:'Fetch Catalog', export:'Export Excel (.xlsx)',
      clear:'Clear', th:['#','Item No.','Picture','Description','MOQ','Unit Price','Link'],
      okExport:'Excel exported (with images).',
      success:(n,m)=>`Success: ${n} items (showing ${m}).`, pleaseFetch:'Fetch catalog before export.',
      linkText:'Link', uiNoData:'ui_no_data', failFetch:e=>`Fetch failed: ${e}`, failExport:e=>`Export failed: ${e}`,
      loading:'Fetching… (if overwriting SKU from details, it may take a few seconds)' },
  };

  let lang = localStorage.getItem('mvp3_lang') || 'zh';
  function applyLang() {
    const t = i18n[lang];
    $('#title').textContent = t.title;
    $('#subtitle').textContent = t.subtitle;
    $('#url')?.setAttribute('placeholder', t.urlPh);
    $('#btnFetch').textContent = t.fetch;
    $('#btnExport').textContent = t.export;
    $('#btnClear').textContent = t.clear;
    $('#status') && ($('#status').textContent = t.uiNoData);
    const ths = $('#tbl thead tr')?.children || [];
    t.th.forEach((tx, i) => ths[i] && (ths[i].textContent = tx));
  }
  $('#langbar')?.addEventListener('click', e => {
    const l = e.target?.dataset?.lang;
    if (!l) return;
    lang = l; localStorage.setItem('mvp3_lang', lang); applyLang();
  });
  applyLang();

  // helpers
  const isCodeLike = s => /^\s*\d+(?:-\d+)*\s*$/.test(String(s || ''));
  const idFromUrl = (u='') => { const m = /,(\d+)\.html(?:[?#].*)?$/i.exec(u); return m ? m[1] : ''; };
  const normalizeSku = it => {
    const sku = (it.sku ?? '').toString().trim();
    if (isCodeLike(sku)) return sku;
    const fromUrl = idFromUrl(it.url || '');
    if (isCodeLike(fromUrl)) return fromUrl;
    return sku || '';
  };

  let rows = [];
  function renderTable() {
    const tb = $('#tbl tbody');
    if (!tb) return;
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

  // 低层 fetch：404 时尝试切换 /v1 前缀
  async function fetchJsonWithPrefix(pathWithApi, opts={}) {
    let url = `${API_BASE}${API_PREFIX}${pathWithApi}`;
    let r = await fetch(url, opts);
    if (r.status === 404) {
      const alt = (API_PREFIX === '/v1') ? '' : '/v1';
      try {
        const r2 = await fetch(`${API_BASE}${alt}${pathWithApi}`, opts);
        if (r2.ok) { API_PREFIX = alt; window.__API_PREFIX__ = API_PREFIX; return r2; }
        return r2;
      } catch (e) { throw e; }
    }
    return r;
  }

  // 抓取目录（POST）
  async function doFetch() {
    const t = i18n[lang];
    const btn = $('#btnFetch');
    const status = $('#status');

    try {
      const url = ($('#url')?.value || '').trim();
      if (!url) return;
      const limit = parseInt($('#limit')?.value || '50', 10) || 50;

      // Loading UI
      if (btn) { btn.disabled = true; btn.textContent = t.fetch + '…'; }
      if (status) status.textContent = t.loading;

      const ep = `/api/catalog/parse`;
      const payload = { url, limit };      // ← 仅传 url + limit
      const r = await fetchJsonWithPrefix(ep, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
        body: JSON.stringify(payload),
      });
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
      $('#status') && ($('#status').textContent = t.success(rows.length, Math.min(rows.length, limit)));
      $('#theadNote') && ($('#theadNote').textContent = url);
    } catch (e) {
      console.error(e);
      $('#status') && ($('#status').textContent = t.failFetch(e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = i18n[lang].fetch; }
    }
  }

  // 导出 Excel（按需走 /api/image64 取图）
  async function doExport() {
    const t = i18n[lang];
    if (!rows.length) { alert(t.pleaseFetch); return; }
    if (!window.ExcelJS) { alert('ExcelJS not loaded'); return; }
    const ExcelJS = window.ExcelJS;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');
    ws.columns = [
      { header: i18n[lang].th[1], key: 'sku',  width: 18 },
      { header: i18n[lang].th[2], key: 'pic',  width: 22 },
      { header: i18n[lang].th[3], key: 'title',width: 60 },
      { header: i18n[lang].th[4], key: 'moq',  width: 10 },
      { header: i18n[lang].th[5], key: 'price',width: 14 },
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

    async function fetchB64ViaServer(imgUrl) {
      const ep = `/api/image64?url=${encodeURIComponent(imgUrl)}`;
      const r = await fetchJsonWithPrefix(ep, { method: 'GET', mode: 'cors', headers: AUTH_HEADERS });
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

    const ok = $('#okbar'); if (ok) { ok.textContent = t.okExport; ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 2000); }
  }

  // 绑定
  $('#btnFetch')?.addEventListener('click', doFetch);
  $('#btnExport')?.addEventListener('click', doExport);
  $('#btnClear')?.addEventListener('click', () => { rows = []; renderTable(); $('#status') && ($('#status').textContent = i18n[lang].uiNoData); });
  $('#url')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFetch(); });

  // 先探测一次前缀（不阻塞 UI）
  detectPrefix().catch(()=>{});

  // 轻量健康检查（不阻塞）
  (async () => { try { await fetch(`${API_BASE}${API_PREFIX}/health`, { mode: 'cors' }); } catch {} })();
})();
