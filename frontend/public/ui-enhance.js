/* public/ui-enhance.js  — 稳定版（用固定 ID，不再猜控件） */
/* 需：index.html 里有 #input-url、#btnFetch、#btnExport、#btnClear、#result-box（或已有 #data-table tbody） */
/* 需：页面已通过 CDN 引入 ExcelJS 与 FileSaver（你当前 index.html 已经有） */

(function () {
  // ------- 小工具 -------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const toast = (msg) => {
    // 简单提示：尽量不依赖页面已有组件，兜底 alert
    const bar = $('[data-role="toast"]') || $('.toast') || $('#toast');
    if (bar) {
      bar.textContent = msg;
      bar.style.display = '';
      bar.classList.add('show');
      setTimeout(() => bar.classList.remove('show'), 3000);
    } else {
      console.info('[toast]', msg);
      alert(msg);
    }
  };

  // 读 ?api=...
  function getApiBase() {
    const api = new URLSearchParams(location.search).get('api') || '';
    return api.replace(/\/+$/, '');
  }

  // 渲染列表到页面（优先写入既有的 table tbody）
  function renderList(items) {
    const resultBox = $('#result-box') || document.body;
    // 空数据
    if (!items || !items.length) {
      if (resultBox) resultBox.innerHTML = `<div style="color:#9ca3af">ui.no_data</div>`;
      return;
    }

    const existingTBody =
      $('#data-table tbody') ||
      $('table tbody');

    const headers = [
      { key: '_idx', label: '#' },
      { key: 'sku',  label: 'Item No.' },
      { key: 'img',  label: 'Picture' },
      { key: 'title',label: 'Description' },
      { key: 'moq',  label: 'MOQ' },
      { key: 'price',label: 'Unit Price' },
    ];

    const buildRowsHtml = rows => rows.map((it, i) => {
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
      existingTBody.innerHTML = buildRowsHtml(items);
    } else {
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

  // 导出 Excel（依赖 ExcelJS + FileSaver）
  async function exportExcel(rows) {
    if (!rows || !rows.length) return toast('没有可导出的数据');
    if (typeof ExcelJS === 'undefined') return toast('ExcelJS 未加载');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');

    ws.columns = [
      { header: '#',       key: '_idx', width: 6  },
      { header: 'Item No.',key: 'sku',  width: 14 },
      { header: 'Title',   key: 'title',width: 60 },
      { header: 'URL',     key: 'url',  width: 60 },
      { header: 'MOQ',     key: 'moq',  width: 10 },
      { header: 'Price',   key: 'price',width: 12 },
      { header: 'Image',   key: 'img',  width: 60 },
    ];

    rows.forEach((it, i) => ws.addRow({
      _idx: i + 1,
      sku: it.sku || '',
      title: it.title || '',
      url: it.url || '',
      moq: it.moq ?? '',
      price: it.price ?? '',
      img: it.img || ''
    }));

    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const name = `catalog_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;

    if (typeof saveAs === 'function') saveAs(blob, name);
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }
  }

  // 事件绑定（仅用固定 ID）
  function bind() {
    const input    = $('#input-url');
    const btnFetch = $('#btnFetch');
    const btnExp   = $('#btnExport');
    const btnClear = $('#btnClear');

    if (!input)   return toast('找不到输入框（请给链接输入框加 id="input-url"）');
    if (!btnFetch) return toast('找不到“抓取目录”按钮（请加 id="btnFetch"）');

    btnFetch.addEventListener('click', async () => {
      const raw = (input.value || '').trim();
      if (!raw) return toast('请输入或粘贴一个目录/列表页链接');

      const api = getApiBase();
      if (!api) return toast('缺少 api 参数，例如 ?api=https://your-backend.onrender.com');

      const url = `${api}/v1/api/parse?url=${encodeURIComponent(raw)}`;

      try {
        console.info('[fetch] ->', url);
        const res  = await fetch(url, { method: 'GET' });
        const text = await res.text();
        let data; try { data = JSON.parse(text); } catch { data = null; }

        if (!res.ok || !data || data.ok === false) {
          throw new Error(`HTTP ${res.status} / 解析失败`);
        }

        const items = (data.items && data.items.length ? data.items : (data.products || []));
        window.__lastData = items;
        renderList(items);
        toast(`抓取成功，共 ${items.length} 条`);
      } catch (e) {
        console.error(e);
        toast(`抓取失败：${e.message || e}`);
      }
    });

    if (btnExp) {
      btnExp.addEventListener('click', () => exportExcel(window.__lastData || []));
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        window.__lastData = [];
        const box = $('#result-box');
        if (box) box.innerHTML = `<div style="color:#9ca3af">ui.no_data</div>`;
        toast('已清空');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
