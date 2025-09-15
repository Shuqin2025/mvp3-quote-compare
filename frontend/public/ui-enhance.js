/* ui-enhance.js — stableB (embed images in Excel + price placeholders)
 * 关键修复点：
 * - 通过后端 /v1/api/image?url=... 拉取 base64；根据图片 URL 后缀强制生成 dataURL（不依赖 content-type）
 * - ExcelJS 在浏览器端只能接收 { base64: 'data:image/...;base64,xxx' }；严禁使用 Node 的 Buffer
 * - 两种锚点方式（单元格范围 / 坐标锚点）双保险插图，失败会自动降级
 * - “Unit Price” 无价时写入占位符 € 0,00
 */

(() => {
  // -------------------------- 基础工具 --------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get('api') || '').replace(/\/$/, ''); // 例如 https://your-backend.onrender.com

  const log = (...args) => {
    console.log(...args);
    try {
      const box = $('#mvp3-log');
      if (box) {
        const li = document.createElement('div');
        li.textContent = args.map(String).join(' ');
        box.appendChild(li);
      }
    } catch (_) {}
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 根据 url 猜测 mime；不要依赖响应头
  function guessMimeFromUrl(url) {
    const u = String(url).split('?')[0].toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.gif')) return 'image/gif';
    // 默认 jpg/jpeg
    return 'image/jpeg';
  }

  // 从后端代理取 base64 文本，并拼 dataURL
  async function fetchImageBase64DataURL(url) {
    if (!API_BASE) throw new Error('API base is not set. Append ?api=<backend> in URL.');
    const endpoint = `${API_BASE}/v1/api/image?url=${encodeURIComponent(url)}`;
    log('[xlsx] fetch image via proxy:', endpoint);

    const resp = await fetch(endpoint, { method: 'GET', mode: 'cors' });
    if (!resp.ok) throw new Error(`image proxy ${resp.status} ${resp.statusText}`);

    // 后端按 text/plain 返回纯 base64
    const pureB64 = (await resp.text()).trim();
    const mime = guessMimeFromUrl(url);
    // 统一拼成 dataURL
    return `data:${mime};base64,${pureB64}`;
  }

  // 千分位/欧元占位
  const formatEUR = (n) => {
    try {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(n) || 0);
    } catch {
      // 兜底字符串
      return '€ 0,00';
    }
  };

  // -------------------------- 渲染表格（页面预览） --------------------------
  function renderTable(products) {
    const tbody = $('#mvp3-tbody');
    tbody.innerHTML = '';
    products.forEach((p, i) => {
      const tr = document.createElement('tr');

      // #
      const tdIdx = document.createElement('td');
      tdIdx.textContent = String(i + 1);
      tr.appendChild(tdIdx);

      // Item No.
      const tdSku = document.createElement('td');
      tdSku.textContent = p.sku || '—';
      tr.appendChild(tdSku);

      // Picture (页面预览用 <img>)
      const tdImg = document.createElement('td');
      if (p.img) {
        const img = document.createElement('img');
        img.src = p.img;
        img.alt = '';
        img.width = 76;
        img.height = 56;
        img.referrerPolicy = 'no-referrer';
        tdImg.appendChild(img);
      } else {
        tdImg.textContent = '—';
      }
      tr.appendChild(tdImg);

      // Description
      const tdTitle = document.createElement('td');
      tdTitle.textContent = p.title || '—';
      tr.appendChild(tdTitle);

      // MOQ（目前很多站点无此字段，先占位）
      const tdMoq = document.createElement('td');
      tdMoq.textContent = p.moq || '—';
      tr.appendChild(tdMoq);

      // Unit Price（无价 → 占位 € 0,00）
      const tdPrice = document.createElement('td');
      tdPrice.textContent = p.price || formatEUR(0);
      tr.appendChild(tdPrice);

      // Link
      const tdLink = document.createElement('td');
      if (p.url) {
        const a = document.createElement('a');
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noreferrer';
        a.textContent = '链接';
        tdLink.appendChild(a);
      } else {
        tdLink.textContent = '—';
      }
      tr.appendChild(tdLink);

      tbody.appendChild(tr);
    });
  }

  // -------------------------- 抓取目录 --------------------------
  async function doFetch() {
    const url = ($('#mvp3-input') || {}).value?.trim();
    if (!url) {
      alert('请输入目录/列表页链接');
      return;
    }
    if (!API_BASE) {
      alert('URL 缺少 ?api= 后端地址，无法抓取。');
      return;
    }

    $('#mvp3-action').disabled = true;
    try {
      log('[mvp3] action: fetch');

      const viewN = Number($('#mvp3-limit').value || 50) || 50;
      const parseUrl = `${API_BASE}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${viewN}`;
      const resp = await fetch(parseUrl, { method: 'GET', mode: 'cors' });
      const data = await resp.json();

      if (!data || !data.ok) throw new Error('解析失败');
      // 统一字段：sku/title/url/img/price/moq
      const list = Array.isArray(data.items || data.products) ? (data.items || data.products) : [];

      // 页面展示：无价 → 占位符
      list.forEach((x) => {
        if (!x.price) x.price = formatEUR(0);
      });

      renderTable(list);
      $('#mvp3-count').textContent = `抓取成功：共 ${list.length} 条（预览前 ${viewN} 条）`;
      window.__MVP3_LAST = list;
    } catch (e) {
      console.error(e);
      alert('抓取失败：' + e.message);
    } finally {
      $('#mvp3-action').disabled = false;
    }
  }

  // -------------------------- 导出 Excel（含图片 + 价格占位） --------------------------
  async function doExport() {
    const rows = window.__MVP3_LAST || [];
    if (!rows.length) {
      alert('没有可导出的数据');
      return;
    }
    if (!window.ExcelJS) {
      alert('ExcelJS 未加载（typeof ExcelJS 不是 object）');
      return;
    }

    log('[mvp3] action: export');

    const ExcelJS = window.ExcelJS;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MVP3';
    wb.created = new Date();

    const ws = wb.addWorksheet('catalog');
    // 列设置
    ws.columns = [
      { header: 'Item No.', key: 'sku', width: 16 },
      { header: 'Picture', key: 'picture', width: 12 },
      { header: 'Description', key: 'title', width: 64 },
      { header: 'MOQ', key: 'moq', width: 9 },
      { header: 'Unit Price', key: 'price', width: 14 },
      { header: 'Link', key: 'link', width: 12 }
    ];

    // 行高：第一行表头 + 数据行（配合图片）
    ws.getRow(1).height = 22;

    // 先写文本，再插图
    rows.forEach((p, idx) => {
      const row = ws.addRow({
        sku: p.sku || '',
        picture: '', // 图片列先留空
        title: p.title || '',
        moq: p.moq || '',
        price: p.price || formatEUR(0),
        link: p.url ? '链接' : ''
      });

      // 超链接
      if (p.url) {
        const cell = row.getCell('link');
        cell.value = { text: '链接', hyperlink: p.url };
        cell.font = { color: { argb: 'FF0563C1' }, underline: true };
      }

      // 数据行高度（为缩略图留空间）
      const r = row.number;
      ws.getRow(r).height = 56;
    });

    // 插图（顺序 await，避免并发过多）
    for (let i = 0; i < rows.length; i++) {
      const r = i + 2; // 数据从第 2 行开始
      const p = rows[i];
      if (!p.img) continue;

      try {
        const dataUrl = await fetchImageBase64DataURL(p.img);
        const imgId = wb.addImage({ base64: dataUrl });

        // 优先尝试：单元格范围（把图塞进 B 列这个格）
        try {
          ws.addImage(imgId, `B${r}:B${r}`);
        } catch (e) {
          // 降级：坐标锚点（微调一下位置和大小）
          const col = 2; // B 列
          const row = r;
          ws.addImage(imgId, {
            tl: { col: col - 0.5, row: row - 0.8 },
            ext: { width: 76, height: 56 }
          });
        }
      } catch (err) {
        console.warn('[xlsx] embed image failed:', p.img, err?.message || err);
      }
    }

    // 触发下载
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.download = `catalog-preview-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    log('已导出 Excel（含图片、价格占位符）');
  }

  // -------------------------- 事件绑定 &
