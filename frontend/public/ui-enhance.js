/* public/ui-enhance.js —— 纯 JS 文件，勿放 <script> 标签 */

(() => {
  // ========= 小工具 =========
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const create = (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const getApiBase = () => {
    try { const u = new URL(location.href); return (u.searchParams.get('api') || '').replace(/\/+$/,''); }
    catch { return ''; }
  };

  // 找输入框（尽量聪明）
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
      // 根据 placeholder 也猜
      candidates.push(...$$('input,textarea', scope).filter(el => {
        const ph = (el.getAttribute('placeholder') || '').toLowerCase();
        return /url|http|链接|地址|katalog|list|产品|product/.test(ph);
      }));
    }
    const visible = candidates.filter(el => el && !el.disabled && el.offsetParent !== null);
    visible.sort((a,b) => (b.value?.length||0) - (a.value?.length||0));
    return visible[0] || null;
  };

  // 如果容器是 <textarea>，就在其后面插入一个可视化 DIV 作为表格挂载点
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

  // ========= 轻提示 =========
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

  // ========= 表格渲染 + 数据缓存（给导出用） =========
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

  // ========= 动态加载依赖 =========
  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`加载失败: ${src}`));
    document.head.appendChild(s);
  });

  // ExcelJS（用于嵌入图片） + FileSaver
  const ensureExcelJs = async () => {
    if (!window.ExcelJS) {
      await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js');
    }
    if (typeof saveAs !== 'function') {
      await loadScript('https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js');
    }
  };

  // 把远程图片转成 base64（ExcelJS 需要）
  const fetchImageAsBase64 = async (url) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('image http ' + res.status);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);   // data:xxx;base64,...
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch {
      return ''; // 图片失败就跳过
    }
  };

  // ========= 导出：优先导出 XLSX（嵌入图片）；失败则回退为 CSV =========
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
      toast('ok', '正在生成 Excel（图片较多时需数秒）…');
      await ensureExcelJs();

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Catalog');
      ws.columns = [
        { header: '#',          key: '_idx',  width: 6  },
        { header: 'Item No.',   key: 'sku',   width: 18 },
        { header: 'Picture',    key: 'img',   width: 18 },
        { header: 'Description',key: 'title', width: 50 },
        { header: 'MOQ',        key: 'moq',   width: 10 },
        { header: 'Unit Price', key: 'price', width: 14 },
        { header: 'Link',       key: 'url',   width: 18 },
      ];

      // 写入行
      lastRows.forEach((it, i) => {
        ws.addRow({
          _idx:  i + 1,
          sku:   it.sku ?? it.itemNo ?? it.code ?? '',
          img:   '', // 图片单独插入
          title: it.title ?? it.name ?? '',
          moq:   it.moq ?? '',
          price: it.price ?? '',
          url:   it.url ?? ''
        });
      });

      // 给链接列加超链接
      for (let r = 2; r <= ws.rowCount; r++) {
        const c = ws.getCell(r, 7);
        const href = lastRows[r-2]?.url;
        if (href) c.value = { text: '链接', hyperlink: href, tooltip: href };
        c.font = { color: { argb: 'FF1976D2' }, underline: true };
      }

      // 插入图片（C 列，从第 2 行开始）
      for (let i = 0; i < lastRows.length; i++) {
        const url = lastRows[i]?.img;
        if (!url) continue;
        const base64 = await fetchImageAsBase64(url);
        if (!base64) continue;
        const ext = (base64.startsWith('data:image/png')) ? 'png' : 'jpeg';
        const imageId = wb.addImage({ base64, extension: ext });
        const rowIndex = i + 2;
        // 把图片放进 C 列（第 3 列）
        ws.addImage(imageId, {
          tl: { col: 2.2, row: rowIndex - 0.6 }, // 微调位置
          ext: { width: 60, height: 60 }
        });
        // 行高设置大一点
        ws.getRow(rowIndex).height = 48;
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `catalog-${Date.now()}.xlsx`);
      toast('ok', '已导出 Excel（.xlsx）');

    } catch (e) {
      console.warn('导出 XLSX 失败，回退 CSV：', e);
      exportCsvFallback();
    }
  };

  // ========= 抓取 =========
  const fetchCatalog = async () => {
    try {
      const urlEl = findUrlInput();
      const inputVal = (urlEl && (urlEl.value || urlEl.textContent) || '').trim();
      if (!inputVal) { toast('fail', '请输入或粘贴一个目录/列表页链接'); return; }

      // 兼容 ?url=xxx 这种嵌套
      let targetUrl = inputVal;
      try { const parsed = new URL(inputVal); const u2 = parsed.searchParams.get('url'); if (u2) targetUrl = decodeURIComponent(u2); } catch {}

      const api = getApiBase();
      if (!api) { toast('fail', '缺少后端 API 地址：请确保访问链接里有 ?api=... 参数'); return; }

      const pageSizeEl = $('#pageSize') || $('select');
      const limit = parseInt((pageSizeEl && pageSizeEl.value) || '50', 10) || 50;

      toast('ok', '正在抓取中…');
      // 统一使用新的后端别名路由；若后端没有该路由，下面的 307 重定向会自动回到旧路由处理
      const res = await fetch(`${api}/v1/api/catalog/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}`);
      if (!res.ok) { toast('fail', `抓取失败：HTTP ${res.status}`); render([]); return; }

      const data = await res.json().catch(() => ({}));
      // 兼容 products / items 字段
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

  // ========= 绑定事件 =========
  const bind = () => {
    mountToast();

    // 抓取
    ( $('#btnFetch')
      || $$('button').find(b => /抓取|fetch/i.test(b.textContent))
      || $('button[data-role="fetch"]')
    )?.addEventListener('click', fetchCatalog);

    // 导出（优先 xlsx）
    ( $('#btnExport')
      || $$('button').find(b => /Excel|导出/i.test(b.textContent))
      || $('button[data-role="export"]')
    )?.addEventListener('click', exportXlsx);

    // 清空
    ( $('#btnClear')
      || $$('button').find(b => /清空|清除|clear/i.test(b.textContent))
      || $('button[data-role="clear"]')
    )?.addEventListener('click', clearData);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
