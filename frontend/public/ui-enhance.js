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
    urlInput: $('#txtUrl') || $('#url') || $('input[type="url"], input[name="url"]') || $('input'),
    btnFetch: $('#btnFetch') || $$('.btn').find(b => /抓取/.test(b?.textContent||"")),
    selectLimit: $('#pageSize') || $('select'),
    btnExport: $('#btnExport') || $$('.btn').find(b => /导出|Export/i.test(b?.textContent||"")),
    btnClear: $('#btnClear') || $$('.btn').find(b => /清空|Clear/i.test(b?.textContent||"")),
    toast: $('#status') || $('#okbar') || $('.alert') || $('.msg') || null,
    tbody: $('#tbl tbody') || $('table tbody') || $('tbody'),
    thead: $('#tbl thead') || $('table thead') || $('thead'),
    table: $('#tbl') || $('table'),
  };

  const setToast = (msg, ok=true) => {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.style.display = 'block';
    els.toast.classList?.remove('ok','info');
    els.toast.style.background = ok ? '#fff8e1' : '#ffecec';
    els.toast.style.color = ok ? '#444' : '#b00020';
  };

  const clearTable = () => {
    if (els.tbody) els.tbody.innerHTML = '';
  };

  // 将检测到的 type -> 解析器 t 参数
  const TYPE_TO_T = {
    'Shopify': 'shopify',
    'WooCommerce': 'woocommerce',   // ← 修正映射
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
        const imgUrl = API_BASE
          ? `${API_BASE}/v1/api/image?url=${encodeURIComponent(r.img)}`
          : r.img;
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
      tdPrice.textContent = r.price
        ? (r.currency ? `${r.price} ${r.currency}` : r.price)
        : '—';

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

  const normalizeRows = (data) => {
    const arr = Array.isArray(data?.products) ? data.products : [];
    const base = (els?.urlInput?.value || '').trim();   // 当前目录页的 URL
    const toAbs = (u) => {
      if (!u) return '';
      try { return new URL(u, base).href; } catch { return u; }
    };
    return arr.map(p => {
      const link = toAbs(p.link || p.url || '');
      const imgRaw = p.img || (Array.isArray(p.imgs) ? p.imgs[0] : '');
      const img = toAbs(imgRaw);
      return {
        sku: p.sku || p.code || '',
        title: p.title || p.name || p.desc || '',
        img,
        moq: p.moq || '',
        price: p.price || '',
        currency: p.currency || '',
        link,
        url: link,
        desc: p.desc || ''
      };
    });
  };

  // === 适配器猜测：根据 URL 直接给后端一个更靠谱的 t（Unknown 时兜底） ===
  function guessAdapterFromUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.toLowerCase();
      const qs   = u.search.toLowerCase();

      // 0) 站点专用（最稳）
      if (/(^|\.)memoryking\.de$/.test(host)) return 'memoryking';

      // 1) Shopify
      if (
        host.endsWith('myshopify.com') ||
        /(^|\.)kith\.com$/.test(host) ||
        path.includes('/collections/') ||
        path.includes('/products/')
      ) {
        return 'shopify';
      }

      // 2) WooCommerce
      if (
        path.includes('/product-category/') ||
        path === '/shop/' || path.startsWith('/shop/') ||
        path.includes('/product-tag/')
      ) {
        return 'woocommerce';
      }

      // 3) Shopware（德语站常见；使用其典型 query/路径特征）
      if (
        /[?&](scategory|spage|sviewport)=/.test(qs) ||
        path.includes('/listing/') ||
        path.includes('/kategorie/') || path.includes('/kategorien/')
      ) {
        return 'shopware';
      }

      // 4) Magento（简单猜测：/catalog/、/mage/等）
      if (path.includes('/catalog/') || path.includes('/mage/')) {
        return 'magento';
      }

      // 不确定就交给后端 detect
      return '';
    } catch {
      return '';
    }
  }

  async function handleFetchClick() {
    const btn = els.btnFetch;
    const input = document.querySelector('#txtUrl');
    const limitSel = document.querySelector('#selLimit');

    if (!input) {
      setToast('未找到输入框元素 #txtUrl', false);
      return;
    }

    const url = (input.value || '').trim();
    if (!url) {
      setToast('请输入要抓取的目录链接', false);
      return;
    }

    // UI 状态
    clearTable();
    btn && (btn.disabled = true);
    setToast('正在检测网站类型…');

    // 先让后端 detect 一下（用于展示与兜底）
    let type = 'Unknown';
    try { type = await detectType(url); } catch {}

    // 根据 URL 再猜一遍，提升命中率（后端 Unknown 时尤其有用）
    const guessT = guessAdapterFromUrl(url);
    // 注意：TYPE_TO_T 里键是后端 detect 的类型（Shopware/WooCommerce/...），值是你要传给后端的 t
    // 例如：{ Shopware: 'shopware', WooCommerce: 'woocommerce', Shopify: 'shopify', Magento: 'magento' }
    const t = guessT || (TYPE_TO_T[type] || ''); // 优先采用 URL 猜测

    // 记录使用的适配器
    const useAdapterText = t ? `（adapter: ${t}）` : '（adapter: auto）';
    setToast(`开始抓取数据（${type}）${useAdapterText} …`);

    // 读取条数
    const limit = parseInt((limitSel && limitSel.value) || '50', 10) || 50;

    try {
      const data = await parseCatalog(url, limit, t); // 把 t 传给后端
      if (!data || data.ok === false) {
        setToast(`抓取失败：${data?.error || 'unknown'}`, false);
        return;
      }
      // 显示来源（方便排查是否又落到了 generic）
      if (data.adapter) {
        setToast(`抓取成功：共 ${data.count || (data.products?.length || 0)} 条（来源：${data.adapter}）`);
      } else {
        setToast(`抓取成功：共 ${data.count || (data.products?.length || 0)} 条`);
      }
      renderRows(normalizeRows(data));
    } catch (e) {
      console.error(e);
      setToast('抓取失败：' + (e.message || e), false);
    } finally {
      btn && (btn.disabled = false);
    }
  }

  // ---------------- 绑定事件 ----------------
  els.btnFetch?.addEventListener('click', handleFetchClick); // ← 改为新的处理函数
  els.btnExport?.addEventListener('click', exportXlsx);
  els.btnClear?.addEventListener('click', () => { clearTable(); lastRows = []; setToast('已清空'); });
  els.urlInput?.addEventListener?.('keydown', e => { if (e.key === 'Enter') handleFetchClick(); });

  // 启动时轻量健康检查（不阻塞 UI）
  (async () => {
    if (!API_BASE) return;
    try { await fetch(`${API_BASE}/v1/api/health`, { mode: 'cors', credentials:'omit' }); }
    catch {}
  })();

})();

