/* public/ui-enhance.js —— 纯 JS 文件，勿放 <script> 标签 */

(() => {
  // ===== 小工具 =====
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const create = (tag, attrs = {}) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
  const getApiBase = () => { try { const u = new URL(location.href); return (u.searchParams.get('api') || '').replace(/\/+$/,''); } catch { return ''; } };

  // 找输入框（尽量聪明）
  const findUrlInput = () => {
    const btn = $('#btnFetch') || $('button[data-role="fetch"]') || $('button');
    const scopes = [];
    if (btn) { const box = btn.closest('form, .toolbar, .controls, .row, .flex, .container'); if (box) scopes.push(box); }
    scopes.push(document);
    const candidates = [];
    const selList = ['#url','#inputUrl','#url-input','[name="url"]','[data-role="url"]','input[type="url"]','input[type="text"]','textarea'];
    for (const scope of scopes) {
      for (const sel of selList) candidates.push(...$$(sel, scope));
      candidates.push(...$$('input,textarea', scope).filter(el => {
        const ph = (el.getAttribute('placeholder') || '').toLowerCase();
        return /url|http|链接|地址|katalog|list|产品|product/.test(ph);
      }));
    }
    const visible = candidates.filter(el => el && !el.disabled && el.offsetParent !== null);
    visible.sort((a,b) => (b.value?.length||0) - (a.value?.length||0));
    return visible[0] || null;
  };

  // ===== 如果容器是 <textarea>，就在其后面插入可视化 DIV 用于渲染表格 =====
  const getRenderHost = () => {
    let host = $('#data-panel') || $('.data-panel') || document.querySelector('.panel');
    if (!host) host = $('textarea') || $('input') || document.body;

    const tag = (host.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      let div = document.getElementById('render-host');
      if (!div) {
        div = document.createElement('div');
        div.id = 'render-host';
        div.style.cssText = 'margin-top:12px;';
        host.insertAdjacentElement('afterend', div);
      }
      return div;
    }
    return host;
  };

  // ===== 轻提示 =====
  const toastEl = create('div', { id: 'toast', style: 'display:none' });
  const mountToast = () => {
    const host = getRenderHost();
    if (!toastEl.parentNode) {
      toastEl.style.cssText = 'margin:10px 0;padding:8px 12px;border-radius:6px;background:#fff8ee;display:none;';
      host.prepend(toastEl);
    }
  };
  const toast = (type, msg) => {
    const color = type === 'ok' ? '#0ea5e9' : '#f59e0b';
    toastEl.style.cssText = `margin:10px 0;padding:8px 12px;border-left:4px solid ${color};background:#fff8ee;display:block;`;
    toastEl.textContent = msg;
  };

  // ===== 表格渲染 + 数据缓存（给导出用） =====
  let lastRows = [];   // 记住最近一次抓回的数据
  const ensureTbody = () => {
    let tbody = $('#tbody');
    if (tbody) return tbody;

    let table = $('table.data-table') || $('table');
    if (!table) {
      table = create('table', { class: 'data-table', style: 'width:100%;border-collapse:collapse;font-size:14px;' });
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
      getRenderHost().appendChild(table);
    } else {
      tbody = table.tBodies[0] || create('tbody');
      if (!tbody.id) tbody.id = 'tbody';
      if (!table.tBodies.length) table.appendChild(tbody);
    }
    return tbody;
  };

  const render = (rows) => {
    lastRows = Array.isArray(rows) ? rows : [];
    const tbody = ensureTbody();
    if (!tbody) return;
    if (!Array.isArray(rows) || rows.length === 0) { tbody.innerHTML = ''; return; }

    const html = rows.map((it, i) => {
      const sku   = it.sku ?? it.itemNo ?? it.code ?? '';
      const title = it.title ?? it.name ?? '';
      const img   = it.img ? `<img src="${it.img}" alt="" loading="lazy" style="width:42px;height:42px;object-fit:cover;border:1px solid #eee;border-radius:4px;" />` : '';
      const price = it.price ?? '';
      const moq   = it.moq ?? '';
      const link  = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">链接</a>` : '';
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

  // ===== 动态加载 XLSX 库（SheetJS），仅在需要时加载 =====
  const loadXlsx = () => new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('XLSX 加载失败'));
    document.head.appendChild(s);
  });

  // ===== 导出：优先导出 XLSX；失败则回退为 CSV =====
  const exportCsvFallback = () => {
    if (!lastRows.length) { toast('fail', '没有可导出的数据'); return; }
    const header = ['Item No.','Picture','Description','MOQ','Unit Price','Link'];
    const lines = [header.join(',')];
    const esc = (s) => {
      const t = String(s ?? '');
      return /[",\n]/.test(t) ? `"${t.replace(/"/g,'""')}"` : t;
    };
    lastRows.forEach(it => {
      lines.push([
        esc(it.sku ?? it.itemNo ?? it.code ?? ''),
        esc(it.img ?? ''),
        esc(it.title ?? it.name ?? ''),
        esc(it.moq ?? ''),
        esc(it.price ?? ''),
        esc(it.url ?? '')
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `catalog-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('ok', '已导出 CSV（Excel 可直接打开）');
  };

  const exportXlsx = async () => {
    if (!lastRows.length) { toast('fail', '没有可导出的数据'); return; }
    try {
      await loadXlsx();
      const rows = lastRows.map(it => ({
        'Item No.':   it.sku ?? it.itemNo ?? it.code ?? '',
        'Picture':    it.img ?? '',
        'Description':it.title ?? it.name ?? '',
        'MOQ':        it.moq ?? '',
        'Unit Price': it.price ?? '',
        'Link':       it.url ?? ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows, { header: ['Item No.','Picture','Description','MOQ','Unit Price','Link'] });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalog');
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // 优先使用 FileSaver（项目里大概率已引入）；否则使用 <a> 兜底
      if (typeof saveAs === 'function') {
        saveAs(blob, `catalog-${Date.now()}.xlsx`);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `catalog-${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      toast('ok', '已导出 Excel（.xlsx）');
    } catch (e) {
      console.warn('导出 XLSX 失败，回退 CSV：', e);
      exportCsvFallback();
    }
  };

  // ===== 抓取 =====
  const fetchCatalog = async () => {
    try {
      const urlEl = findUrlInput();
      const inputVal = (urlEl && (urlEl.value || urlEl.textContent) || '').trim();
      if (!inputVal) { toast('fail', '请输入或粘贴一个目录/列表页链接'); return; }

      // 兼容「把链接包进 ?url=xxx 的形式」
      let targetUrl = inputVal;
      try { const parsed = new URL(inputVal); const u2 = parsed.searchParams.get('url'); if (u2) targetUrl = decodeURIComponent(u2); } catch {}

      const api = getApiBase();
      if (!api) { toast('fail', '缺少后端 API 地址：请确保访问链接里有 ?api=... 参数'); return; }

      const pageSizeEl = $('#pageSize') || $('select');
      const limit = parseInt((pageSizeEl && pageSizeEl.value) || '50', 10) || 50;

      toast('ok', '正在抓取中…');
      // 统一使用新的后端解析路由（你的后端已支持）
      const res = await fetch(`${api}/v1/api/catalog/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}`);
      if (!res.ok) { toast('fail', `抓取失败：HTTP ${res.status}`); render([]); return; }

      const data = await res.json().catch(() => ({}));
      // 支持 products 或 items 两种字段（你给的样例都有）
      const list = (data && (data.products || data.items)) || [];
      render(list);
      toast('ok', `抓取成功，共 ${list.length} 条`);
    } catch (err) {
      console.error(err);
      toast('fail', `抓取失败：${err.message || err}`);
      render([]);
    }
  };

  const clearData = () => { render([]); toastEl.style.display = 'none'; };

  // ===== 绑定事件 =====
  const bind = () => {
    mountToast();

    // 抓取
    ( $('#btnFetch') || $('button[data-role="fetch"]') || $('button') ).addEventListener('click', fetchCatalog);

    // 导出：优先绑定页面自带的 “导出 Excel (.xlsx)” 按钮；如果没有就自动加一个
    let btnExport = $('#btnExport') 
                 || $$('button').find(b => /excel|xlsx/i.test(b.textContent || ''))
                 || $('button[data-role="export"]');
    if (!btnExport) {
      const btnFetch = $('#btnFetch') || $('button[data-role="fetch"]') || $('button');
      btnExport = document.createElement('button');
      btnExport.id = 'btnExport';
      btnExport.textContent = '导出 Excel（.xlsx）';
      btnExport.style.cssText = 'margin-left:8px;padding:6px 10px;';
      if (btnFetch && btnFetch.parentElement) btnFetch.parentElement.appendChild(btnExport);
      else document.body.prepend(btnExport);
    }
    btnExport.addEventListener('click', exportXlsx);

    // 清空
    const btnClear = $('#btnClear') || $('button[data-role="clear"]');
    if (btnClear) btnClear.addEventListener('click', clearData);

    // 输入框回车直接抓取
    const urlEl = findUrlInput();
    if (urlEl) urlEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchCatalog(); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
