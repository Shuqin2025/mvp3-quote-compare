/* ui-enhance.plus.js  —  FE 简化增强（方案A）
 * 1) 解析目录：GET  /v1/catalog/parse?url&limit
 * 2) 图片加载：先直连原图，失败再 POST /v1/image 代理
 * 3) 导出：由 export-xlsx.js 统一处理（POST /v1/export-xlsx -> fallback CSV）
 * 4) 语言切换与状态提示
 */

(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // ---- runtime ----
  const urlParams = new URLSearchParams(location.search);
  const apiFromQuery = urlParams.get('api');
  const apiBase = (apiFromQuery && apiFromQuery.trim()) ||
                  (window.UI_API_BASE || 'https://yunivera-gateway.onrender.com');

  console.log('[ui-plus] enabled, apiBase =', apiBase);

  // UI 节点
  const elInput = $('#txtUrl') || $('#txtUrl, input[type="text"]') || $('input[type="text"]');
  const elLimit = $('#txtLimit') || $('input[type="number"]');
  const btnFetch = $('#btnFetch') || $('button.btn-primary');
  const btnExport = $('#btnExport') || $('button:nth-of-type(2)');
  const btnClear = $('#btnClear') || $('button:nth-of-type(3)');
  const elStatus = $('#status');
  const elOkbar = $('#okbar');
  const elBody = $('#tbl tbody') || $('#tbl').querySelector('tbody');

  // state
  const state = {
    sourceUrl: '',
    baseHref: '',
    limit: 50,
    rows: []
  };

  // ---- helpers ----
  const setStatus = (msg, type = 'info') => {
    if (!elStatus) return;
    elStatus.className = `status alert ${type}`;
    elStatus.textContent = msg || '';
  };
  const setOkbar = (msg) => {
    if (!elOkbar) return;
    elOkbar.style.display = msg ? 'block' : 'none';
    elOkbar.textContent = msg || '';
  };

  const toAbsolute = (maybeRelative, baseHref) => {
    if (!maybeRelative) return '';
    try {
      // 已是绝对
      const u = new URL(maybeRelative);
      return u.href;
    } catch {
      try {
        const u = new URL(maybeRelative, baseHref);
        return u.href;
      } catch {
        return maybeRelative;
      }
    }
  };

  const buildBaseHref = (pageUrl) => {
    try {
      const u = new URL(pageUrl);
      return `${u.protocol}//${u.host}/`;
    } catch {
      return pageUrl;
    }
  };

  const clearTable = () => {
    if (elBody) elBody.innerHTML = '';
    state.rows = [];
    setOkbar('');
  };

  // 图片加载：优先直连，失败 fallback 到网关代理
  const loadImgWithFallback = (imgEl, srcUrl) => {
    imgEl.src = srcUrl;
    let triedProxy = false;

    imgEl.onerror = async () => {
      if (triedProxy) return;
      triedProxy = true;
      try {
        const proxied = await proxyImage(srcUrl);
        imgEl.src = proxied;
      } catch (e) {
        // 代理也失败，就用一个透明像素兜底
        imgEl.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
      }
    };
  };

  // 调用网关图片代理（POST /v1/image 返回 raw）
  const proxyImage = async (src) => {
    const resp = await fetch(`${apiBase}/v1/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: src, format: 'raw' })
    });
    if (!resp.ok) throw new Error(`image proxy ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  };

  // 渲染表格
  const renderRows = (rows, baseHref) => {
    if (!elBody) return;
    elBody.innerHTML = '';

    rows.forEach((row, idx) => {
      const tr = document.createElement('tr');

      const tdIdx = document.createElement('td');
      tdIdx.textContent = (idx + 1).toString();
      tr.appendChild(tdIdx);

      const tdSku = document.createElement('td');
      tdSku.textContent = (row.sku || row.title || `#${idx + 1}`).toString();
      tr.appendChild(tdSku);

      const tdImg = document.createElement('td');
      const img = document.createElement('img');
      img.width = 64; img.height = 64; img.loading = 'lazy';
      const imgUrl = toAbsolute(row.img, baseHref);
      // 先直连；失败再代理
      loadImgWithFallback(img, imgUrl);
      tdImg.appendChild(img);
      tr.appendChild(tdImg);

      const tdDesc = document.createElement('td');
      tdDesc.textContent = row.desc || row.title || '';
      tr.appendChild(tdDesc);

      const tdPrice = document.createElement('td');
      tdPrice.textContent = row.price || '';
      tr.appendChild(tdPrice);

      const tdOpen = document.createElement('td');
      const a = document.createElement('a');
      a.href = toAbsolute(row.url || row.href || '#', baseHref);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = (window.UI_I18N_OPEN || 'open');
      tdOpen.appendChild(a);
      tr.appendChild(tdOpen);

      elBody.appendChild(tr);
    });
  };

  // 拉取目录
  const fetchCatalog = async () => {
    const srcUrl = (elInput && elInput.value || '').trim();
    const limit = parseInt(elLimit && elLimit.value || '50', 10) || 50;
    if (!srcUrl) {
      setStatus('请输入目录页链接', 'warning');
      return;
    }
    setStatus('抓取中…', 'info');
    setOkbar('');

    try {
      const qs = new URLSearchParams({ url: srcUrl, limit: String(limit) });
      const resp = await fetch(`${apiBase}/v1/catalog/parse?${qs.toString()}`, {
        method: 'GET',
        credentials: 'omit',
        mode: 'cors'
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = await resp.json();

      // 兼容字段
      const baseHref = buildBaseHref(json.url || srcUrl);
      const rows = Array.isArray(json.rows)
        ? json.rows
        : (Array.isArray(json.list) ? json.list : (Array.isArray(json.items) ? json.items : []));

      state.sourceUrl = srcUrl;
      state.baseHref = baseHref;
      state.limit = limit;
      state.rows = rows || [];

      renderRows(state.rows, state.baseHref);
      setStatus('Ready', 'success');
      setOkbar(`Fetched: ${state.rows.length}/${limit}`);
    } catch (err) {
      console.error(err);
      setStatus(`抓取失败：${err.message || err}`, 'warning');
    }
  };

  // 导出
  const doExport = async () => {
    if (!state.rows.length) {
      setStatus('没有可导出的数据', 'warning');
      return;
    }
    setStatus('正在导出…', 'info');

    try {
      const mod = await import('./export-xlsx.js');
      await mod.exportXlsx({
        apiBase,
        fromUrl: state.sourceUrl,
        limit: state.limit,
        rows: state.rows.map(r => ({
          sku: r.sku || '',
          img: toAbsolute(r.img || '', state.baseHref),
          title: r.title || r.desc || '',
          desc: r.desc || '',
          price: r.price || '',
          url: toAbsolute(r.url || r.href || '', state.baseHref)
        }))
      });
      setStatus('导出完成', 'success');
    } catch (err) {
      console.error(err);
      setStatus(`导出失败：${err.message || err}`, 'warning');
    }
  };

  // 绑定事件
  btnFetch && btnFetch.addEventListener('click', fetchCatalog);
  btnExport && btnExport.addEventListener('click', doExport);
  btnClear && btnClear.addEventListener('click', () => {
    clearTable();
    setStatus('已清空', 'info');
  });

  // 语言切换（保持你之前的三语逻辑）
  const lang = localStorage.getItem('mvp_lang') || 'zh';
  window.UI_I18N_OPEN = (lang === 'zh') ? '打开' : (lang === 'de' ? 'Öffnen' : 'open');

  // 如果地址栏已有 url&limit，自动触发一次
  const autoUrl = urlParams.get('url');
  if (autoUrl && elInput) {
    elInput.value = autoUrl;
    const aLimit = parseInt(urlParams.get('limit') || '50', 10) || 50;
    if (elLimit) elLimit.value = String(aLimit);
    fetchCatalog();
  }
})();
