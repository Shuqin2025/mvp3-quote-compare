/* public/ui-enhance.js  — 完整版替换 */
/* 最小依赖：页面里已通过 CDN 引入 ExcelJS 与 FileSaver（你当前 index.html 已引入） */

(function () {
  // ------- 工具函数 -------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const byText = (texts) => {
    const all = $$('button, a, [role="button"], input[type="button"], input[type="submit"]');
    texts = texts.map(t => t.toLowerCase());
    return all.find(el => texts.some(t => (el.textContent || el.value || '').trim().toLowerCase() === t)) || null;
  };
  const toast = (msg) => {
    // 页面已有提示条就用；没有就用 alert 兜底
    const bar = $('[data-role="toast"]') || $('.toast') || $('#toast');
    if (bar) {
      bar.textContent = msg;
      bar.style.display = '';
      bar.classList.add('show');
      setTimeout(() => bar.classList.remove('show'), 3500);
    } else {
      alert(msg);
    }
  };

  // 尝试寻找“结果容器”（优先现有容器，否则自动创建）
  function getResultBox() {
    const candidates = [
      '#data', '#result', '#result-box', '#resultPanel', '#data-box', '#dataArea',
      '.result', '.result-box', '.data-box'
    ];
    for (const sel of candidates) {
      const el = $(sel);
      if (el) return el;
    }
    // 找不到就创建一个
    let holder = $('#data-holder') || $('.card-body') || $('.container') || $('main') || document.body;
    let box = document.createElement('div');
    box.id = 'result-box';
    box.style.border = '1px dashed var(--border,#e5e7eb)';
    box.style.borderRadius = '8px';
    box.style.padding = '8px';
    box.style.minHeight = '260px';
    box.style.marginTop = '10px';
    holder.appendChild(box);
    return box;
  }

  // 自动寻找三个关键控件
  function pickDom() {
    // 输入框
    let input = $('#url') || $('#input-url') || $('input[type="text"]') || $('input');
    // 抓取按钮（支持多语言）
    let btnFetch =
      byText(['抓取目录', 'katalog abrufen', 'fetch catalog']) ||
      $('#btnFetch') || $('[data-role="btn-fetch"]');
    // 导出
    let btnExport =
      byText(['导出 excel (.xlsx)', 'excel exportieren (.xlsx)', 'export excel (.xlsx)', '导出 excel', 'export excel']) ||
      $('#btnExport') || $('[data-role="btn-export"]');
    // 清空
    let btnClear =
      byText(['清空数据', 'daten leeren', 'clear data']) ||
      $('#btnClear') || $('[data-role="btn-clear"]');

    return { input, btnFetch, btnExport, btnClear, resultBox: getResultBox() };
  }

  // 获取 API 根地址（来自 ?api=...）
  function getApiBase() {
    const api = new URLSearchParams(location.search).get('api') || '';
    return api.replace(/\/+$/, ''); // 去掉末尾 /
  }

  // ------- 渲染 -------
  function renderList(items) {
    const { resultBox } = pickDom();

    // 兼容空
    if (!items || !items.length) {
      resultBox.innerHTML = `<div style="color:#9ca3af">ui.no_data</div>`;
      return;
    }

    // 如果页面本身已经有一个表格的 tbody，就优先使用
    const existingTBody =
      $('#data-table tbody') ||
      $('table tbody');

    const headers = [
      { key: '_idx', label: '#' },
      { key: 'sku', label: 'Item No.' },
      { key: 'img', label: 'Picture' },
      { key: 'title', label: 'Description' },
      { key: 'moq', label: 'MOQ' },
      { key: 'price', label: 'Unit Price' }
    ];

    // 生成 <tr>
    const buildRowsHtml = (rows) => rows.map((it, i) => {
      const img = it.img ? `<img src="${it.img}" alt="" style="height:38px;object-fit:contain;border:1px solid #eee;border-radius:6px;" />` : '';
      const title = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">${it.title || ''}</a>` : (it.title || '');
      return `<tr>
        <td style="padding:6px 8px;">${i + 1}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${it.sku || ''}</td>
        <td style="padding:6px 8px;">${img}</td>
        <td style="padding:6px 8px;">${title}</td>
        <td style="padding:6px 8px;">${it.moq ?? ''}</td>
        <td style="padding:6px 8px;">${it.price ?? ''}</td>
      </tr>`;
    }).join('');

    if (existingTBody) {
      // 仅替换 tbody 内容
      existingTBody.innerHTML = buildRowsHtml(items);
    } else {
      // 整个表格由脚本创建
      const thead = `<thead><tr>${headers.map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;">${h.label}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${buildRowsHtml(items)}</tbody>`;
      resultBox.innerHTML = `
        <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:8px;">
          <table id="data-table" style="width:100%;border-collapse:collapse;font-size:14px;">
            ${thead}${tbody}
          </table>
        </div>
      `;
    }
  }

  // ------- 导出 Excel -------
  async function exportExcel(data) {
    if (!data || !data.length) {
      toast('没有可导出的数据');
      return;
    }
    if (typeof ExcelJS === 'undefined') {
      toast('ExcelJS 未加载');
      return;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');

    ws.columns = [
      { header: '#', key: '_idx', width: 6 },
      { header: 'Item No.', key: 'sku', width: 14 },
      { header: 'Title', key: 'title', width: 60 },
      { header: 'URL', key: 'url', width: 60 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Image', key: 'img', width: 60 },
    ];

    data.forEach((it, i) => {
      ws.addRow({
        _idx: i + 1,
        sku: it.sku || '',
        title: it.title || '',
        url: it.url || '',
        moq: it.moq ?? '',
        price: it.price ?? '',
        img: it.img || ''
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const name = `catalog_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;
    if (typeof saveAs === 'function') {
      saveAs(blob, name);
    } else {
      // 兜底下载
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }
  }

  // ------- 绑定事件 -------
  function bindEvents() {
    const { input, btnFetch, btnExport, btnClear } = pickDom();

    if (btnFetch) {
      btnFetch.addEventListener('click', async () => {
        const raw = (input && input.value || '').trim();
        if (!raw) {
          toast('请输入或粘贴一个目录/列表页链接');
          return;
        }
        const api = getApiBase();
        if (!api) {
          toast('缺少 api 参数，例如 ?api=https://your-backend.onrender.com');
          return;
        }
        const endpoint = `${api}/v1/api/parse?url=${encodeURIComponent(raw)}`;

        try {
          // 为了方便你在 Console 中观察
          console.info('[fetch] ->', endpoint);
          const res = await fetch(endpoint, { method: 'GET' });
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch { data = null; }

          if (!res.ok || !data || data.ok === false) {
            throw new Error(`HTTP ${res.status} / 解析失败`);
          }

          const items = (data.items && data.items.length ? data.items : (data.products || []));
          window.__lastData = items;          // 保存给“导出 Excel”用
          renderList(items);                  // 渲染到页面
          toast(`抓取成功，共 ${items.length} 条`);
        } catch (err) {
          console.error(err);
          toast(`抓取失败：${err.message || err}`);
        }
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        const rows = window.__lastData || [];
        await exportExcel(rows);
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        window.__lastData = [];
        const { resultBox } = pickDom();
        resultBox.innerHTML = `<div style="color:#9ca3af">ui.no_data</div>`;
        toast('已清空');
      });
    }
  }

  // 初始化
  document.addEventListener('DOMContentLoaded', bindEvents);
})();
