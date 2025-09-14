(function () {
  const $ = (s) => document.querySelector(s);
  const log = (t) => { const el = $('#log'); el.textContent = (el.textContent ? el.textContent + '\n' : '') + t; };

  // 捕捉脚本报错
  window.addEventListener('error', (e) => log('[JS Error] ' + e.message));

  window.addEventListener('DOMContentLoaded', () => {
    log('[ready] 页面就绪');

    // 优先取 ?api=，否则默认同源 /api
    const apiBase = new URLSearchParams(location.search).get('api')
      || (location.origin.replace(/\/$/, '') + '/api');

    $('#btnFetch')?.addEventListener('click', async () => {
      log('[action] 点击抓取目录');
      try {
        // 改成 /healthz
        const r = await fetch(apiBase + '/healthz');
        log('[health] ' + r.status + ' ' + (await r.text()).slice(0, 120));
      } catch (e) {
        log('[fetch error] ' + e.message);
        console.error(e);
      }
    });

    $('#btnExport')?.addEventListener('click', () => log('[action] 点击导出'));
    $('#btnClear')?.addEventListener('click', () => { $('#log').textContent = ''; log('已清空'); });
  });
})();

