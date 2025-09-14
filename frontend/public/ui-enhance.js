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
    const selList = [
      '#url','#inputUrl','#url-input','[name="url"]','[data-role="url"]',
      'input[type="url"]','input[type="text"]','textarea'
    ];
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
    resultRoot.style.cssText = 'margin:16px 0; padding:0; border:0; background:#fff;';
    document.body.appendChild(resultRoot); // 永远挂在 body 末尾
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
  let lastList = []; // 记住最新数据，供导出用

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

      // 导出按钮（优先 .xlsx 内嵌图片，若失败则退化到 .xls）
      let bar = root.querySelector('#mvp3-bar');
      if (!bar) {
        bar = create('div', { id:'mvp3-bar' });
        bar.style.cssText = 'margin:10px 0;display:flex;gap:8px;flex-wrap:wrap';
        const btn = create('button', { type:'button' });
        btn.textContent = '导出 Excel（.xlsx）';
        btn.style.cssText = 'padding:6px 10px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer';
        btn.addEventListener('click', exportExcelXlsx);
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

    lastList = Array.isArray(rows) ? rows : [];

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

  // ===== .xlsx 导出（内嵌真实图片，依赖 window.ExcelJS 与后端 /v1/api/img 代理）=====
  const exportExcelXlsx = async () => {
    try {
      const rows = lastList || [];
      if (!rows.length) return toast('fail','没有可导出的数据');

      // 若没有 ExcelJS，退化成 .xls（HTML 版）
      if (!window.ExcelJS) return exportExcelFallback();

      const ExcelJS = window.ExcelJS;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('catalog');

      // 列定义
      ws.columns = [
        { header:'#',          key:'idx',  width:4  },
        { header:'Item No.',   key:'sku',  width:18 },
        { header:'Picture',    key:'pic',  width:10 },
        { header:'Description',key:'desc', width:60 },
        { header:'MOQ',        key:'moq',  width:12 },
        { header:'Unit Price', key:'price',width:16 },
        { header:'Link',       key:'link', width:12 },
      ];

      // 行高 & 对齐
      ws.getRow(1).font = { bold:true };
      // 数据行从 2 开始
      const startRow = 2;

      // 准备 API
      const api = getApiBase();

      // 批量填充
      for (let i = 0; i < rows.length; i++) {
        const it = rows[i] || {};
        const r  = startRow + i;

        // 值
        ws.getCell(`A${r}`).value = i + 1;
        ws.getCell(`B${r}`).value = (it.sku ?? it.itemNo ?? it.code ?? '') + '';
        ws.getCell(`C${r}`).value = ''; // 图片列
        ws.getCell(`D${r}`).value = (it.title ?? it.name ?? '') + '';
        ws.getCell(`E${r}`).value = (it.moq ?? '') + '';
        ws.getCell(`F${r}`).value = (it.price ?? '') + '';
        if (it.url) {
          ws.getCell(`G${r}`).value = { text: '链接', hyperlink: it.url };
          ws.getCell(`G${r}`).font = { color: { argb: 'FF2F6FED' }, underline: true };
        }

        // 行高给图片留空间
        ws.getRow(r).height = 32;

        // 内嵌图片（走后端代理，避免 CORS）
        if (api && it.img) {
          try {
            const imgRes = await fetch(`${api}/v1/api/img?url=${encodeURIComponent(it.img)}`);
            if (imgRes.ok) {
              const ab  = await imgRes.arrayBuffer();
              const buf = new Uint8Array(ab);

              // 简单按后缀推测类型
              const ext = /\.png($|\?)/i.test(it.img) ? 'png' : 'jpeg';
              const imgId = wb.addImage({ buffer: buf, extension: ext });

              // 把图片放到 C 列该行（单元格范围）
              ws.addImage(imgId, {
                tl: { col: 2.1, row: r - 1 + 0.15 },  // C列(从0计数=>2)，微调位置
                ext: { width: 32, height: 32 }
              });
            }
          } catch (e) {
            // 图片失败不影响导出
            console.warn('image embed fail:', e);
          }
        }
      }

      // 样式小优化
      ws.columns.forEach(c => { c.alignment = { vertical:'middle', wrapText:true }; });
      ws.getColumn('A').alignment = { vertical:'middle', horizontal:'center' };
      ws.getColumn('C').alignment = { vertical:'middle', horizontal:'center' };

      // 生成并下载
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url    = URL.createObjectURL(blob);
      const a      = create('a', { download: `catalog-${Date.now()}.xlsx` });
      a.href = url; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      toast('ok','Excel（.xlsx）已生成');
    } catch (err) {
      console.error(err);
      toast('fail','导出 .xlsx 失败，已退化为 .xls');
      exportExcelFallback();
    }
  };

  // 退化版：Excel 可打开的 HTML（.xls）
  const exportExcelFallback = () => {
    const table = ensureResultRoot().querySelector('table.mvp3-table');
    if (!table) return toast('fail','没有可导出的数据');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url  = URL.createObjectURL(blob);
    const a = create('a', { download: `catalog-${Date.now()}.xls` });
    a.href = url; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  };

  // ===== 抓取逻辑 =====
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
    lastList = [];
  };

  // ===== 绑定事件 =====
  const bind = () => {
    ensureResultRoot();
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
