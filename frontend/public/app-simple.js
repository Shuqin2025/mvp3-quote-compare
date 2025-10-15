// app-simple.js — 单页 UI + i18n + Excel(内嵌图片)
// 统一拼接规则：  实际请求 = API_BASE + API_PREFIX(可能为''或'/v1') + (USE_API ? '/api' : '') + endpoint
// 端点举例：健康 /health；业务 /catalog/parse、/image64
// last-mod: 2025-10-12

(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

  // ───────────────── 读取 API_BASE ─────────────────
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

  // ───────────────── 可选鉴权头（仅当URL显式传入 ?auth= 才生效，避免无意预检） ─────────────────
  const authParam = new URLSearchParams(location.search).get('auth');
  const AUTH = authParam ? String(authParam) : '';
  const AUTH_HEADERS = AUTH ? { Authorization: AUTH } : {};
  window.__API_AUTH_EFFECTIVE__ = AUTH || '(none)';

  // ───────────────── 自动探测（是否需要 /v1、是否需要 /api） ─────────────────
  // 目标：确认两件事：
  //   1) API_PREFIX 是 '' 还是 '/v1'
  //   2) USE_API 是否需要在路径中插入 '/api'
  let API_PREFIX = '/v1';     // 针对网关默认先假设 '/v1'
  let USE_API = true;         // 网关默认在 '/v1' 后还要 '/api'
  window.__API_PREFIX__ = API_PREFIX;
  window.__USE_API__ = USE_API;

  async function detectPrefix() {
    const tries = [
      { pfx: '/v1', useApi: true,  url: `${API_BASE}/v1/api/health` },
      { pfx: '/v1', useApi: false, url: `${API_BASE}/v1/health` },
      { pfx: '',    useApi: false, url: `${API_BASE}/health` },
    ];
    for (const t of tries) {
      try {
        const r = await fetch(t.url, { mode: 'cors' });
        if (r.ok) {
          API_PREFIX = t.pfx;
          USE_API = t.useApi;
          window.__API_PREFIX__ = API_PREFIX;
          window.__USE_API__ = USE_API;
          return;
        }
      } catch { /* ignore */ }
    }
  }

  // 辅助：拼接真实接口地址（传入 endpoint 必须以斜杠开头，如 '/catalog/parse'、'/image64'）
  const buildApi = (endpoint) =>
    `${API_BASE}${API_PREFIX}${USE_API ? '/api' : ''}${endpoint}`;

  // ───────────────── i18n ─────────────────
  const i18n = {
    zh: {
      title:'云贸星 智能表格生成器',
      subtitle:'输入目录型网页链接，秒生成 Excel 产品表格。',
      urlPh:'在此粘贴目录型页面链接（例如某一类目的商品列表页）',
      fetch:'抓取目录',
      export:'导出 Excel（.xlsx）',
      clear:'清空数据',
      th:['#','货号','图片','描述','起订量','单价','链接'],
      okExport:'已导出 Excel（含图片、价格占位符）。',
      success:(n,m)=>`抓取成功：共 ${n} 条（预览前 ${m} 条）`,
      pleaseFetch:'请先抓取目录再导出。',
      linkText:'链接',
      uiNoData:'ui_no_data',
      failFetch:e=>`抓取失败：${e}`,
      failExport:e=>`导出失败：${e}`,
      loading:'抓取中…（如需从详情覆写 SKU，可能需要十几秒）',
      hintNotCatalog:'该页面不是商品目录，请打开具体分类页再试',
    },
    de: {
      title:'Yunivera · Intelligenter Tabellen-Generator',
      subtitle:'Fügen Sie einen Katalog-Link ein und erzeugen Sie sofort eine Excel-Tabelle.',
      urlPh:'Katalog-/Kategorie-URL hier einfügen',
      fetch:'Katalog abrufen',
      export:'Excel exportieren (.xlsx)',
      clear:'Daten leeren',
      th:['#','Artikel-Nr.','Bild','Beschreibung','MOQ','Einzelpreis','Link'],
      okExport:'Excel exportiert (mit Bildern).',
      success:(n,m)=>`Erfolg: Insgesamt ${n} Einträge (zeige ${m}).`,
      pleaseFetch:'Bitte zuerst Katalog abrufen.',
      linkText:'Link',
      uiNoData:'ui_no_data',
      failFetch:e=>`Abruf fehlgeschlagen: ${e}`,
      failExport:e=>`Export fehlgeschlagen: ${e}`,
      loading:'Abruf läuft… (falls SKU aus Detailseite überschrieben wird, kann es einige Sekunden dauern)',
      hintNotCatalog:'Diese Seite ist kein Produktkatalog. Bitte öffnen Sie eine konkrete Kategorieseite und versuchen Sie es erneut.',
    },
    en: {
      title:'Yunivera · Smart Sheet Builder',
      subtitle:'Paste a catalog URL and instantly create an Excel sheet.',
      urlPh:'Paste a category/listing page URL here',
      fetch:'Fetch Catalog',
      export:'Export Excel (.xlsx)',
      clear:'Clear',
      th:['#','Item No.','Picture','Description','MOQ','Unit Price','Link'],
      okExport:'Excel exported (with images).',
      success:(n,m)=>`Success: ${n} items (showing ${m}).`,
      pleaseFetch:'Fetch catalog before export.',
      linkText:'Link',
      uiNoData:'ui_no_data',
      failFetch:e=>`Fetch failed: ${e}`,
      failExport:e=>`Export failed: ${e}`,
      loading:'Fetching… (if overwriting SKU from details, it may take a few seconds)',
      hintNotCatalog:"This page isn’t a product catalog. Please open a specific category page and try again.",
    },
  };

  let lang = localStorage.getItem('mvp3_lang') || 'zh';
  function applyLang() {
    const t = i18n[lang];
    $('#title') && ($('#title').textContent = t.title);
    $('#subtitle') && ($('#subtitle').textContent = t.subtitle);
    $('#url')?.setAttribute('placeholder', t.urlPh);
    $('#btnFetch') && ($('#btnFetch').textContent = t.fetch);
    $('#btnExport') && ($('#btnExport').textContent = t.export);
    $('#btnClear') && ($('#btnClear').textContent = t.clear);
    $('#status') && ($('#status').textContent = t.uiNoData);
    const ths = $('#tbl thead tr')?.children || [];
    t.th.forEach((tx, i) => ths[i] && (ths[i].textContent = tx));
  }
  $('#langbar')?.addEventListener('click', e => {
    const l = e.target?.dataset?.lang;
    if (!l) return;
    lang = l; localStorage.setItem('mvp3_lang', l); applyLang();
  });
  applyLang();

  // —— 统一顶部右侧气泡提示 ——
  function toastInfo(msg, ms = 2400) {
    try {
      if (typeof window.toast === 'function') { window.toast(msg); return; }
      let bar = document.getElementById('__toast__');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = '__toast__';
        bar.style.cssText = 'position:fixed;right:16px;top:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(bar);
      }
      const item = document.createElement('div');
      item.textContent = msg;
      item.style.cssText = 'background:rgba(17,24,39,.92);color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.15);font-size:14px;max-width:360px;';
      bar.appendChild(item);
      setTimeout(() => { item.style.opacity = '0'; item.style.transition = 'opacity .3s'; }, ms);
      setTimeout(() => item.remove(), ms + 320);
    } catch { alert(msg); }
  }
    alert(msg);
  }

  // ───────────────── helpers ─────────────────
  const isCodeLike = s => /^\s*\d+(?:-\d+)*\s*$/.test(String(s || ''));
  const idFromUrl = (u='') => { const m = /,(\d+)\.html(?:[?#].*)?$/i.exec(u); return m ? m[1] : ''; };
  const normalizeSku = it => {
    const sku = (it.sku ?? '').toString().trim();
    if (isCodeLike(sku)) return sku;
    const fromUrl = idFromUrl(it.url || '');
    if (isCodeLike(fromUrl)) return fromUrl;
    return sku || '';
  };
  const firstImg = (x) => {
    if (x?.img_b64) return x.img_b64;
    if (x?.img) return x.img;
    if (Array.isArray(x?.imgs) && x.imgs.length) return x.imgs[0];
    return '';
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

  // ───────────────── 统一 GET 抓取目录（避免预检，匹配网关实现） ─────────────────
  async function doFetch() {
    const t = i18n[lang];
    const btn = $('#btnFetch');
    const status = $('#status');

    try {
      const url = ($('#url')?.value || '').trim();
      if (!url) return;
      const limit = parseInt($('#limit')?.value || '50', 10) || 50;

      if (btn) { btn.disabled = true; btn.textContent = t.fetch + '…'; }
      if (status) status.textContent = t.loading;

      const ep = buildApi('/catalog/parse') + `?url=${encodeURIComponent(url)}&limit=${limit}`;
      const r = await fetch(ep, { method: 'GET', mode: 'cors', headers: { ...AUTH_HEADERS } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      // —— 二次提示：命中 generic-links 且无商品 ——
      const adapter = j?.adapter || j?.type;
      const prelim = Array.isArray(j?.items) && j.items.length ? j.items
                    : (Array.isArray(j?.products) ? j.products : []);
      if ((adapter === 'generic-links' || adapter === 'GenericLinks') && prelim.length === 0) {
        const msg = i18n[lang].hintNotCatalog;
        toastInfo(msg);
        rows = [];
        renderTable();
        if (status) status.textContent = msg;
        if (btn) { btn.disabled = false; btn.textContent = i18n[lang].fetch; }
        return; // 提前返回，不再显示“成功”
      }

      const list = Array.isArray(j?.items) && j.items.length ? j.items
                 : (Array.isArray(j?.products) ? j.products : []);
      rows = list.map(x => ({
        sku:   normalizeSku(x),
        title: (x.title ?? '').toString().trim() || '—',
        url:   x.url || '',
        img:   firstImg(x),
        price: x.price || '',
        moq:   (x.moq ?? '').toString().trim() || '—',
      }));

      renderTable();
      status && (status.textContent = t.success(rows.length, Math.min(rows.length, limit)));
      $('#theadNote') && ($('#theadNote').textContent = url);
    } catch (e) {
      console.error(e);
      $('#status') && ($('#status').textContent = i18n[lang].failFetch(e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = i18n[lang].fetch; }
    }
  }

  // ───────────────── 导出 Excel（按需 /image64，后端返回“纯base64文字”） ─────────────────
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
    const guessExtFromUrl = (u='') => {
      const low = u.toLowerCase();
      if (/\.(png)(\?|#|$)/.test(low)) return 'png';
      if (/\.(webp)(\?|#|$)/.test(low)) return 'webp';
      if (/\.(gif)(\?|#|$)/.test(low)) return 'gif';
      if (/\.(bmp)(\?|#|$)/.test(low)) return 'bmp';
      return 'jpeg';
    };
    async function fetchB64ViaServer(imgUrl) {
      const r = await fetch(buildApi('/image64') + `?url=${encodeURIComponent(imgUrl)}`, { method: 'GET', mode: 'cors', headers: { ...AUTH_HEADERS } });
      if (!r.ok) throw new Error(`image64 HTTP ${r.status}`);
      const raw = await r.text();       // 后端返回纯 base64
      const ext = guessExtFromUrl(imgUrl);
      return { raw, ext };
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

    const ok = $('#okbar');
    if (ok) { ok.textContent = t.okExport; ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 2000); }
  }

  // ───────────────── 绑定 ─────────────────
  $('#btnFetch')?.addEventListener('click', doFetch);
  $('#btnExport')?.addEventListener('click', doExport);
  $('#btnClear')?.addEventListener('click', () => { rows = []; renderTable(); $('#status') && ($('#status').textContent = i18n[lang].uiNoData); });
  $('#url')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFetch(); });

  // 先探测一次（不阻塞）
  detectPrefix().catch(()=>{});

  // 轻量健康探测（不阻塞）
  (async () => {
    try {
      const r = await fetch(buildApi('/health'), { mode: 'cors' });
      if (!r.ok) throw 0;
    } catch {}
  })();
})();
