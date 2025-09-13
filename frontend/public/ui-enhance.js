<!-- public/ui-enhance.js（整份替换） -->
<script>
(() => {
  // ------- 小工具 -------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const create = (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const getApiBase = () => {
    const u = new URL(location.href);
    return u.searchParams.get('api') || '';
  };

  // ------- UI 元素 -------
  const els = {
    url: $('#url') || $('input[type="text"]'),
    btnFetch: $('#btnFetch') || $('button[id="btnFetch"], button:has(span:contains("Fetch")) , button:has(span:contains("抓取"))'),
    pageSize: $('#pageSize') || $('select'),
    btnExport: $('#btnExport') || $('button[id="btnExport"]'),
    btnClear: $('#btnClear') || $('button[id="btnClear"]'),
    dataPanel: $('#data-panel') || $('.data-panel') || $('.table-responsive') || document.body
  };

  // ------- Toast -------
  const toastEl = $('#toast') || create('div', { id: 'toast', style: 'margin:10px 0;padding:8px 12px;border-radius:6px;display:none;' });
  if (!toastEl.parentNode) (els.dataPanel || document.body).prepend(toastEl);
  const toast = (type, msg) => {
    const color = type === 'ok' ? '#0ea5e9' : '#f59e0b';
    toastEl.style.cssText = `margin:10px 0;padding:8px 12px;border-left:4px solid ${color};background:#fff8ee;display:block;`;
    toastEl.textContent = msg;
  };

  // ------- 数据容器保障：tbody id="tbody" -------
  const ensureTbody = () => {
    let tbody = $('#tbody');
    if (tbody) return tbody;
    // 页面没有表格？那就创建一个简易表格容器
    let table = $('table.data-table') || $('table');
    if (!table) {
      table = create('table', { class: 'data-table', style: 'width:100%;border-collapse:collapse;' });
      const thead = create('thead');
      thead.innerHTML = `
        <tr style="text-align:left;border-bottom:1px solid #eee;">
          <th style="padding:8px">#</th>
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
      // 放到输入区下方那块白色大框里
      const panel = els.dataPanel || document.body;
      panel.appendChild(table);
    } else {
      tbody = table.tBodies[0] || create('tbody');
      tbody.id = tbody.id || 'tbody';
      if (!table.tBodies.length) table.appendChild(tbody);
    }
    return tbody;
  };

  const render = (rows) => {
    const tbody = ensureTbody();
    if (!tbody) return; // 再兜底
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = ''; // 清空即可，留白
      return;
    }
    const html = rows.map((it, i) => {
      const sku = it.sku ?? '';
      const title = it.title ?? '';
      const img = it.img ? `<img src="${it.img}" alt="" loading="lazy" style="width:42px;height:42px;object-fit:cover;border:1px solid #eee;border-radius:4px;" />` : '';
      const price = it.price ?? '';
      const moq = it.moq ?? '';
      const link = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">link_text</a>` : '';
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

  const fetchCatalog = async () => {
    try {
      const url = (els.url && els.url.value || '').trim();
      if (!url) {
        toast('fail', '请输入或粘贴一个目录/列表页链接');
        return;
      }
      const api = getApiBase();
      if (!api) {
        toast('fail', '缺少后端 API 地址：请确保访问链接里有 ?api=... 参数');
        return;
      }
      // pageSize 可选，不强依赖
      const limit = parseInt((els.pageSize && els.pageSize.value) || '50', 10) || 50;

      toast('ok', '正在抓取中…');
      const res = await fetch(`${api}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${limit}`);
      const data = await res.json();

      if (!data || data.ok === false) {
        toast('fail', (data && data.message) ? data.message : '抓取失败');
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

  // ------- 事件 -------
  if (els.btnFetch) els.btnFetch.addEventListener('click', fetchCatalog);
  if (els.btnClear) els.btnClear.addEventListener('click', clearData);

  // 回车也触发
  if (els.url) els.url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchCatalog();
  });
})();
</script>