// === 诊断与兜底绑定（追加到 ui-enhance.js 末尾）=========================
(() => {
  const VER = 'diag-2025-10-12-4';
  const q = s => document.querySelector(s);
  const btn = q('#btnFetch') || q('button[data-role="fetch"]') || q('button.fetch-btn');
  const input = q('#txtUrl') || q('input[name="url"], input[type="url"]');

  console.info('[UI] enhance loaded:', VER, { btn: !!btn, input: !!input });

  // 1) 防止按钮是 <button type="submit"> 被表单默认提交打断
  if (btn && (btn.getAttribute('type') || '').toLowerCase() !== 'button') {
    btn.setAttribute('type', 'button');
  }

  // 2) 兜底绑定点击事件（不影响你原来的绑定；若原来已绑定，这个只是额外打印日志）
  if (btn) {
    btn.addEventListener('click', async (e) => {
      try {
        console.log('[UI] 点击抓取按钮');

        const url = (input && input.value || '').trim();
        if (!url) {
          console.warn('[UI] 没有检测到输入 URL');
          return;
        }
        // 打个探针：看看 API 根（从地址栏 ?api= 里拿）
        const api = new URLSearchParams(location.search).get('api')?.replace(/\/+$/,'');
        console.log('[UI] 将使用 API =', api);

        // 轻量探测，不影响主流程
        if (api) {
          const health = `${api}/v1/api/health`;
          console.log('[UI] 试探健康检查 →', health);
          fetch(health, { mode: 'cors' })
            .then(r => r.text())
            .then(t => console.log('[UI] health =', t))
            .catch(err => console.warn('[UI] health 失败:', err));
        } else {
          console.warn('[UI] 没在地址栏 ?api= 里找到网关，当前页面将不会走网关');
        }
      } catch (err) {
        console.error('[UI] 兜底点击处理异常：', err);
      }
     }, { capture: false });
  } else {
    console.warn('[UI] 没找到“抓取目录”按钮，请确认按钮选择器(id/class)是否变更');
  }

  // 3) 再加一层“迟到绑定”，避免脚本早于 DOM 渲染完成
  setTimeout(() => {
    const dbg = q('#btnFetch') || q('button[data-role="fetch"]') || q('button.fetch-btn');
    console.info('[UI] 迟到检查，按钮是否就绪:', !!dbg);
  }, 800);
})();
