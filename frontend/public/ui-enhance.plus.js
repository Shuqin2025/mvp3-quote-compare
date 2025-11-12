/* frontend/public/ui-enhance.plus.js
 * 负责页面交互：抓取目录、渲染表格、图片代理回退、语言按钮、本地存储语言等
 */

(function () {
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => [...el.querySelectorAll(s)];
  const $url = qs('#txtUrl') || qs('#txtInput') || qs('input[type="text"]');
  const $limit = qs('#txtLimit') || qs('input[type="number"]');
  const $btnFetch = qs('#btnFetch');
  const $btnClear = qs('#btnClear');
  const $btnExport = qs('#btnExport');
  const $table = qs('#tbl') || qs('table');
  const $tbody = qs('#tb1') || qs('tbody');
  const $status = qs('#status');
  const $okbar = qs('#okbar');

  // 读取 ?api= 指定的网关根
  const search = new URLSearchParams(location.search);
  let apiBase = (search.get('api') || '').trim();
  if (apiBase.endsWith('/')) apiBase = apiBase.replace(/\/+$/, '');
  const api = (p) => `${apiBase}/v1${p}`;

  // 语言
  const langKey = 'mvp_lang';
  const lang = localStorage.getItem(langKey) || 'zh';

  // UI 状态
  const setStatus = (msg, kind = 'info') => {
    if ($status) {
      $status.className = `alert ${kind}`;
      $status.textContent = msg;
    }
  };
  const setOk = (msg) => {
    if ($okbar) {
      $okbar.style.display = 'block';
      $okbar.textContent = msg || 'ok';
    }
  };

  // 图片 URL 生成：代理优先，失败回退
  const proxied = (rawUrl) => api(`/image?format=raw&url=${encodeURIComponent(rawUrl)}`);

  // 渲染一行
  function renderRow(i, item) {
    const tr = document.createElement('tr');
    const tdIndex = document.createElement('td');
    tdIndex.textContent = i + 1;

    const tdBrand = document.createElement('td');
    tdBrand.textContent = item.brand || item.manu || item.vendor || item.supplier || item.shop || '';

    const tdImg = document.createElement('td');
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.cssText = 'width:64px;height:64px;object-fit:contain;background:#fff;border:1px solid #eee;border-radius:4px;';
    // 先走代理，失败回退直链
    if (item.img) {
      img.src = proxied(item.img);
      img.onerror = () => { img.onerror = null; img.src = item.img; };
    } else {
      img.alt = 'no-image';
    }
    tdImg.appendChild(img);

    const tdTitle = document.createElement('td');
    tdTitle.textContent = item.title || item.name || item.desc || '';

    const tdPrice = document.createElement('td');
    tdPrice.textContent = item.price || '';

    const tdOpen = document.createElement('td');
    const a = document.createElement('a');
    a.href = item.url || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = lang === 'de' ? 'öffnen' : lang === 'en' ? 'open' : '打开';
    tdOpen.appendChild(a);

    tr.appendChild(tdIndex);
    tr.appendChild(tdBrand);
    tr.appendChild(tdImg);
    tr.appendChild(tdTitle);
    tr.appendChild(tdPrice);
    tr.appendChild(tdOpen);
    return tr;
  }

  // 渲染表格
  function renderTable(rows = []) {
    if (!$tbody) return;
    $tbody.innerHTML = '';
    rows.forEach((it, idx) => $tbody.appendChild(renderRow(idx, it)));
  }

  // 抓取目录
  async function fetchCatalog() {
    try {
      const url = ($url && $url.value || '').trim();
      const limit = parseInt(($limit && $limit.value) || '50', 10) || 50;
      if (!url) {
        setStatus('请输入目录链接', 'warn');
        return;
      }
      setStatus('正在抓取…', 'info');

      const u = new URL(api('/catalog/parse'));
      u.searchParams.set('url', url);
      u.searchParams.set('limit', String(limit));

      const resp = await fetch(u.toString(), { method: 'GET' });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) throw new Error(`抓取失败（${resp.status}）`);
      const data = ct.includes('application/json') ? await resp.json() : await resp.json();

      // 兼容服务字段：items / data / list / rows
      const rows = data.rows || data.items || data.list || data.data || [];
      renderTable(rows);
      setOk(`Fetched: ${rows.length}/${data.count ?? rows.length}`);
      setStatus('Ready', 'ok');
    } catch (err) {
      console.error(err);
      setStatus(`抓取失败：${err.message}`, 'error');
    }
  }

  // 清空表格
  function clearAll() {
    if ($tbody) $tbody.innerHTML = '';
    setStatus('');
    if ($okbar) $okbar.style.display = 'none';
  }

  // 语言按钮（与 index.html 中 id 对应）
  function bindLangButtons() {
    const map = { '#btnLangZh': 'zh', '#btnLangDe': 'de', '#btnLangEn': 'en' };
    Object.entries(map).forEach(([sel, code]) => {
      const el = qs(sel);
      if (el) el.addEventListener('click', () => {
        localStorage.setItem(langKey, code);
        location.reload();
      });
    });
  }

  // 绑定
  if ($btnFetch) $btnFetch.addEventListener('click', fetchCatalog);
  if ($btnClear) $btnClear.addEventListener('click', clearAll);
  if ($btnExport && window.__EXPORT_XLSX__) {
    $btnExport.addEventListener('click', () => window.__EXPORT_XLSX__.exportXlsx());
  }
  bindLangButtons();

  // 对外暴露（调试用）
  window.uiPlus = { apiBase, api, fetchCatalog };

  // 控制台提示
  console.log('[ui-plus] enabled, apiBase =', apiBase || '(same-origin)');
})();
