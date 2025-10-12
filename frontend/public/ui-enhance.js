/**
 * MVP3 前端增强脚本（完整替换版）
 * - 读取 ?api= 指向的网关根，例如 ?api=https://yunivera-gateway.onrender.com
 * - 仅通过网关抓取：POST /v1/api/catalog/parse
 * - 图片展示统一走 /v1/api/image?url=...
 * - 导出：若检测到 ExcelJS 则导出 .xlsx（可尝试嵌入图片 Base64），否则回退 CSV
 */
(() => {
  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const els = {
    url: $('#url') || $('input[type="url"], input[name="url"]'),
    btnFetch: $('#btnFetch') || $('#抓取目录') || $$('.btn').find(b => /抓取/.test(b?.textContent || '')),
    pageSize: $('#pageSize') || $('select'),
    btnExport: $('#btnExport') || $$('.btn').find(b => /导出/i.test(b?.textContent || '')),
    btnClear: $('#btnClear') || $$('.btn').find(b => /清空/.test(b?.textContent || '')),
    toast: $('#toast') || $('.toast') || $('.alert'),
    tbody: $('#grid tbody') || $('table tbody'),
    table: $('#grid') || $('table'),
  };

  function showToast(msg, type = 'info') {
    // 页面已有提示条就复用，否则临时创建
    let bar = els.toast;
    if (!bar) {
      bar = document.createElement('div');
      bar.style.cssText = 'margin:12px 0;padding:10px;border-radius:6px;background:#f6f7f9;color:#333;';
      els.table?.parentElement?.insertBefore(bar, els.table);
      els.toast = bar;
    }
    bar.textContent = msg;
    bar.style.background = type === 'ok' ? '#e8fff2' : type === 'warn' ? '#fff7e6' : type === 'err' ? '#ffecec' : '#f6f7f9';
  }

  function getApiBase() {
    const u = new URL(location.href);
    const api = u.searchParams.get('api')?.trim();
    if (!api) return '';
    try {
      const x = new URL(api);
      // 去掉最后的斜杠，避免双斜杠
      return x.origin + (x.pathname.replace(/\/+$/,''));
    } catch {
      return '';
    }
  }
  const API_BASE = getApiBase();

  // ---------- state ----------
  let rows = [];     // 渲染用的 2D 数组（行）
  let source = null; // 网关原始返回

  // ---------- render ----------
  function clearData() {
    rows = [];
    source = null;
    if (els.tbody) els.tbody.innerHTML = '';
    showToast('已清空', 'info');
  }

  function buildImg(url) {
    if (!url) return '';
    const proxied = `${API_BASE}/v1/api/image?url=${encodeURIComponent(url)}`;
    return `<img src="${proxied}" alt="" style="max-width:96px;max-height:72px;object-fit:contain;border:1px solid #eee;border-radius:4px;padding:2px;background:#fff">`;
  }

  function renderTable(products = []) {
    if (!els.tbody) return;
    const limit = Number(els.pageSize?.value || 50);
    const preview = products.slice(0, limit);

    const html = preview.map((p, i) => {
      const idx = i + 1;
      const sku = p.sku ?? '';
      const title = p.title ?? p.name ?? '';
      const qty = p.moq ?? p.qty ?? p.quantity ?? '';
      const price = p.price ?? '';
      const link = p.link ?? p.url ?? '';
      // 取首图：img / images[0]
      const imgUrl = p.img || (Array.isArray(p.imgs) && p.imgs[0]) || (Array.isArray(p.images) && p.images[0]) || '';
      return `<tr>
        <td>${idx}</td>
        <td>${escapeHtml(sku)}</td>
        <td>${imgUrl ? buildImg(imgUrl) : ''}</td>
        <td style="max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</td>
        <td>${escapeHtml(String(qty))}</td>
        <td>${escapeHtml(String(price))}</td>
        <td>${link ? `<a href="${link}" target="_blank" rel="noopener">链接</a>` : ''}</td>
      </tr>`;
    }).join('');
    els.tbody.innerHTML = html;

    const total = products.length;
    showToast(`抓取成功：共 ${total} 条（预览前 ${preview.length} 条）`, 'ok');
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  // ---------- fetch ----------
  async function fetchCatalog() {
    const url = (els.url?.value || '').trim();
    if (!url) return showToast('请输入目录链接', 'warn');
    if (!API_BASE) return showToast('缺少 ?api= 网关地址', 'err');

    // 清空旧数据
    if (els.tbody) els.tbody.innerHTML = '';
    showToast('正在抓取…', 'info');

    try {
      const limit = Number(els.pageSize?.value || 50);
      // 固定只走网关 parse，不做任何本地解析兜底
      const res = await fetch(`${API_BASE}/v1/api/catalog/parse`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          limit,
          // 以下参数保持与网关对齐，方便以后扩展
          imgCount: 2,
          compare: 1,
          detailSkuMax: 18,
          detailSkuDelim: ' '
        })
      });

      if (!res.ok) {
        const text = await res.text().catch(()=>'');
        throw new Error(`网关返回 ${res.status}：${text || res.statusText}`);
      }

      const data = await res.json();
      source = data;

      if (!data || data.ok === false) {
        const msg = data?.msg || data?.error || '网关返回失败';
        throw new Error(msg);
      }

      const products = Array.isArray(data.products) ? data.products : [];
      if (!products.length) {
        // 没产品时给出更多上下文，方便排错
        console.warn('parse empty payload:', data);
        showToast('抓取完成，但未解析到产品。可能该页面是分类页/空页，或需登录/翻页。', 'warn');
      }
      renderTable(products);
    } catch (err) {
      console.error(err);
      showToast(`抓取失败：${err.message || err}`, 'err');
    }
  }

  // ---------- export ----------
  async function exportExcel() {
    if (!rows?.length && !source?.products?.length) {
      return showToast('无可导出的数据', 'warn');
    }
    const products = source?.products || [];

    // 先做 CSV（稳）
    const headers = ['#','货号','图片','描述','起订量','单价','链接'];
    const csvRows = [headers.join(',')];

    const limit = Number(els.pageSize?.value || 50);
    const preview = products.slice(0, limit);

    preview.forEach((p, i) => {
      const idx = i + 1;
      const sku = sanitizeCsv(p.sku);
      const title = sanitizeCsv(p.title ?? p.name ?? '');
      const qty = sanitizeCsv(p.moq ?? p.qty ?? p.quantity ?? '');
      const price = sanitizeCsv(p.price ?? '');
      const link = sanitizeCsv(p.link ?? p.url ?? '');
      const firstImg = p.img || (Array.isArray(p.imgs) && p.imgs[0]) || (Array.isArray(p.images) && p.images[0]) || '';
      csvRows.push([idx, sku, firstImg, title, qty, price, link].join(','));
    });

    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `catalog_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);

    // 如果页面已引入 ExcelJS，额外尝试生成 xlsx，并把图片替换为 dataURL（需要 /v1/api/image64）
    if (window.ExcelJS) {
      try {
        await exportXlsxWithImages(preview);
      } catch (e) {
        console.warn('xlsx 导出失败（已回落 csv）：', e);
      }
    }
  }

  function sanitizeCsv(s) {
    const v = String(s ?? '');
    if (/[,"\n]/.test(v)) return `"${v.replace(/"/g,'""')}"`;
    return v;
  }

  async function exportXlsxWithImages(products) {
    const ExcelJS = window.ExcelJS;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Catalog');

    const headers = ['#','货号','图片','描述','起订量','单价','链接'];
    ws.addRow(headers);

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const idx = i + 1;
      const row = ws.addRow([
        idx,
        p.sku ?? '',
        '', // 图片占位
        p.title ?? p.name ?? '',
        p.moq ?? p.qty ?? p.quantity ?? '',
        p.price ?? '',
        p.link ?? p.url ?? ''
      ]);

      // 尝试获取 base64
      const imgUrl = p.img || (Array.isArray(p.imgs) && p.imgs[0]) || (Array.isArray(p.images) && p.images[0]) || '';
      if (imgUrl && API_BASE) {
        try {
          const r = await fetch(`${API_BASE}/v1/api/image64?url=${encodeURIComponent(imgUrl)}`, { mode: 'cors' });
          const j = await r.json();
          if (j?.ok && /^data:image\//.test(j.base64)) {
            const imgId = wb.addImage({ base64: j.base64, extension: (j.base64.match(/^data:image\/(\w+)/)?.[1] || 'png') });
            // 图片放到第 3 列
            ws.addImage(imgId, { tl: { col: 2, row: row.number - 1 }, ext: { width: 96, height: 72 } });
          }
        } catch (e) {
          console.warn('image64 失败：', e);
        }
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `catalog_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- bind ----------
  els?.btnFetch?.addEventListener('click', fetchCatalog);
  els?.btnExport?.addEventListener('click', exportExcel);
  els?.btnClear?.addEventListener('click', clearData);
  els?.url?.addEventListener?.('keydown', e => { if (e.key === 'Enter') fetchCatalog(); });

  // 健康检查（不阻塞）
  (async () => {
    try {
      if (API_BASE) await fetch(`${API_BASE}/v1/api/health`, { mode: 'cors' });
    } catch {}
  })();
})();
