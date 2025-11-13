/* frontend/public/ui-enhance.plus.js
 * UI 增强：统一网关、目录抓取、图片代理、Excel 导出、i18n 和懒加载
 * 兼容 index.html（按钮 id：btnFetch / btnExport / btnClear；输入框 id：txtUrl / txtLimit；表格 id：tbl；状态 id：status / okbar）
 */

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

/** ---------- 配置 / i18n ---------- */
const I18N = {
  zh: {
    title: '云贸星 · 智能表格生成器',
    ready: 'Ready',
    fetching: '抓取中…',
    ok: 'ok',
    failed: '抓取失败：',
    idx: '#',
    sku: '货号',
    img: '图片',
    desc: '描述',
    price: '单价',
    open: '打开',
    export: '导出 Excel（.xlsx）',
    cleared: '已清空',
  },
  de: {
    title: 'Yuniverse · Intelligenter Tabellen-Generator',
    ready: 'Bereit',
    fetching: 'Wird abgerufen…',
    ok: 'ok',
    failed: 'Fehlgeschlagen: ',
    idx: '#',
    sku: 'Artikel-Nr.',
    img: 'Bild',
    desc: 'Beschreibung',
    price: 'Preis',
    open: 'öffnen',
    export: 'Excel exportieren (.xlsx)',
    cleared: 'Gelöscht',
  },
  en: {
    title: 'Yuniverse · Smart Sheet Builder',
    ready: 'Ready',
    fetching: 'Fetching…',
    ok: 'ok',
    failed: 'Failed: ',
    idx: '#',
    sku: 'SKU',
    img: 'Image',
    desc: 'Description',
    price: 'Price',
    open: 'open',
    export: 'Export Excel (.xlsx)',
    cleared: 'Cleared',
  },
};

const getLang = () => {
  const v = localStorage.getItem('mvp_lang');
  return v && I18N[v] ? v : 'zh';
};

const LANG = getLang();

/** ---------- 网关探测 ---------- */
const urlParams = new URLSearchParams(location.search);
const apiBase =
  (urlParams.get('api') && decodeURIComponent(urlParams.get('api'))) ||
  'https://yunivera-gateway.onrender.com';

console.log('[ui-plus] enabled, apiBase =', apiBase);

/** ---------- DOM ---------- */
const $url = qs('#txtUrl');
const $limit = qs('#txtLimit');
const $btnFetch = qs('#btnFetch');
const $btnExport = qs('#btnExport');
const $btnClear = qs('#btnClear');
const $status = qs('#status');
const $okbar = qs('#okbar');
const $table = qs('#tbl');
const $tbody = $table ? $table.tBodies[0] || $table.createTBody() : null;

/** ---------- 工具 ---------- */
const setStatus = (text, ok = false) => {
  if ($status) $status.textContent = text;
  if ($okbar) $okbar.style.display = ok ? '' : 'none';
};

const toNumber = (v, d = 50) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(500, n) : d;
};

const buildImgSrc = (raw) => {
  if (!raw) return '';
  // 统一通过网关代理图片（避免 CORS）
  return `${apiBase}/image?format=raw&url=${encodeURIComponent(raw)}`;
};

