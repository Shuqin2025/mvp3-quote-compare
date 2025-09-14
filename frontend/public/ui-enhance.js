/* public/ui-enhance.js —— 纯 JS 文件，勿放 <script> 标签 */
(() => {
  /** ========== 小工具 ========== */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const create = (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  // 读 ?api=... 作后端基址，去掉尾部斜杠
  const getApiBase = () => {
    try {
      const u = new URL(location.href);
      return (u.searchParams.get('api') || '').replace(/\/+$/,'');
    } catch { return ''; }
  };

  // 更稳的 URL 输入框定位：优先从按钮附近找，其次全局按语义匹配
  const findUrlInput = () => {
    const fetchBtn =
      $('#btnFetch') || $('button[data-role="fetch"]') || $$('button').find(b => /抓取|Katalog|Fetch/i.test(b.textContent)) || null;

    const scopes = [];
    if (fetchBtn) {
      const box = fetchBtn.closest('form, .toolbar, .controls, .row, .flex, .container, .panel');
      if (box) scopes.push(box);
    }
    scopes.push(document);

    const candidates = [];
    const selList = [
      '#url', '#inputUrl', '#url-input',
      '[name="url"]', '[data-role="url"]',
      'input[type="url"]', 'input[type="text"]', 'textarea'
    ];
    for (const scope of scopes) {
      for (const sel of selList) candidates.push(...$$(sel, scope));
      // 再用 placeholder 兜底
      candidates.push(
        ...$$('input,textarea', scope).filter(el => {
          const ph = (el.getAttribute('placeholder') || '').toLowerCase();
          return /url|http|链接|地址|katalog|list|产品|product/.test(ph);
        })
      );
    }
    const visible = candidates.filter(el => el && !el.disabled && el.offsetParent !== null);
    // 选当前“内容最长”的那个，粘贴了完整 URL 时最可能命中
    visible.sort((a,b) => (b.value?.length||0) - (a.value?.length||0));
    return visible[0] || null;
  };

  /** ========== UI/Toast ========== */
  const els = { url: null, btnFetch: null, pageSize: null, btnExport: null, btnClear: null, dataPanel: null };

  const toastEl = create('div', { id: 'toast', style: 'display:none' });
  const mountToast = () => {
    const host = els.dataPanel || $('#data-panel') || document.body;
    if (!toastEl.parentNode) {
      toastEl.style.cssText = 'margin:10px 0;padding:8px 12px;border-radius:6px;background:#fff8ee;display:none;';
      host.prepend(toastEl);
    }
  };
  const toast = (type, msg) => {
    const color = type === 'ok' ? '#0ea5e9' : '#f59e0b';
    toastEl.style.cssText =
      `margin:10px 0;padding:8px 12px;border-left:4px solid ${color};background:#fff8ee;display:block;`;
    toastEl.textContent = msg;
  };

  /** ========== 表格渲染（保持空白而不是布纹） ========== */
  const ensureTbody = () => {
    let tbody = $('#tbody');
    if (tbody) return tbody;

    let table = $('table.data-table') || $('table');
    if (!table) {
      table = create('table', {
        class: 'data-table',
        style: 'width:100%;border-collapse:collapse;font-size:14px;'
      });
      const thead = create('thead');
      thead.innerHTML = `
        <tr style="text-align:left;border-bottom:1px solid #eee;">
          <th style="padding:8px;width:56px">#</th>
          <th style="padding:8px">Item No.</th>
          <th style="padding:8px">Picture</th>
          <th style="padding:8px">Description</th>
          <th style="padding:8px">MOQ</th>
          <th style="padding:8px">Unit Price</th>
          <th style="padding:8px">Link</th>
        </tr>`;
      tbody = create('tbody', { id: 'tbody' });
      table.appendChild(thead);
      table.appendChild(tbody);
      (els.dataPanel || document.body).appendChild(table);
    } else {
      tbody = table.tBodies[0] || create('tbody');
      if (!tbody.id) tbody.id = 'tbody';
      if (!table.tBodies.length) table.appendChild(tbody);
    }
    return tbody;
  };

  const render = (rows) => {
    const tbody = ensureTbody();
    if (!tbody) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = ''; // 清空留白
      return;
    }
    const html = rows.map((it, i) => {
      const sku   = it.sku ?? it.itemNo ?? it.code ?? '';
      const title = it.title ?? it.name ?? '';
      const img   = it.img
        ? `<img src="${it.img}" alt="" loading="lazy"
               style="width:42px;height:42px;object-fit:cover;border:1px solid #eee;border-radius:4px;" />`
        : '';
      const price = it.price ?? '';
      const moq   = it.moq ?? '';
      const link  = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">Link</a>` : '';
      return `
        <tr style="border-bottom:1px dashed #eee;">
          <td style="padding:8px">${i + 1}</td>
          <td style="padding:8px">${sku}</td>
          <td style="padding:8px">${img}</td>
          <td style="padding:8px">${title}</td>
          <td style="padding:8px">${moq}</td>
          <td style="padding:8px">${price}</td>
          <td style="padding:8px">${link}</td>
        </tr>`;
    }).join('');
    tbody.innerHTML = html;
  };

  /** ========== 抓取主流程 ========== */
  const fetchCatalog = async () => {
    try {
      // 每次用时再取，避免热替换后引用失效
      els.url = findUrlInput();

      const inputVal = (els.url && (els.url.value || els.url.textContent) || '').trim();
      if (!inputVal) {
        toast('fail', '请输入或粘贴一个目录/列表页链接');
        return;
      }

      // 若用户粘贴的是 “…/parse?url=xxx” 的整串，这里自动拆出真正 URL
      let targetUrl = inputVal;
      try {
        const parsed = new URL(inputVal);
        const u2 = parsed.searchParams.get('url');
        if (u2) targetUrl = decodeURIComponent(u2);
      } catch {}

      const api = getApiBase();
      if (!api) {
        toast('fail', '缺少后端 API 地址：请确保页面 URL 包含 ?api=... 参数');
        return;
      }

      const limit = parseInt((els.pageSize && els.pageSize.value) || '50', 10) || 50;
      const reqUrl = `${api}/v1/api/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}`;
      console.log('[fetch] ->', reqUrl);

      toast('ok', '正在抓取中…');
      const res = await fetch(reqUrl, { method: 'GET' });
      if (!res.ok) {
        toast('fail', `抓取失败：HTTP ${res.status}`);
        render([]);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!data || data.ok === false) {
        const msg = (data && (data.message || data.error)) || '抓取失败';
        toast('fail', msg);
        render([]);
        return;
      }

      const list = data.products || data.items || [];
      render(list);
      toast('ok', `抓取成功，共 ${list.length} 条`);
    } catch (err) {
      console.error(err);
      toast('fail', `抓取失败：${err && err.message ? err.message : err}`);
      render([]);
    }
  };

  const clearData = () => {
    render([]);
    toastEl.style.display = 'none';
  };

  /** ========== 绑定（含兜底委托） ========== */
  const bind = () => {
    els.btnFetch  = $('#btnFetch')  || $('button[data-role="fetch"]');
    els.pageSize  = $('#pageSize')  || $('select');
    els.btnExport = $('#btnExport') || $('button[data-role="export"]');
    els.btnClear  = $('#btnClear')  || $('button[data-role="clear"]');
    els.dataPanel = $('#data-panel') || $('.data-panel') || document.querySelector('.panel') || document.body;
    els.url       = findUrlInput();

    mountToast();

    // 直接绑定
    if (els.btnFetch) els.btnFetch.addEventListener('click', fetchCatalog);
    if (els.btnClear) els.btnClear.addEventListener('click', clearData);
    if (els.url) els.url.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchCatalog(); });

    // 兜底委托：点击任意按钮，若文字匹配“抓取目录/Katalog abrufen/Fetch Catalog”，也触发
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const txt = (btn.textContent || '').trim();
      if (/^(抓取目录|Katalog abrufen|Fetch Catalog)$/i.test(txt)) {
        fetchCatalog();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
