(function () {
  const $ = (s) => document.querySelector(s);
  const log = (t) => { const el = $('#log'); el.textContent = (el.textContent?el.textContent+'\n':'') + t; };

  // 全局兜底：任何脚本报错都写出来，方便定位
  window.addEventListener('error', (e) => log('[JS Error] ' + e.message));

  window.addEventListener('DOMContentLoaded', () => {
    log('[ready] 页面就绪');

    // ?api=xxx 优先，否则默认同源 /api
    const apiBase = new URLSearchParams(location.search).get('api')
      || (location.origin.replace(/\/$/,'') + '/api');

    $('#btnFetch')?.addEventListener('click', async () => {
      log('[action] 点击抓取目录');
      try {
        const r = await fetch(apiBase + '/health');
        const text = await r.text();
        log('[health] ' + r.status + ' ' + text.slice(0,120));
      } catch (e) {
        log('[fetch error] ' + e.message);
        console.error(e);
      }
    });

    $('#btnExport')?.addEventListener('click', () => log('[action] 点击导出'));
    $('#btnClear')?.addEventListener('click', () => { $('#log').textContent = ''; log('已清空'); });
  });
})();