const fetchJSON = async (url, init) => {
  const resp = await fetch(url, init);
  const ct = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${txt.slice(0, 200)}`);
  }
  if (ct.includes('application/json')) return resp.json();
  // 非 JSON 也返回空对象以防止崩
  return {};
};

const downloadBlob = (blob, filename) => {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** ---------- 懒加载 ---------- */
const lazyMarker = 'data-src';
const ensureLazy = () => {
  const imgs = qsa(`img[${lazyMarker}]`);
  if (!imgs.length) return;

  if (!('IntersectionObserver' in window)) {
    imgs.forEach((img) => (img.src = img.getAttribute(lazyMarker)));
    return;
  }

  const io = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      if (e.isIntersecting) {
        const img = e.target;
        img.src = img.getAttribute(lazyMarker);
        img.removeAttribute(lazyMarker);
        io.unobserve(img);
      }
    });
  });
  imgs.forEach((img) => io.observe(img));
};

/** ---------- 渲染 ---------- */
const T = I18N[LANG];
const renderHeader = () => {
  // 简单的多语言表头（只在页面已有结构的情况下替换 th 文案）
  const ths = qsa('#tbl thead th');
  if (ths.length >= 5) {
    ths[0].textContent = T.idx;
    ths[1].textContent = T.sku;
    ths[2].textContent = T.img;
    ths[3].textContent = T.desc;
    ths[4].textContent = T.price;
    if (ths[5]) ths[5].textContent = T.open;
  }
};

const renderRows = (rows = []) => {
  if (!$tbody) return;
  $tbody.innerHTML = '';

  rows.forEach((item, i) => {
    const tr = document.createElement('tr');

    const tdIdx = document.createElement('td');
    tdIdx.textContent = String(i + 1);

    const tdSku = document.createElement('td');
    tdSku.textContent = item.sku || '';

    const tdImg = document.createElement('td');
    const img = document.createElement('img');
    img.alt = item.sku || '';
    img.width = 60;
    img.height = 60;
    img.style.objectFit = 'contain';
    // 懒加载：先打占位，真正 src 用 data-src
    const proxied = buildImgSrc(item.img);
    if (proxied) {
      img.setAttribute(lazyMarker, proxied);
      img.src =
        'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><text x="50%" y="50%" font-size="10" dominant-baseline="middle" text-anchor="middle" fill="#888">img</text></svg>`,
        );
    }
    tdImg.appendChild(img);

    const tdDesc = document.createElement('td');
    tdDesc.textContent = item.title || item.desc || '';

    const tdPrice = document.createElement('td');
    tdPrice.textContent = item.price || '';

    const tdOpen = document.createElement('td');
    if (item.url) {
      const a = document.createElement('a');
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = T.open;
      tdOpen.appendChild(a);
    }

    tr.append(tdIdx, tdSku, tdImg, tdDesc, tdPrice, tdOpen);
    $tbody.appendChild(tr);
  });

  // 激活懒加载
  ensureLazy();
};

/** ---------- 业务：抓取 ---------- */
const fetchCatalog = async () => {
  const url = ($url && $url.value.trim()) || '';
  const limit = toNumber($limit && $limit.value);
  if (!url) return;

  setStatus(T.fetching, false);
  try {
    const apiUrl = `${apiBase}/catalog/parse?url=${encodeURIComponent(url)}&limit=${limit}`;
    const data = await fetchJSON(apiUrl, { method: 'GET', credentials: 'omit' });

    // 兼容网关返回结构（items / rows / data）
    const rows =
      data.rows ||
      data.items ||
      data.data ||
      []; // 每项建议字段：{ sku, title, price, img, url }

    renderRows(rows);
    setStatus(T.ok, true);
  } catch (err) {
    console.error(err);
    setStatus(T.failed + (err.message || String(err)), false);
  }
};

/** ---------- 业务：导出 ---------- */
const exportXlsx = async () => {
  const url = ($url && $url.value.trim()) || '';
  const limit = toNumber($limit && $limit.value);
  if (!url) return;

  try {
    setStatus(T.fetching, false);

    // 关键点：POST /export-xlsx（JSON），不要走 /v1/export-xlsx；返回 Blob（xlsx）
    const resp = await fetch(`${apiBase}/export-xlsx`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, limit, lang: LANG }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${txt.slice(0, 200)}`);
    }

    const blob = await resp.blob();
    const name = 'export.xlsx';
    downloadBlob(blob, name);
    setStatus(T.ok, true);
  } catch (err) {
    console.error(err);
    setStatus(T.failed + (err.message || String(err)), false);
  }
};

/** ---------- 业务：清空 ---------- */
const clearAll = () => {
  if ($tbody) $tbody.innerHTML = '';
  setStatus(T.cleared, true);
};

/** ---------- 事件绑定 ---------- */
if ($btnFetch) $btnFetch.addEventListener('click', fetchCatalog);
if ($btnExport) $btnExport.addEventListener('click', exportXlsx);
if ($btnClear) $btnClear.addEventListener('click', clearAll);

/** ---------- 初始化 ---------- */
(() => {
  renderHeader();
  setStatus(T.ready, true);

  // 页面语言按钮（如果页面有对应 id）
  const bindLang = (id, lang) => {
    const el = qs(id);
    if (el) {
      el.addEventListener('click', () => {
        localStorage.setItem('mvp_lang', lang);
        location.reload();
      });
    }
  };
  bindLang('#btnLangZh', 'zh');
  bindLang('#btnLangDe', 'de');
  bindLang('#btnLangEn', 'en');
})();
