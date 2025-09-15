<script>
/* ui-enhance.js — safe / stable exporter (sequential image fetch + price placeholder)
 * 适配：/v1/api/parse  与  /v1/api/image
 * 作用：
 *  - 抓取目录：仍调用 /v1/api/parse，渲染交由原页面逻辑（此脚本不改你的渲染）
 *  - 导出 Excel：顺序拉取图片（每行最多 1 张），价格无则写“€ 0,00”
 *  - 即便没有 state.items，也能从当前表格 DOM 读取数据导出
 */

(function () {
  const log = (...a) => console.log('[mvp3]', ...a);

  // 解析后端 API 基地址（?api=...）
  function getApiBase() {
    const u = new URL(location.href);
    const apiFromQuery = u.searchParams.get('api');
    return apiFromQuery ? apiFromQuery.replace(/\/$/, '') : '';
  }
  const API_BASE = getApiBase();

  // dom helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // 找按钮（通过文字）
  function findButton(label) {
    return $$('button').find(b => (b.textContent || '').includes(label));
  }

  // 简易通知（复用你页面顶部的小黄条文案）
  function toast(msg) {
    try {
      const banner = document.querySelector('.alert-warning, .ui-hint, [data-banner]');
      if (banner) banner.textContent = msg;
    } catch {}
    log(msg);
  }

  // 保存 blob
  function saveBlob(blob, filename) {
    try {
      if (window.saveAs) return window.saveAs(blob, filename);
    } catch {}
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename || ('catalog-' + Date.now() + '.xlsx');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // 取绝对地址
  function toAbsUrl(maybe, base) {
    try {
      if (!maybe) return '';
      return new URL(maybe, base || location.href).href;
    } catch {
      return maybe;
    }
  }

  // —— 数据源判断：优先用 state.items；否则从表格 DOM 读取 ——
  function sniffStateItems() {
    // 兼容你可能保留的全局变量
    if (window.__mvp3_state?.items?.length) return window.__mvp3_state.items;
    if (window.__mvp_items?.length) return window.__mvp_items;
    return null;
  }

  function readRowsFromDom() {
    // 找到结果表格（你页面底部那张列表）
    // 兼容几种结构：table 或者 div table-like
    const table = $('table') || $('[data-table]');
    const rows = [];
    if (!table) return rows;

    // 找到所有“数据行”
    let trList = $$('tbody tr', table);
    if (trList.length === 0) trList = $$('tr', table).slice(1); // 跳过表头

    trList.forEach(tr => {
      const tds = $$('td', tr);
      if (tds.length < 5) return;

      // 你的列：# | Item No. | Picture | Description | MOQ | Unit Price | Link
      const itemNo = (tds[1]?.textContent || '').trim();
      const imgEl  = $('img', tds[2]) || null;
      const img    = imgEl ? imgEl.getAttribute('src') : '';
      const title  = (tds[3]?.textContent || '').trim();
      const moq    = (tds[4]?.textContent || '').trim() || '—';
      const price  = (tds[5]?.textContent || '').trim(); // 可能为空
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

  // —— 抓取目录（仍然调用后端 /v1/api/parse）——
  async function handleFetch() {
    try {
      const input = $$('input').find(i => (i.placeholder || i.getAttribute('aria-label') || '').includes('http')) || $$('input')[0];
      const url = (input && input.value.trim()) || '';
      const limitSel = $$('select').find(s => s && s.options && [...s.options].some(o => /50|100|200/.test(o.value))) || $$('select')[0];
      const limit = limitSel ? Number(limitSel.value || 50) : 50;
      if (!url) return alert('请输入目录/列表页链接');

      log('action: fetch', { url, limit });

      const res = await fetch(`${API_BASE}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${limit}`, { credentials: 'omit' });
      const data = await res.json().catch(() => ({}));

      // 把 items 暴露成全局，方便导出逻辑读取
      const items = (data.items && data.items.length ? data.items : (data.products || []))
        .map(x => ({
          sku: x.sku || x.itemNo || '',
          title: x.title || x.description || '',
          moq:  x.moq || '—',
          price: (x.price && String(x.price).trim()) || '',
          url:  x.url || x.link || '',
          img:  x.img || (x.imgs && x.imgs[0]) || ''
        }));

      window.__mvp3_state = { items };

      // 不改你的渲染：这一步只是把“抓取成功”数字改成 data.count
      const okNum = (data.count ?? items.length ?? 0);
      const okBanner = document.querySelector('.alert-warning, .ui-hint, [data-banner]');
      if (okBanner) okBanner.textContent = `抓取成功：共 ${okNum} 条（预览前 ${limit} 条）`;
      // 原页面已有渲染逻辑，这里不重复填表。你之前的页面已经能渲染出表格。

    } catch (err) {
      console.error(err);
      alert('抓取失败：' + (err && err.message ? err.message : 'unknown'));
    }
  }

  // —— 导出 Excel（稳健版）——
  async function handleExport() {
    try {
      if (!window.ExcelJS) return alert('ExcelJS 未加载，刷新页面后重试');

      // 先尽量用抓取得到的 items；没有则从 DOM 表格回读
      let rows = sniffStateItems() || [];
      if (!rows.length) rows = readRowsFromDom();
      if (!rows.length) return alert('没有可导出的数据');

      // Excel 准备
      const ExcelJS = window.ExcelJS;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Catalog');

      ws.columns = [
        { header: 'Item No.',   key: 'sku',   width: 16 },
        { header: 'Picture',    key: 'pic',   width: 18 },  // 实际用来放图
        { header: 'Description',key: 'title', width: 70 },
        { header: 'MOQ',        key: 'moq',   width: 10 },
        { header: 'Unit Price', key: 'price', width: 14 },
        { header: 'Link',       key: 'url',   width: 60 }
      ];

      // 逐行写入（顺序拉图，杜绝高并发）
      let r = 2; // 数据从第 2 行开始（第 1 行是表头）
      for (const it of rows) {
        const row = {
          sku:   it.sku || '',
          title: it.title || '',
          moq:   it.moq || '—',
          price: it.price && it.price.trim() ? it.price.trim() : '€ 0,00',
          url:   it.url  || ''
        };
        ws.addRow(row);

        // 放链接为可点击
        try {
          if (row.url) {
            const cell = ws.getCell(`F${r}`);
            cell.value = { text: '链接', hyperlink: row.url };
            cell.font = { color: { argb: 'FF0563C1' }, underline: true };
          }
        } catch {}

        // 嵌入一张图片（有就取 1 张；顺序 await，避免 Pending 风暴）
        const imgUrl = it.img || (it.imgs && it.imgs[0]) || '';
        if (imgUrl && API_BASE) {
          try {
            const proxied = `${API_BASE}/v1/api/image?url=${encodeURIComponent(toAbsUrl(imgUrl, it.url || location.href))}`;
            // 顺序取图（arrayBuffer），避免 pipe/stream Pending
            const ab = await fetch(proxied, { credentials: 'omit' }).then(r => r.arrayBuffer());
            // 简单判断后缀
            let ext = 'jpeg';
            const low = imgUrl.toLowerCase();
            if (/\.(png)(\?|$)/.test(low)) ext = 'png';
            if (/\.(webp)(\?|$)/.test(low)) ext = 'webp';

            const imgId = wb.addImage({ buffer: ab, extension: ext });
            // 图片位置：第二列（B 列），该行
            ws.addImage(imgId, {
              tl: { col: 1, row: r - 1 },  // B 列，当前行
              ext: { width: 64, height: 48 }
            });
            // 行高稍微加一点
            ws.getRow(r).height = 40;
          } catch (e) {
            console.warn('embed image fail:', imgUrl, e);
          }
        }
        r++;
      }

      // 生成并保存
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `catalog-preview-${new Date().toISOString().slice(0,10)}.xlsx`;
      saveBlob(blob, filename);
      toast('已导出 Excel（含图片、价格占位符）');
    } catch (err) {
      console.error(err);
      alert('导出失败：' + (err && err.message ? err.message : 'unknown'));
    }
  }

  // 绑定按钮
  function bindUI() {
    const btnFetch  = findButton('抓取目录');
    const btnExport = findButton('导出 Excel');
    if (btnFetch && !btnFetch.__bound)  { btnFetch.addEventListener('click', handleFetch);  btnFetch.__bound  = true; }
    if (btnExport && !btnExport.__bound){ btnExport.addEventListener('click', handleExport); btnExport.__bound = true; }
  }

  // ExcelJS 注入（如果你在 index.html 已经引入，就不会再注入）
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
    // 防止路由切换或热刷新后事件丢失
    const mo = new MutationObserver(() => bindUI());
    mo.observe(document.body, { childList: true, subtree: true });
    log('ready');
  })();
})();
</script>
