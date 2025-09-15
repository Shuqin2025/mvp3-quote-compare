/* ui-enhance.js — 稳定导出（顺序拉图 + 价格占位符）
 * 后端接口：/v1/api/parse  与  /v1/api/image
 * 说明：
 *  - 抓取目录：仍调 /v1/api/parse，渲染还是走你页面原有逻辑
 *  - 导出 Excel：顺序拉取图片（每行 1 张），价格无则写“€ 0,00”
 *  - 即便没有 state.items，也会从当前表格 DOM 回读数据导出
 */

(function () {
  const log = (...a) => console.log('[mvp3]', ...a);

  // 解析后端 API 基地址（?api=...）
  function getApiBase() {
    try {
      const u = new URL(location.href);
      const api = u.searchParams.get('api');
      return api ? api.replace(/\/$/, '') : '';
    } catch { return ''; }
  }
  const API_BASE = getApiBase();

  // dom helpers
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // 找按钮（按文字模糊）
  function findButton(keywords) {
    const list = $$('button, [role="button"]');
    return list.find(b => {
      const t = (b.textContent || b.value || '').trim();
      return keywords.some(k => t.includes(k));
    });
  }

  // 简易提示：复用页面黄条
  function toast(msg) {
    try {
      const el = document.querySelector('.alert-warning, .ui-hint, [data-banner]');
      if (el) el.textContent = msg;
    } catch {}
    log(msg);
  }

  // 保存 Blob -> 触发下载
  function saveBlob(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename || ('catalog-' + Date.now() + '.xlsx');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // 相对 -> 绝对
  function toAbsUrl(maybe, base) {
    try { return maybe ? new URL(maybe, base || location.href).href : ''; }
    catch { return maybe || ''; }
  }

  // ArrayBuffer -> base64（浏览器安全）
  function abToBase64(ab) {
    const bytes = new Uint8Array(ab);
    const chunk = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  // 数据优先从 state 取；没有就读 DOM 表格
  function sniffStateItems() {
    if (window.__mvp3_state?.items?.length) return window.__mvp3_state.items;
    if (window.__mvp_items?.length) return window.__mvp_items;
    return null;
  }

  function readRowsFromDom() {
    const table = $('table') || $('[data-table]');
    const rows = [];
    if (!table) return rows;

    let trs = $$('tbody tr', table);
    if (!trs.length) trs = $$('tr', table).slice(1); // 跳过表头

    trs.forEach(tr => {
      const tds = $$('td', tr);
      if (tds.length < 5) return;

      const itemNo = (tds[1]?.textContent || '').trim();
      const imgEl  = $('img', tds[2]) || null;
      const img    = imgEl ? imgEl.getAttribute('src') : '';
      const title  = (tds[3]?.textContent || '').trim();
      const moq    = (tds[4]?.textContent || '').trim() || '—';
      const price  = (tds[5]?.textContent || '').trim();
      const linkEl = $('a', tds[6]);
      const url    = linkEl ? linkEl.getAttribute('href') : '';

      rows.push({
        sku: itemNo,
        title,
        moq,
        price,
        url: toAbsUrl(url),
        img: toAbsUrl(img)
      });
    });

    return rows;
  }

  // 抓取目录（仍调后端 /v1/api/parse）
  async function handleFetch() {
    try {
      const input = $$('input').find(i => (i.placeholder || i.getAttribute('aria-label') || '').includes('http')) || $$('input')[0];
      const url = (input && input.value.trim()) || '';
      const limitSel = $$('select').find(s => s && [...s.options].some(o => /50|100|200/.test(o.value))) || $$('select')[0];
      const limit = limitSel ? Number(limitSel.value || 50) : 50;
      if (!url) return alert('请输入目录/列表页链接');

      log('action: fetch', { url, limit });

      const res  = await fetch(`${API_BASE}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${limit}`, { credentials: 'omit' });
      const data = await res.json().catch(() => ({}));

      const items = (data.items && data.items.length ? data.items : (data.products || []))
        .map(x => ({
          sku:   x.sku || x.itemNo || '',
          title: x.title || x.description || '',
          moq:   x.moq || '—',
          price: (x.price && String(x.price).trim()) || '',
          url:   x.url || x.link || '',
          img:   x.img || (x.imgs && x.imgs[0]) || ''
        }));

      window.__mvp3_state = { items };

      const okNum = (data.count ?? items.length ?? 0);
      const banner = document.querySelector('.alert-warning, .ui-hint, [data-banner]');
      if (banner) banner.textContent = `抓取成功：共 ${okNum} 条（预览前 ${limit} 条）`;
      // 渲染仍由你原页面逻辑处理
    } catch (err) {
      console.error(err);
      alert('抓取失败：' + (err && err.message ? err.message : 'unknown'));
    }
  }

  // 导出 Excel（顺序拉图 + 价格占位符）
  async function handleExport() {
    try {
      await ensureExcelJS();
      if (!window.ExcelJS) return alert('ExcelJS 加载失败，请刷新后重试');

      let rows = sniffStateItems() || [];
      if (!rows.length) rows = readRowsFromDom();
      if (!rows.length) return alert('没有可导出的数据');

      const ExcelJS = window.ExcelJS;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Catalog');

      ws.columns = [
        { header: 'Item No.',    key: 'sku',   width: 16 },
        { header: 'Picture',     key: 'pic',   width: 18 },
        { header: 'Description', key: 'title', width: 70 },
        { header: 'MOQ',         key: 'moq',   width: 10 },
        { header: 'Unit Price',  key: 'price', width: 14 },
        { header: 'Link',        key: 'url',   width: 60 }
      ];

      let r = 2; // 数据从第 2 行开始
      for (const it of rows) {
        const row = {
          sku:   it.sku || '',
          title: it.title || '',
          moq:   it.moq || '—',
          price: (it.price && it.price.trim()) ? it.price.trim() : '€ 0,00',
          url:   it.url || ''
        };
        ws.addRow(row);

        // 链接做成可点
        try {
          if (row.url) {
            const c = ws.getCell(`F${r}`);
            c.value = { text: '链接', hyperlink: row.url };
            c.font  = { color: { argb: 'FF0563C1' }, underline: true };
          }
        } catch {}

        // 图片（顺序 await，避免同时大量请求）
        const imgUrl = it.img || (it.imgs && it.imgs[0]) || '';
        if (imgUrl && API_BASE) {
          try {
            const proxied = `${API_BASE}/v1/api/image?url=${encodeURIComponent(toAbsUrl(imgUrl, it.url || location.href))}`;
            const ab  = await fetch(proxied, { credentials: 'omit' }).then(r => r.arrayBuffer());
            const b64 = abToBase64(ab);

            // 猜测后缀
            let ext = 'jpeg';
            const low = imgUrl.toLowerCase();
            if (/\.(png)(\?|$)/.test(low))  ext = 'png';
            if (/\.(webp)(\?|$)/.test(low)) ext = 'webp';

            const imgId = wb.addImage({ base64: b64, extension: ext });
            ws.addImage(imgId, { tl: { col: 1, row: r - 1 }, ext: { width: 64, height: 48 } });
            ws.getRow(r).height = 40;
          } catch (e) {
            console.warn('embed image fail:', imgUrl, e);
          }
        }
        r++;
      }

      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `catalog-preview-${new Date().toISOString().slice(0,10)}.xlsx`;
      saveBlob(blob, filename);
      toast('已导出 Excel（含图片、价格占位符）');
    } catch (err) {
      console.error(err);
      alert('导出失败：' + (err && err.message ? err.message : 'unknown'));
    }
  }

  // 绑定按钮（避免重复绑定）
  function bindUI() {
    if (!bindUI._did) bindUI._did = new WeakSet();

    const btnFetch  = findButton(['抓取', '采集', 'Fetch']);
    const btnExport = findButton(['导出 Excel', '导出', 'Excel', 'Export']);

    if (btnFetch && !bindUI._did.has(btnFetch)) {
      btnFetch.addEventListener('click', handleFetch);
      bindUI._did.add(btnFetch);
    }
    if (btnExport && !bindUI._did.has(btnExport)) {
      btnExport.addEventListener('click', handleExport);
      bindUI._did.add(btnExport);
    }
  }

  // 按需注入 ExcelJS（浏览器版，避免 Buffer 依赖）
  async function ensureExcelJS() {
    if (window.ExcelJS) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // init
  (async function init() {
    try { await ensureExcelJS(); } catch {}
    bindUI();
    // 监听 DOM 变化，避免热刷新/切页后事件丢失
    const mo = new MutationObserver(bindUI);
    mo.observe(document.body, { childList: true, subtree: true });
    log('ready', { API_BASE });
  })();
})();
