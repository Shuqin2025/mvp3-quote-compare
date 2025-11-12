// frontend/public/export-xlsx.js
// -------------- Excel 导出（增强版） --------------
// 设计目标：
// 1) 兼容 /v1/export-xlsx (POST) 与 /v1/api/export-xlsx (GET) 两种网关路由；
// 2) 从当前页面表格 #tbl 抽取 rows -> items，包含 sku/img/title/price/url；
// 3) 返回 Blob -> 保存成 export.xlsx；
// 4) 尽量不侵入其它脚本，暴露 window.ExportXLSX.run() 供 ui-plus 调用。

(function () {
  const qs = new URLSearchParams(location.search);
  const apiBaseRaw = (qs.get('api') || '').trim();
  const API_BASE = apiBaseRaw ? apiBaseRaw.replace(/\/+$/,'') : '';
  const LANG = (localStorage.getItem('mvp_lang') || 'zh').toLowerCase();

  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  const tip = {
    ok: (msg)   => setStatus(msg || 'ok', true),
    fail:(msg)  => setStatus(msg || 'Failed to export', false),
    info:(msg)  => setStatus(msg || 'Working...', true)
  };

  function setStatus(text, ok) {
    let bar = $('#okbar');
    if (!bar) return;
    bar.style.display = 'block';
    bar.className = ok ? 'alert ok' : 'alert info';
    bar.textContent = text;
  }

  // 生成两个可能的导出端点：优先 /v1/export-xlsx（POST），失败退回到 /v1/api/export-xlsx（GET）
  function endpoints() {
    if (!API_BASE) return [];
    return [
      { kind: 'post', url: `${API_BASE}/v1/export-xlsx` },
      { kind: 'get',  url: `${API_BASE}/v1/api/export-xlsx` }
    ];
  }

  // 表格抽取器：#tbl -> items
  function collectRows() {
    const rows = $$('#tbl tbody tr');
    const items = [];

    rows.forEach(tr => {
      const tds = tr.children;
      if (!tds || tds.length < 6) return;

      // 列结构（按你页面）：# | 货号 | 图片 | 描述 | 单价 | 打开
      const sku    = (tds[1].textContent || '').trim();
      const imgEl  = $('img', tds[2]);
      const title  = (tds[3].textContent || '').trim();
      const price  = (tds[4].textContent || '').trim();
      const aOpen  = $('.open-link, a', tds[5]);

      // 原图链接（来自 <img data-src 或 src>）
      const imgRaw = (imgEl && (imgEl.getAttribute('data-src') || imgEl.getAttribute('data-original') || imgEl.src)) || '';
      // 若你启用了图片代理，img 可能是 gateway 地址；尝试还原出原图（如果 data-raw 存在）
      const imgRawData = imgEl?.getAttribute?.('data-raw') || '';
      const imgUrlOriginal = imgRawData || imgRaw;

      // 尝试给出一个“代理图 URL”（供后端自由选择）
      const imgProxy = buildImageProxy(imgUrlOriginal);

      const url = aOpen ? aOpen.getAttribute('href') : '';

      items.push({
        sku,
        title,
        price,
        img: imgUrlOriginal,
        img_proxy: imgProxy,
        url
      });
    });

    return items;
  }

  function buildImageProxy(raw) {
    if (!raw || !API_BASE) return '';
    const candidates = [
      `${API_BASE}/v1/image?url=${encodeURIComponent(raw)}`,
      `${API_BASE}/v1/image?format=raw&url=${encodeURIComponent(raw)}`,
      `${API_BASE}/v1/api/image?url=${encodeURIComponent(raw)}`,
      `${API_BASE}/v1/api/image?format=raw&url=${encodeURIComponent(raw)}`
    ];
    return candidates[0]; // 给一个主用，后端可忽略
  }

  async function exportViaPost(ep, payload) {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // 让 Cloudflare/Proxy 不缓存
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`POST ${ep.url} -> ${res.status}`);
    return await res.blob();
  }

  async function exportViaGet(ep, query) {
    // 旧 GET 方案：把 url & limit 挂在 query_string（后端自行抓）
    const u = new URL(ep.url);
    Object.entries(query || {}).forEach(([k,v]) => u.searchParams.set(k, v));
    const res = await fetch(u.toString(), { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${u} -> ${res.status}`);
    return await res.blob();
  }

  function downloadBlob(blob, filename='export.xlsx') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  function currentCatalogUrl() {
    // 输入框值
    const urlInput = $('#txtUrl');
    const val = urlInput ? (urlInput.value || '').trim() : '';
    return val;
  }

  async function runExport() {
    try {
      if (!API_BASE) {
        tip.fail('缺少 ?api= 网关地址');
        return;
      }
      const list = collectRows();
      if (!list.length) {
        tip.fail('没有可导出的数据');
        return;
      }

      tip.info(LANG.startsWith('zh') ? '正在导出...' : 'Exporting...');

      const payload = {
        ok: true,
        url: currentCatalogUrl(),
        count: list.length,
        adapter: 'generic-cards',
        items: list,   // 原始项
        rows: list,    // 行视图（后端任意取用）
        data: list     // 兼容字段
      };

      const eps = endpoints();
      if (!eps.length) {
        tip.fail('网关未配置');
        return;
      }

      // 优先 POST /v1/export-xlsx
      let got = null;
      let err = null;

      // 1) POST
      const epPost = eps.find(e => e.kind === 'post');
      if (epPost) {
        try {
          got = await exportViaPost(epPost, payload);
        } catch (e) {
          err = e;
        }
      }

      // 2) 回退 GET /v1/api/export-xlsx?url=...&limit=...
      if (!got) {
        const epGet = eps.find(e => e.kind === 'get');
        if (!epGet) throw err || new Error('没有可用导出端点');
        const q = {
          url: payload.url || location.href,
          limit: String(list.length || 50)
        };
        got = await exportViaGet(epGet, q);
      }

      downloadBlob(got, 'export.xlsx');
      tip.ok(LANG.startsWith('zh') ? '导出成功' : 'Exported.');
    } catch (e) {
      console.error('[export-xlsx] failed:', e);
      tip.fail((LANG.startsWith('zh') ? '导出失败：' : 'Export failed: ') + (e.message || e));
    }
  }

  // 对外：给 ui-plus 调用；也绑定按钮
  const api = {
    run: runExport
  };
  window.ExportXLSX = api;

  // 自动挂到按钮
  document.addEventListener('DOMContentLoaded', () => {
    const btn = $('#btnExport');
    if (btn && !btn._exportBound) {
      btn._exportBound = true;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        api.run();
      });
    }
  });
})();
