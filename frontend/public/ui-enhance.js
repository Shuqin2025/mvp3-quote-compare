/* public/ui-enhance.js —— 纯 JS 文件，勿放 <script> 标签 */
(() => {
  // ===== 小工具 =====
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const create = (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  const getApiBase = () => {
    try {
      const u = new URL(location.href);
      return (u.searchParams.get('api') || '').replace(/\/+$/,''); // 去掉尾部/
    } catch { return ''; }
  };

  // 在按钮附近、常见选择器、占位符文本中“聪明搜索”URL 输入框
  const findUrlInput = () => {
    // 1) 先在按钮邻域找
    const btn = $('#btnFetch') || $('button[data-role="fetch"]') || $('button');
    const scopes = [];
    if (btn) {
      const box = btn.closest('form, .toolbar, .controls, .row, .flex, .container');
      if (box) scopes.push(box);
    }
    scopes.push(document);

    const candidates = [];
    const selList = [
      '#url', '#inputUrl', '#url-input', '[name="url"]', '[data-role="url"]',
      'input[type="url"]', 'input[type="text"]', 'textarea'
    ];
    for (const scope of scopes) {
      for (const sel of selList) candidates.push(...$$(sel, scope));
      // 再用 placeholder 语义兜底
      candidates.push(
        ...$$('input,textarea', scope).filter(el => {
          const ph = (el.getAttribute('placeholder') || '').toLowerCase();
          return /url|http|链接|地址|katalog|list|产品|product/.test(ph);
        })
      );
    }
    // 过滤不可见/禁用
    const visible = candidates.filter(el => el && !el.disabled && el.offsetParent !== null);
    // 选内容最长的那个
    visible.sort((a,b) => (b.value?.length||0) - (a.value?.length||0));
    return visible[0] || null;
  };

  // ===== UI 元素（延迟到 DOM 就绪再取更稳） =====
  const els = { url: null, btnFetch: null, pageSize: null, btnExport: null, btnClear: null, dataPanel: null };

  // ===== Toast =====
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

  // ===== 表格渲染 =====
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
          <th style="padding:8px">link</th>
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
      const link  = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">link_text</a>` : '';
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

  // ===== 抓取 =====
  const fetchCatalog = async () => {
    try {
      // 重新取一遍，防止热替换或 DOM 更新后引用过期
      els.url = els.url || findUrlInput();

      const inputVal = (els.url && (els.url.value || els.url.textContent) || '').trim();
      if (!inputVal) {
        toast('fail', '请输入或粘贴一个目录/列表页链接');
        return;
      }

      // 尝试把 paste 进来的 “api=xxx&url=xxx” 形式解析出真正 URL
      let targetUrl = inputVal;
      try {
        const parsed = new URL(inputVal);
        // 像 “…/parse?url=https%3A%2F%2Fxxx” 的情况
        const u2 = parsed.searchParams.get('url');
        if (u2) targetUrl = decodeURIComponent(u2);
      } catch { /* 不是 URL 对象也没关系 */ }

      const api = getApiBase();
      if (!api) {
        toast('fail', '缺少后端 API 地址：请确保访问链接里有 ?api=... 参数');
        return;
      }

      const limit = parseInt((els.pageSize && els.pageSize.value) || '50', 10) || 50;

      toast('ok', '正在抓取中…');
      const res = await fetch(`${api}/v1/api/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}`);
      if (!res.ok) {
        toast('fail', `抓取失败：HTTP ${res.status}`);
        render([]);
        return;
      }
      const data = await res.json().catch(() => ({}));

      if (!data || data.ok === false) {
        toast('fail', (data && (data.message || data.error)) ? (data.message || data.error) : '抓取失败');
        render([]);
        return;
      }

      const list = data.products || data.items || [];
      render(list);
      toast('ok', `抓取成功，共 ${list.length} 条`);
    } catch (err) {
      console.error(err);
      toast('fail', `抓取失败：${err.message || err}`);
      render([]);
    }
  };

  const clearData = () => {
    render([]);
    toastEl.style.display = 'none';
  };

  // ===== 绑定事件（DOMContentLoaded后再取 DOM 更稳） =====
  const bind = () => {
    els.btnFetch  = $('#btnFetch')  || $('button[data-role="fetch"]')  || $('button');
    els.pageSize  = $('#pageSize')  || $('select');
    els.btnExport = $('#btnExport') || $('button[data-role="export"]');
    els.btnClear  = $('#btnClear')  || $('button[data-role="clear"]');
    els.dataPanel = $('#data-panel') || $('.data-panel') || document.querySelector('.panel') || document.body;
    els.url       = findUrlInput();

    mountToast();

    if (els.btnFetch) els.btnFetch.addEventListener('click', fetchCatalog);
    if (els.btnClear) els.btnClear.addEventListener('click', clearData);
    if (els.url)      els.url.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fetchCatalog();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
