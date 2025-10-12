/**
 * MVP3 前端增强脚本（完整替换版 · 仅做必要改动）
 * - 自动读取 ?api= 网关根，例如 ?api=https://yunivera-gateway.onrender.com
 * - 流程：detect -> parse（GET，避免 preflight）
 * - 图片：统一使用 /v1/api/image?url=...
 * - 导出：若存在 ExcelJS 则导出 .xlsx，否则回退 CSV
 */
(() => {
  // ---------------- helpers ----------------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // 解析 ?api= 参数（允许 http/https）
  const getApiBase = () => {
    try {
      const u = new URL(location.href);
      const api = u.searchParams.get("api");
      if (!api) return "";
      // 去掉末尾斜杠，保持 /v1 追加时不重复
      return api.replace(/\/+$/,"");
    } catch { return ""; }
  };
  const API_BASE = getApiBase();

  // 一些容器/控件选择（尽量兼容旧 DOM）
  const els = {
    urlInput: $('#url') || $('input[type="url"], input[name="url"]') || $('input'),
    btnFetch: $('#btnFetch') || $$('.btn').find(b => /抓取/.test(b?.textContent||"")),
    selectLimit: $('#pageSize') || $('select'),
    btnExport: $('#btnExport') || $$('.btn').find(b => /导出|Export/i.test(b?.textContent||"")),
    btnClear: $('#btnClear') || $$('.btn').find(b => /清空|Clear/i.test(b?.textContent||"")),
    toast: $('#toast') || $('.alert') || $('.msg') || null,
    tbody: $('table tbody') || $('tbody'),
    thead: $('table thead') || $('thead'),
    table: $('table'),
  };

  const setToast = (msg, ok=true) => {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.style.display = 'block';
    els.toast.style.background = ok ? '#fff8e1' : '#ffecec';
    els.toast.style.color = ok ? '#444' : '#b00020';
  };

  const clearTable = () => {
    if (els.tbody) els.tbody.innerHTML = '';
  };

  // 将检测到的 type -> 解析器 t 参数
  const TYPE_TO_T = {
    'Shopify': 'shopify',
    'WooCommerce': 'woo1',
    'Shopware': 'shopware',
    'Magento': 'magento',
    'OpenCart': 'opencart',
    // 兜底：如果未知就不带 t，让后端走通用解析
  };

  // 结果缓存（导出用）
  let lastRows = [];

  // ---------------- 渲染行 ----------------
  const renderRows = (rows) => {
    lastRows = rows || [];
    clearTable();
    if (!rows?.length) return;

    const frag = document.createDocumentFragment();
    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');

      const tdIdx = document.createElement('td');
      tdIdx.textContent = String(idx+1);

      const tdSku = document.createElement('td');
      tdSku.textContent = r.sku || '—';

      const tdImg = document.createElement('td');
      if (r.img) {
        const img = document.createElement('img');
        // 统一使用网关图片代理，避免跨域
        const imgUrl = `${API_BASE}/v1/api/image?url=${encodeURIComponent(r.img)}`;
        img.src = imgUrl;
        img.alt = r.title || '';
        img.referrerPolicy = 'no-referrer';
        img.loading = 'lazy';
        img.style.maxWidth = '80px';
        img.style.maxHeight = '80px';
        tdImg.appendChild(img);
      } else {
        tdImg.textContent = '—';
      }

      const tdTitle = document.createElement('td');
      tdTitle.textContent = r.title || r.desc || '—';

      const tdMoq = document.createElement('td');
      tdMoq.textContent = r.moq || '—';

      const tdPrice = document.createElement('td');
      tdPrice.textContent = r.price ? (r.currency ? `${r.price} ${r.currency}` : r.price) : '—';

      const tdLink = document.createElement('td');
      if (r.link || r.url) {
        const a = document.createElement('a');
        a.href = r.link || r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = '链接';
        tdLink.appendChild(a);
      } else {
        tdLink.textContent = '—';
      }

      [tdIdx, tdSku, tdImg, tdTitle, tdMoq, tdPrice, tdLink].forEach(td => tr.appendChild(td));
      frag.appendChild(tr);
    });

    els.tbody?.appendChild(frag);
  };

  // ---------------- 导出 ----------------
  const exportXlsx = async () => {
    if (!lastRows?.length) return setToast('没有可以导出的数据', false);

    // 尝试使用 ExcelJS（如果页面已加载）
    const hasExcel = !!window.ExcelJS;
    if (!hasExcel) {
      // 回退 CSV（只导出核心列，避免 base64）
      const head = ['#','货号','标题','MOQ','单价','链接'];
      const lines = [head.join(',')];
      lastRows.forEach((r,i) => {
        const row = [
          String(i+1),
          (r.sku||'').replace(/,/g,' '),
          (r.title||r.desc||'').replace(/,/g,' '),
          (r.moq||'').toString().replace(/,/g,' '),
          (r.price||'').toString().replace(/,/g,' '),
          (r.link||r.url||'')
        ];
        lines.push(row.join(','));
      });
      const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'catalog.csv';
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }

    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.columns = [
        { header:'#', key:'idx', width:5 },
        { header:'货号', key:'sku', width:20 },
        { header:'图片', key:'img', width:30 },
        { header:'描述', key:'title', width:40 },
        { header:'起订量', key:'moq', width:10 },
        { header:'单价', key:'price', width:15 },
        { header:'链接', key:'link', width:40 },
      ];
      lastRows.forEach((r,i) => {
        ws.addRow({
          idx: i+1,
          sku: r.sku||'',
          img: r.img||'',
          title: r.title||r.desc||'',
          moq: r.moq||'',
          price: r.currency ? `${r.price||''} ${r.currency}` : (r.price||''),
          link: r.link||r.url||'',
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'catalog.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      console.error(e);
      setToast('导出失败：'+ e.message, false);
    }
  };

  // ---------------- 抓取核心：detect -> parse（GET） ----------------
  const detectType = async (url) => {
    if (!API_BASE) return null;
    try {
      const r = await fetch(`${API_BASE}/v1/api/detect?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
      });
      if (!r.ok) return null;
      const j = await r.json();
      if (j?.ok && j?.type) return j.type;
      return null;
    } catch { return null; }
  };

  const parseCatalog = async (url, limit, hintT) => {
    const search = new URLSearchParams();
    search.set('url', url);
    if (limit) search.set('limit', String(limit));
    // 为图片与详情设置一些温和默认（后端会忽略未知参数，安全）
    search.set('imgCount', '2');
    search.set('compare', '1');
    search.set('detailSkuMax', '8');
    search.set('imgDelim', ' ');
    if (hintT) search.set('t', hintT);

    const api = `${API_BASE}/v1/api/catalog/parse?${search.toString()}`;
    const r = await fetch(api, {
      method: 'GET',               // 关键：用 GET，避免 preflight
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-cache',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  const fetchCatalog = async () => {
    const url = (els.urlInput?.value || '').trim();
    const limit = Number(els.selectLimit?.value || 50) || 50;
    if (!url) return setToast('请输入目录页链接', false);
    if (!API_BASE) return setToast('未指定网关 ?api=，无法抓取', false);

    setToast('正在检测页面类型…');
    clearTable();

    let type = await detectType(url);
    // 将检测到的 type 映射为 t；未知则不带 t，让后端自己兜底
    const t = TYPE_TO_T[type] || '';

    try {
      setToast(`正在抓取（${type || '通用模式'}）…`);
      const data = await parseCatalog(url, limit, t);
      if (!data?.ok) {
        setToast(`抓取失败：${data?.error || 'unknown'}`, false);
        return;
      }

      const list = Array.isArray(data.products) ? data.products : [];
      // 如果后端返回的是“通用 a 标签列表”（常见为空 sku、无价），提醒用户可能未识别
      const looksLikeGeneric =
        list.length && list.every(x => !x.price && !x.sku && !x.moq);

      if (!list.length || looksLikeGeneric) {
        setToast('已抓取但未识别为电商目录（或解析模板不匹配），返回了页面链接列表。建议更换目录链接或稍后再试。', false);
      } else {
        setToast(`抓取成功：共 ${list.length} 条（预览前 ${Math.min(list.length, limit)} 条）`);
      }

      // 渲染（不管是不是通用列表，仍然展示）
      renderRows(list.slice(0, limit));
    } catch (e) {
      console.error(e);
      setToast('抓取失败：' + e.message, false);
    }
  };

  // ---------------- 绑定事件 ----------------
  els.btnFetch?.addEventListener('click', fetchCatalog);
  els.btnExport?.addEventListener('click', exportXlsx);
  els.btnClear?.addEventListener('click', () => { clearTable(); lastRows = []; setToast('已清空'); });
  els.urlInput?.addEventListener?.('keydown', e => { if (e.key === 'Enter') fetchCatalog(); });

  // 启动时轻量健康检查（不阻塞 UI）
  (async () => {
    if (!API_BASE) return;
    try { await fetch(`${API_BASE}/v1/api/health`, { mode: 'cors', credentials:'omit' }); }
    catch {}
  })();

})();
