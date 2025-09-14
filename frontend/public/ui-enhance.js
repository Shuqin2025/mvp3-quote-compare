/* public/ui-enhance.js  — fixed: use POST /v1/api/parse */

(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // --------- i18n helpers (已有 i18n 全局对象时使用) ----------
  const t = (key, fallback) => {
    try {
      return (window.i18n && typeof i18n.t === 'function') ? i18n.t(key) : (fallback || key);
    } catch {
      return fallback || key;
    }
  };
  const toast = (msg) => {
    // 你页面里已有的提示区域，如果没有可改成 alert(msg)
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fff3cd;color:#664d03;border-bottom:1px solid #ffe69c;padding:8px 12px;z-index:9999;font-size:14px;';
    bar.textContent = msg;
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 2600);
  };

  // --------- 读取 API 基址 ----------
  const getApiBase = () => {
    const u = new URL(location.href);
    const api = u.searchParams.get('api');
    // 传了 ?api= 就用它，否则默认同源
    return api ? api.replace(/\/+$/,'') : '';
  };

  // --------- 主要 DOM ----------
  const inputEl = $('#catalog-url-input') || $('input[type="text"]');
  const fetchBtn = $('#btn-fetch') || $(`[data-i18n="ui.fetch_btn"]`) || $('button');

  const limitSel = $('#limit-select') || $('select');

  // 你的表格渲染函数；这里保留入口，内部逻辑仍然走你原来的实现
  const render = (payload) => {
    // payload 预期形如 { ok:true, count, products/items: [...] }
    // 这里仅触发你现有的渲染路径：触发一个自定义事件或直接调用全局的渲染函数
    if (window.onParsedData) {
      window.onParsedData(payload);
    } else {
      console.log('[render]', payload);
    }
  };

  // --------- 绑定按钮事件 ----------
  async function handleFetch() {
    const url = (inputEl.value || '').trim();
    const limit = parseInt((limitSel && limitSel.value) || '50', 10);

    if (!url) {
      toast(t('ui.input_hint', '请输入或粘贴一个目录/列表页链接'));
      inputEl && inputEl.focus();
      return;
    }

    const apiBase = getApiBase();
    // 关键修正：后端路由是 POST /v1/api/parse
    const endpoint = `${apiBase}/v1/api/parse`;

    const reqBody = { url, limit };

    console.log('[fetch] ->', endpoint, reqBody);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        // 比如 404, 500
        console.error('HTTP error:', res.status, await safeText(res));
        toast(t('toast_fail_prefix', '抓取失败：') + `HTTP ${res.status}`);
        return;
      }

      const data = await safeJson(res);
      console.log('[fetch ok] <-', data);

      if (!data || data.ok === false) {
        toast(t('toast_fail_prefix', '抓取失败：') + (data && data.message ? data.message : 'Unknown'));
        return;
      }

      render(data);
    } catch (err) {
      console.error(err);
      toast(t('toast_fail_prefix', '抓取失败：') + (err && err.message ? err.message : String(err)));
    }
  }

  // --------- 安全解析工具 ----------
  async function safeJson(res) {
    try { return await res.json(); } catch { return null; }
  }
  async function safeText(res) {
    try { return await res.text(); } catch { return ''; }
  }

  // --------- 事件注册 ----------
  if (fetchBtn) {
    fetchBtn.addEventListener('click', handleFetch);
  }
  // 支持回车触发
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleFetch();
    });
  }
})();
