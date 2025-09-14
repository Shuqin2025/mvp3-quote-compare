/* public/ui-enhance.js —— 纯 JS 文件，勿包 <script> 标签 */

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
      return (u.searchParams.get('api') || '').replace(/\/+$/,'');
    } catch { return ''; }
  };

  // “聪明”查找 URL 输入框（适配不同占位页）
  const findUrlInput = () => {
    const btn = $('#btnFetch') || $('button[data-role="fetch"]') || $('button');
    const scopes = [];
    if (btn) {
      const box = btn.closest('form, .toolbar, .controls, .row, .flex, .container');
      if (box) scopes.push(box);
    }
    scopes.push(document);

    const candidates = [];
    const selList = ['#url','#inputUrl','#url-input','[name="url"]','[data-role="url"]','input[type="url"]','input[type="text"]','textarea'];
    for (const scope of scopes) {
      for (const sel of selList) candidates.push(...$$(sel, scope));
      candidates.push(
        ...$$('input,textarea', scope).filter(el => {
          const ph = (el.getAttribute('placeholder') || '').toLowerCase();
          return /url|http|链接|地址|katalog|list|产品|product/.test(ph);
        })
      );
    }
    const visible = candidates.filter(el => el && !el.disabled && el.offsetParent !== null);
    visible.sort((a,b) => (b.value?.length||0) - (a.value?.length||0));
    return visible[0] || null;
  };

  // ===== 我们自己的结果容器：避免被宿主页面清空 =====
  let resultRoot = null;
  const ensureResultRoot = () => {
    if (resultRoot && document.body.contains(resultRoot)) return resultRoot;
    resultRoot = create('div', { id: 'mvp3-result' });
    resultRoot.style.cssText =
      'margin:16px 0; padding:0; border:0; background:#fff;';
    // 永远挂在 body 最后，避开宿主的内部布局
    document.body.appendChild(resultRoot);
    return resultRoot;
  };

  // ===== Toast =====
  const toastEl = create('div', { id: 'toast', style: 'display:none' });
  const mountToast = () => {
    const host = ensureResultRoot();
    if (!toastEl.parentNode) {
      toastEl.style.cssText =
        'margin:10px 0;padding:8px 12px;border-left:4px solid #0ea5e9;background:#f0f9ff;display:none;';
      host.prepend(toastEl);
    }
  };
  const toast = (type, msg) => {
    const color = type === 'ok' ? '#0ea5e9' : '#f59e0b';
    toastEl.style.cssText =
      `margin:10px 0;padding:8px 12px;border-left:4px solid ${color};background:#fff8ee;display:block;`;
    toastEl.textContent = msg;
  };

  // ===== 表格渲染到“我们自己的容器”里 =====
  const ensureTable = () => {
    const root = ensureResultRoot();
    let table = root.querySelector('table.mvp3-table');
    if (!table) {
      table = create('table', {
        class: 'mvp3-table',
        style: 'width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed'
      });
      const thead = create('thead');
      thead.innerHTML = `
        <tr style="text-align:left;border-bottom:1px solid #eee;background:#fafafa">
          <th style="padding:8px;width:48px">#</th>
          <th style="padding:8px;width:180px">Item No.</th>
          <th style="padding:8px;width:64px">Picture</th>
          <th style="padding:8px">Description</th>
          <th style="padding:8px;width:120px">MOQ</th>
          <th style="padding:8px;width:140px">Unit Price</th>
          <th style="padding:8px;width:80px">Link</th>
        </tr>`;
      const tbody = create('tbody', { id: 'mvp3-tbody' });
      table.appendChild(thead);
      table.appendChild(tbody);
      root.appendChild(table);

      // 导出按钮（轻量实现：生成 Excel 兼容 HTML）
      let bar = root.querySelector('#mvp3-bar');
      if (!bar) {
        bar = create('div', { id:'mvp3-bar' });
        bar.style.cssText = 'margin:10px 0;display:flex;gap:8px;flex-wrap:wrap';
        const btn = create('button', { type:'button' });
        btn.textContent = '导出 Excel（.xlsx）';
        btn.style.cssText = 'padding:6px 10px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer';
        btn.addEventListener('click', exportExcel);
        bar.appendChild(btn);
        root.prepend(bar);
      }
    }
    return table;
  };

  const render = (rows) => {
    ensureTable();
    const tbody = $('#mvp3-tbody');
    if (!tbody) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:12px;color:#999">No data</td></tr>';
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
      const link  = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">链接</a>` : '';
      return `
        <tr style="border-bottom:1px dashed #eee">
          <td style="padding:8px">${i + 1}</td>
          <td style="padding:8px;word-break:break-all">${sku}</td>
          <td style="padding:8px">${img}</td>
          <td style="padding:8px;word-break:break-word">${title}</td>
          <td style="padding:8px">${moq}</td>
          <td style="padding:8px">${price}</td>
          <td style="padding:8px">${link}</td>
        </tr>`;
    }).join('');
    tbody.innerHTML = html;
  };

  // ===== 轻量导出（Excel 可直接打开）=====
  const exportExcel = () => {
    const table = ensureResultRoot().querySelector('table.mvp3-table');
    if (!table) return toast('fail','没有可导出的数据');
    // 用 Excel 兼容的 HTML
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8" />
    </head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url  = URL.createObjectURL(blob);
    const a = create('a', { download: `catalog-${Date.now()}.xls` });
    a.href = url; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  };

  // ===== 抓取 =====
  const els = { url:null, btnFetch:null, pageSize:null, btnClear:null };
  const fetchCatalog = async () => {
    try {
      els.url = els.url || findUrlInput();
      const inputVal = (els.url && (els.url.value || els.url.textContent) || '').trim();
      if (!inputVal) return toast('fail','请输入或粘贴一个目录/列表页链接');

      let targetUrl = inputVal;
      try {
        const parsed = new URL(inputVal);
        const u2 = parsed.searchParams.get('url');
        if (u2) targetUrl = decodeURIComponent(u2);
      } catch {}

      const api = getApiBase();
      if (!api) return toast('fail','缺少后端 API 地址：请确保访问链接里有 ?api=... 参数');

      const limit = parseInt((els.pageSize && els.pageSize.value) || '50', 10) || 50;

      toast('ok','正在抓取中…');
      const res = await fetch(`${api}/v1/api/catalog/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}`);
      if (!res.ok) { render([]); return toast('fail', `抓取失败：HTTP ${res.status}`); }
      const data = await res.json().catch(() => ({}));

      if (!data || data.ok === false) { render([]); return toast('fail', data?.message || data?.error || '抓取失败'); }

      const list = data.products || data.items || [];
      render(list);
      toast('ok', `抓取成功，共 ${list.length} 条`);
    } catch (err) {
      console.error(err);
      render([]);
      toast('fail', `抓取失败：${err.message || err}`);
    }
  };

  const clearData = () => {
    ensureTable();
    const tbody = $('#mvp3-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:12px;color:#999">No data</td></tr>';
    toastEl.style.display = 'none';
  };

  // ===== 绑定事件 =====
  const bind = () => {
    ensureResultRoot(); // 先创建独立容器
    mountToast();

    els.btnFetch  = $('#btnFetch')  || $('button[data-role="fetch"]')  || $('button');
    els.pageSize  = $('#pageSize')  || $('select');
    els.btnClear  = $('#btnClear')  || $('button[data-role="clear"]');
    els.url       = findUrlInput();

    if (els.btnFetch) els.btnFetch.addEventListener('click', fetchCatalog);
    if (els.btnClear) els.btnClear.addEventListener('click', clearData);
    if (els.url)      els.url.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchCatalog(); });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
