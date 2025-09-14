(function () {
  const $ = (s) => document.querySelector(s);
  const log = (t) => { const el = $('#log'); el.textContent = (el.textContent ? el.textContent + '\n' : '') + t; };

  window.addEventListener('error', (e) => log('[JS Error] ' + e.message));

  async function probeHealth(apiBase) {
    // 依次尝试这四个端点，哪个先 200 就用哪个
    const candidates = ['/healthz', '/api/healthz', '/health', '/api/health'];
    for (const p of candidates) {
      const url = apiBase.replace(/\/$/, '') + p;
      try {
        const r = await fetch(url, { method: 'GET' });
        log(`[probe] ${url} -> ${r.status}`);
        if (r.ok) {
          const txt = await r.text();
          return { ok: true, url, text: txt };
        }
      } catch (e) {
        log(`[probe error] ${url} -> ${e.message}`);
      }
    }
    return { ok: false };
  }

  window.addEventListener('DOMContentLoaded', () => {
    log('[ready] 页面就绪');

    const apiBase =
      new URLSearchParams(location.search).get('api') ||
      (location.origin.replace(/\/$/, '') + '/api'); // 无 ?api 时走同源 /api

    $('#btnFetch')?.addEventListener('click', async () => {
      log('[action] 点击抓取目录');
      log('[info] apiBase=' + apiBase);

      const res = await probeHealth(apiBase);
      if (res.ok) {
        log('[health] 200 ' + res.url + ' ' + String(res.text).slice(0, 120));
      } else {
        log('[health] 所有候选端点均未通过（请检查后端健康路由）');
      }
    });

    $('#btnExport')?.addEventListener('click', () => log('[action] 点击导出'));
    $('#btnClear')?.addEventListener('click', () => { $('#log').textContent = ''; log('已清空'); });
  });
})();
