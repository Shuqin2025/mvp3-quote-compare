/* ui-enhance.js — browser-only Excel export with image embedding & price placeholder
 * - No Buffer usage
 * - Robust image proxy handling
 * - Price placeholder "€ 0,00" when price is null/empty
 * - Minimal console noise (enable DEBUG = true if needed)
 */

(() => {
  const DEBUG = false;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ====== helpers ======
  const log = (...args) => DEBUG && console.log('[mvp3]', ...args);
  const warn = (...args) => DEBUG && console.warn('[mvp3]', ...args);

  const API_BASE = new URLSearchParams(location.search).get('api') || '';

  const ui = {
    urlInput: $('input[type="text"]'),
    btnFetch: $('button[data-role="fetch"], button:contains("抓取目录")') || $('#btnFetch'),
    btnExport: $('button[data-role="export"]') || $('button:contains("导出 Excel")'),
    countBar: $('div.alert-warning, .ui-count-tip'),
    tableBody: document.querySelector('table tbody') || $('tbody'),
    previewSelect: $('select'),
    // 你页面上的具体选择器可能略有不同，以上已尽量兼容
  };

  // 安静处理 i18n 显示用的 “—”
  const dash = '—';

  // 将价格转为占位符
  const formatPriceForExcel = (price) => {
    if (price === null || price === undefined || price === '') {
      return '€ 0,00';
    }
    // 如果后端给的是诸如 "9.00EUR" 或 "9,00 EUR"，这里不再做复杂解析，原样写入
    return String(price);
  };

  // ArrayBuffer -> base64（不依赖 Buffer）
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  // 将 MIME 转扩展名（缺省用 jpeg）
  const mimeToExt = (mime = '') => {
    const m = String(mime).toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    if (m.includes('bmp')) return 'bmp';
    return 'jpeg';
  };

  // 通过后端代理取图片，并得到 “dataUrl/base64+ext”
  async function fetchImageViaProxy(imgUrl) {
    if (!imgUrl) return null;
    const proxied = `${API_BASE.replace(/\/+$/, '')}/v1/api/image?url=${encodeURIComponent(imgUrl)}`;
    log('[xlsx] fetch image via proxy:', proxied);

    const res = await fetch(proxied, { credentials: 'omit', mode: 'cors' });

    const ct = res.headers.get('content-type') || '';
    // 1) 如果就是图片流或八位流，自己转 dataURL
    if (ct.startsWith('image/') || ct.includes('octet-stream')) {
      const ab = await res.arrayBuffer();
      if (!ab || ab.byteLength === 0) return null;
      const base64 = arrayBufferToBase64(ab);
      const ext = mimeToExt(ct);
      return { base64, ext };
    }

    // 2) JSON 形式（兼容多种后端返回）
    const data = await res.json().catch(() => ({}));
    if (data && data.ok) {
      // a) 有 dataUrl
      if (data.dataUrl && typeof data.dataUrl === 'string') {
        const s = String(data.dataUrl);
        const comma = s.indexOf(',');
        if (comma > 0) {
          const hdr = s.slice(0, comma); // data:image/jpeg;base64
          const ext = mimeToExt(hdr);
          const base64 = s.slice(comma + 1);
          return { base64, ext };
        }
      }
      // b) 有 bufferBase64 + contentType
      if (data.bufferBase64 && data.contentType) {
        return { base64: data.bufferBase64, ext: mimeToExt(data.contentType) };
      }
      // c) 有 base64 + mime
      if (data.base64 && data.mime) {
        return { base64: data.base64, ext: mimeToExt(data.mime) };
      }
    }

    warn('image proxy response unsupported:', data);
    return null;
  }

  // 下载 Blob
  function triggerDownload(buffer, filename) {
    const blob = new Blob([buffer], {
      type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.rel = 'noopener';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 800);
  }

  // 渲染页面表格（保持你现有的表头结构）
  function renderTable(items) {
    if (!ui.tableBody) return;
    ui.tableBody.innerHTML = '';
    items.forEach((it, idx) => {
      const tr = document.createElement('tr');

      // #
      const c0 = document.createElement('td');
      c0.textContent = String(idx + 1);
      tr.appendChild(c0);

      // Item No.
      const c1 = document.createElement('td');
      c1.textContent = it.sku || dash;
      tr.appendChild(c1);

      // Picture (页面中仅显示缩略图，不影响 Excel)
      const c2 = document.createElement('td');
      if (it.img) {
        const img = document.createElement('img');
        img.src = it.img;
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.style.maxWidth = '70px';
        img.style.maxHeight = '50px';
        c2.appendChild(img);
      } else {
        c2.textContent = dash;
      }
      tr.appendChild(c2);

      // Description
      const c3 = document.createElement('td');
      c3.textContent = it.title || '';
      tr.appendChild(c3);

      // MOQ
      const c4 = document.createElement('td');
      c4.textContent = it.moq || dash;
      tr.appendChild(c4);

      // Unit Price（页面显示保持 —，Excel 里填占位符）
      const c5 = document.createElement('td');
      c5.textContent = it.price ? String(it.price) : dash;
      tr.appendChild(c5);

      // Link
      const c6 = document.createElement('td');
      if (it.url) {
        const a = document.createElement('a');
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = '链接';
        c6.appendChild(a);
      } else {
        c6.textContent = dash;
      }
      tr.appendChild(c6);

      ui.tableBody.appendChild(tr);
    });
  }

  // ====== 业务状态 ======
  let lastItems = [];

  async function doFetch() {
    const url = (ui.urlInput && ui.urlInput.value || '').trim();
    if (!url) return;

    const api = `${API_BASE.replace(/\/+$/, '')}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${encodeURIComponent(ui.previewSelect?.value || '50')}`;
    log('action: fetch', api);

    const res = await fetch(api);
    const data = await res.json();

    if (!data || !data.ok) {
      alert('抓取失败，请稍后再试');
      return;
    }

    const items = Array.isArray(data.items) && data.items.length
      ? data.items
      : (Array.isArray(data.products) ? data.products : []);

    lastItems = items.map((x) => ({
      sku: x.sku || '',
      title: x.title || '',
      url: x.url || '',
      img: x.img || '',
      price: x.price ?? null,
      moq: x.moq || '',
    }));

    renderTable(lastItems);

    if (ui.countBar) {
      ui.countBar.innerText = `抓取成功：共 ${String(data.count || items.length)} 条（预览前 ${String(ui.previewSelect?.value || 50)} 条）`;
    }
  }

  async function doExport() {
    if (!lastItems.length) {
      alert('没有可导出的数据');
      return;
    }
    if (!window.ExcelJS || typeof ExcelJS !== 'object') {
      alert('ExcelJS 未加载，请刷新页面重试');
      return;
    }

    log('action: export');

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Catalog');

    // 列定义（宽度可根据需要微调）
    ws.columns = [
      { header: 'Item No.', key: 'sku', width: 12 },
      { header: 'Picture', key: 'pic', width: 15 }, // 实际图片会覆盖此列区域
      { header: 'Description', key: 'title', width: 60 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Unit Price', key: 'price', width: 14 },
      { header: 'Link', key: 'link', width: 12 },
    ];

    // 先写文本（含价格占位符 & 超链接）
    lastItems.forEach((it) => {
      const row = ws.addRow({
        sku: it.sku || '',
        pic: '', // 图片后面覆盖
        title: it.title || '',
        moq: it.moq || '',
        price: formatPriceForExcel(it.price),
        link: '链接',
      });
      // 设置链接
      if (it.url) {
        const cell = row.getCell('link');
        cell.value = { text: '链接', hyperlink: it.url };
        cell.font = { color: { argb: 'FF0563C1' }, underline: true };
      }
    });

    // 插图（逐条拉取；图片不在就跳过，不会阻塞生成）
    for (let i = 0; i < lastItems.length; i++) {
      const it = lastItems[i];
      if (!it.img) continue;

      try {
        const imgData = await fetchImageViaProxy(it.img);
        if (!imgData) {
          warn('embed image failed (no data):', it.img);
          continue;
        }
        const id = workbook.addImage({
          base64: imgData.base64, // 只传纯 base64；ExcelJS 会处理
          extension: imgData.ext || 'jpeg',
        });
        // 将图片放到第 i+2 行（第 1 行是表头），第 2 列
        const rowIdx = i + 2;
        ws.addImage(id, {
          tl: { col: 1, row: rowIdx - 1 }, // 从第2列(索引1)开始
          ext: { width: 80, height: 60 },
          editAs: 'oneCell',
        });
        // 调整行高，避免被裁剪
        const row = ws.getRow(rowIdx);
        row.height = Math.max(row.height || 0, 48);
      } catch (e) {
        warn('embed image failed', it.img, e);
      }
    }

    // 生成并下载
    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'');
    triggerDownload(buffer, `catalog-preview-${stamp}.xlsx`);
  }

  // ====== 事件绑定 ======
  if (ui.btnFetch) ui.btnFetch.addEventListener('click', doFetch);
  if (ui.btnExport) ui.btnExport.addEventListener('click', doExport);

  // 面板初始化提示
  log('ui-enhance ready');
})();
