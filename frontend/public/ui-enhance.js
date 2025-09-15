/* ui-enhance.js — MVP3 前端增强（无 Buffer、带图片与价格占位）
 * - 图片：走 /v1/api/image?url=... 代理，自动适配流 / JSON 各种返回
 * - 价格：Excel 中无价则写入 “€ 0,00”
 * - 更健壮的按钮绑定与下载触发
 * - 控制台低噪音（DEBUG=true 可查看细节）
 */

(() => {
  const DEBUG = false;
  const log = (...a) => DEBUG && console.log('[mvp3]', ...a);
  const warn = (...a) => DEBUG && console.warn('[mvp3]', ...a);

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  // 从 URL 里拿到后端地址 ?api=https://xxxx.onrender.com
  const API_BASE = new URLSearchParams(location.search).get('api') || '';

  // —— 按钮查找（不依赖特定 id，按文案兜底）——
  const findButtonByText = (txt) =>
    qsa('button').find((b) => (b.textContent || '').includes(txt));

  const ui = {
    urlInput: qs('input[type="text"]'),
    btnFetch:
      qs('[data-role="fetch"]') ||
      qs('#btnFetch') ||
      findButtonByText('抓取') ||
      findButtonByText('抓取目录'),
    btnExport:
      qs('[data-role="export"]') ||
      findButtonByText('导出 Excel') ||
      findButtonByText('导出'),
    previewSelect:
      qs('select') ||
      (() => {
        const sel = document.createElement('select');
        sel.innerHTML =
          '<option value="50">50</option><option value="100">100</option><option value="200">200</option>';
        return sel;
      })(),
    countBar:
      qs('.ui-count-tip') ||
      qs('.alert-warning') ||
      qs('.ui-count') ||
      qs('.count'),
    tableBody: qs('table tbody') || qs('tbody'),
  };

  const dash = '—';

  // —— 小函数：价格转 Excel 文本（空 → € 0,00）——
  const priceForExcel = (v) =>
    v === null || v === undefined || v === '' ? '€ 0,00' : String(v);

  // —— ArrayBuffer => base64（浏览器安全实现，不用 Buffer）——
  const ab2b64 = (ab) => {
    let bin = '';
    const bytes = new Uint8Array(ab);
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(bin);
  };

  const mime2ext = (mime = '') => {
    const m = String(mime).toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    if (m.includes('bmp')) return 'bmp';
    return 'jpeg';
  };

  // —— 通过后端代理拿图片，返回 { base64, ext } 或 null —— 
  async function fetchImageViaProxy(imgUrl) {
    if (!imgUrl) return null;
    const u = `${API_BASE.replace(/\/+$/, '')}/v1/api/image?url=${encodeURIComponent(imgUrl)}`;
    log('[xlsx] via proxy:', u);

    const res = await fetch(u, { mode: 'cors', credentials: 'omit' });

    // 1) 直接是图片流 / 八位流
    const ct = res.headers.get('content-type') || '';
    if (ct.startsWith('image/') || ct.includes('octet-stream')) {
      const ab = await res.arrayBuffer();
      if (!ab || ab.byteLength === 0) return null;
      return { base64: ab2b64(ab), ext: mime2ext(ct) };
    }

    // 2) JSON：兼容 dataUrl / base64+mime / bufferBase64+contentType
    const data = await res.json().catch(() => ({}));

    if (data && data.ok) {
      if (data.dataUrl && typeof data.dataUrl === 'string') {
        const s = data.dataUrl;
        const i = s.indexOf(',');
        if (i > 0) {
          const header = s.slice(0, i); // data:image/jpeg;base64
          const base64 = s.slice(i + 1);
          return { base64, ext: mime2ext(header) };
        }
      }
      if (data.bufferBase64 && data.contentType) {
        return { base64: data.bufferBase64, ext: mime2ext(data.contentType) };
      }
      if (data.base64 && data.mime) {
        return { base64: data.base64, ext: mime2ext(data.mime) };
      }
    }

    warn('image proxy: unsupported response');
    return null;
  }

  // —— 下载触发 —— 
  function saveAsXlsx(buffer, filename) {
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
    }, 600);
  }

  // —— 表格渲染（页面预览用，不影响 Excel）——
  function renderTable(items) {
    if (!ui.tableBody) return;
    ui.tableBody.innerHTML = '';
    items.forEach((it, idx) => {
      const tr = document.createElement('tr');

      const c0 = document.createElement('td');
      c0.textContent = String(idx + 1);
      tr.appendChild(c0);

      const c1 = document.createElement('td');
      c1.textContent = it.sku || dash;
      tr.appendChild(c1);

      const c2 = document.createElement('td');
      if (it.img) {
        const img = document.createElement('img');
        img.src = it.img;
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.style.maxWidth = '72px';
        img.style.maxHeight = '52px';
        c2.appendChild(img);
      } else {
        c2.textContent = dash;
      }
      tr.appendChild(c2);

      const c3 = document.createElement('td');
      c3.textContent = it.title || '';
      tr.appendChild(c3);

      const c4 = document.createElement('td');
      c4.textContent = it.moq || dash;
      tr.appendChild(c4);

      const c5 = document.createElement('td');
      c5.textContent = it.price ? String(it.price) : dash;
      tr.appendChild(c5);

      const c6 = document.createElement('td');
      if (it.url) {
        const a = document.createElement('a');
        a.textContent = '链接';
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        c6.appendChild(a);
      } else {
        c6.textContent = dash;
      }
      tr.appendChild(c6);

      ui.tableBody.appendChild(tr);
    });
  }

  // —— 业务状态 —— 
  let lastItems = [];

  async function doFetch() {
    try {
      const raw = (ui.urlInput && ui.urlInput.value || '').trim();
      if (!raw) return;

      const limit = encodeURIComponent(ui.previewSelect?.value || '50');
      const api = `${API_BASE.replace(/\/+$/, '')}/v1/api/parse?url=${encodeURIComponent(raw)}&limit=${limit}`;

      log('action: fetch', api);
      ui.btnFetch && (ui.btnFetch.disabled = true);

      const res = await fetch(api);
      const data = await res.json();

      if (!data || !data.ok) {
        alert('抓取失败，请稍后重试');
        return;
      }

      const list = Array.isArray(data.items) && data.items.length
        ? data.items
        : (Array.isArray(data.products) ? data.products : []);

      lastItems = list.map((x) => ({
        sku: x.sku || '',
        title: x.title || '',
        url: x.url || '',
        img: x.img || '',
        price: x.price ?? null,
        moq: x.moq || '',
      }));

      renderTable(lastItems);
      if (ui.countBar) {
        ui.countBar.innerText =
          `抓取成功：共 ${String(data.count || list.length)} 条（预览前 ${ui.previewSelect?.value || 50} 条）`;
      }
    } finally {
      ui.btnFetch && (ui.btnFetch.disabled = false);
    }
  }

  // —— 并发控制（图片拉取）——
  async function parallelMap(arr, limit, worker) {
    const ret = new Array(arr.length);
    let idx = 0;
    const run = async () => {
      while (idx < arr.length) {
        const i = idx++;
        ret[i] = await worker(arr[i], i);
      }
    };
    const tasks = Array.from({ length: Math.min(limit, arr.length) }, run);
    await Promise.all(tasks);
    return ret;
  }

  async function doExport() {
    if (!lastItems.length) {
      alert('没有可导出的数据');
      return;
    }
    if (!window.ExcelJS || typeof ExcelJS !== 'object') {
      alert('ExcelJS 未加载，请刷新页面再试');
      return;
    }
