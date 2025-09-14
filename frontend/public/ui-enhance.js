/* public/ui-enhance.js —— 直接覆盖即可。挂接到你现有的 UI，不改变页面结构与样式。 */

(() => {
  // ---------- 小工具 ----------
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
  const el = (tag, attrs={}) => { const n=document.createElement(tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); return n; };

  const state = { apiBase: "", items: [] };

  const getApiBase = () => {
    if (state.apiBase) return state.apiBase;
    try {
      const u = new URL(location.href);
      const a = (u.searchParams.get("api") || "").replace(/\/+$/,"");
      state.apiBase = a;
      return a;
    } catch { return ""; }
  };

  function queryByText(tag, re){
    return $$(tag).find(n => re.test((n.innerText || n.textContent || "").trim()));
  }

  // ---------- 绑定现有页面控件（不破坏你的 DOM） ----------
  const els = {
    url: null, btnFetch: null, btnExport: null, btnClear: null, limit: null,
    previewBox: null, table: null, tbody: null, toast: null
  };

  function hookExistingUI(){
    els.url = $('input[placeholder*="目录"], input[placeholder*="页面"], textarea[placeholder*="目录"]') || $('input,textarea');

    els.btnFetch  = queryByText('button', /抓取目录|Fetch|抓取/);
    els.btnExport = queryByText('button', /导出\s*Excel/i);
    els.btnClear  = queryByText('button', /清空数据|清空/i);

    els.limit = $$('select').find(s => [...s.options].some(o => /50|100|150/.test(o.text)));

    // 找到你页面里的大虚线容器（包含 ui.no_data）
    els.previewBox = $$('div,section,main,article').find(d => (d.textContent||'').includes('ui.no_data')) || document.body;
  }

  function ensureToast(){
    if (els.toast) return;
    els.toast = el('div', { id:'mvp3-toast' });
    els.toast.style.cssText = 'display:none;margin:8px 0;padding:8px 12px;border-left:4px solid #0ea5e9;background:#f0f9ff;border-radius:6px;';
    els.previewBox.prepend(els.toast);
  }
  function toast(type, msg){
    ensureToast();
    els.toast.style.display = 'block';
    els.toast.style.borderLeftColor = (type==='ok') ? '#10b981' : '#f59e0b';
    els.toast.textContent = msg;
  }

  function ensureTable(){
    if (els.table && document.body.contains(els.table)) return;
    const wrap = el('div'); wrap.style.cssText = 'margin-top:8px;';
    els.table = el('table', { class:'grid', style:'width:100%;border-collapse:collapse;background:#fff;font-size:14px;table-layout:fixed;border:1px dashed #ddd;' });
    const thead = el('thead');
    thead.innerHTML = `
      <tr style="text-align:left;border-bottom:1px solid #eee;background:#fafafa">
        <th style="padding:8px;width:48px">#</th>
        <th style="padding:8px;width:160px">Item No.</th>
        <th style="padding:8px;width:80px">Picture</th>
        <th style="padding:8px">Description</th>
        <th style="padding:8px;width:120px">MOQ</th>
        <th style="padding:8px;width:140px">Unit Price</th>
        <th style="padding:8px;width:90px">Link</th>
      </tr>`;
    els.tbody = el('tbody');
    els.table.appendChild(thead); els.table.appendChild(els.tbody);
    wrap.appendChild(els.table);
    els.previewBox.appendChild(wrap);
  }

  function render(items){
    ensureTable();
    if (!Array.isArray(items) || !items.length){
      els.tbody.innerHTML = `<tr><td colspan="7" style="padding:12px;color:#999">ui.no_data</td></tr>`;
      return;
    }
    els.tbody.innerHTML = items.map((it,i)=>{
      const sku   = it.sku ?? it.itemNo ?? it.code ?? '';
      const title = it.title ?? it.name ?? '';
      const price = it.price ?? '';
      const moq   = it.moq ?? '';
      const img   = it.img ? `<img src="${it.img}" alt="" loading="lazy" style="width:54px;height:54px;object-fit:cover;border:1px solid #eee;border-radius:4px;" />` : '';
      const link  = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">链接</a>` : '';
      return `
        <tr style="border-bottom:1px dashed #eee">
          <td style="padding:8px">${i+1}</td>
          <td style="padding:8px;word-break:break-all">${sku}</td>
          <td style="padding:8px">${img}</td>
          <td style="padding:8px;word-break:break-word">${title}</td>
          <td style="padding:8px">${moq || "—"}</td>
          <td style="padding:8px">${price || "—"}</td>
          <td style="padding:8px">${link}</td>
        </tr>`;
    }).join('');
  }

  function clearData(){
    state.items = [];
    if (els.tbody) els.tbody.innerHTML = `<tr><td colspan="7" style="padding:12px;color:#999">ui.no_data</td></tr>`;
    if (els.toast) els.toast.style.display = 'none';
  }

  // ---------- 健康探测（不阻塞） ----------
  async function probeHealth(api){
    const cands = ['/api/health','/health','/api/healthz','/healthz'];
    for (const p of cands) {
      try { const r = await fetch(api.replace(/\/$/,'') + p); if (r.ok) return; } catch {}
    }
  }

  // ---------- 抓取（默认 enrich=true 以补价格） ----------
  async function fetchCatalog(){
    try{
      const api = getApiBase();
      if(!api) return toast('fail','缺少 ?api= 后端地址');

      const raw = (els.url && (els.url.value || els.url.textContent) || '').trim();
      if(!raw) return toast('fail','请输入目录/列表页链接');

      let targetUrl = raw;
      try { const u = new URL(raw); const u2 = u.searchParams.get('url'); if(u2) targetUrl = decodeURIComponent(u2); } catch {}

      probeHealth(api);

      const limit = parseInt((els.limit && els.limit.value) || '50', 10) || 50;
      toast('ok','正在抓取中…');

      const url = `${api}/v1/api/catalog/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}&enrich=true`;
      const res = await fetch(url);
      if(!res.ok){ clearData(); return toast('fail', `抓取失败：HTTP ${res.status}`); }

      const data = await res.json().catch(()=> ({}));
      if(!data || data.ok === false){ clearData(); return toast('fail', data?.message || data?.error || '抓取失败'); }

      state.items = data.products || data.items || [];
      render(state.items);
      toast('ok', `抓取成功：共 ${state.items.length} 条（预览前 ${Math.min(state.items.length, limit)} 条）`);
    }catch(e){
      console.error(e);
      clearData();
      toast('fail', e.message || String(e));
    }
  }

  // ---------- 导出（优先 ExcelJS + 真实图片；失败回退 .xls） ----------
  async function exportExcel(){
    if (!state.items.length) return toast('fail','没有可导出的数据');

    // 没有 ExcelJS：降级 .xls（不含图）
    if (typeof ExcelJS === 'undefined') {
      toast('fail','未加载 ExcelJS，已回退为 .xls（不含图片）。请在页面引入 ExcelJS CDN 才能嵌入图片。');
      const table = els.table;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${table ? table.outerHTML : ''}</body></html>`;
      const blob = new Blob([html], { type:'application/vnd.ms-excel' });
      const a = el('a', { download:`catalog-${Date.now()}.xls` });
      a.href = URL.createObjectURL(blob); document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800);
      return;
    }

    try{
      const api = getApiBase();
      const wb  = new ExcelJS.Workbook();
      const ws  = wb.addWorksheet('Catalog', { properties:{ defaultRowHeight: 64 } });

      ws.columns = [
        { header:'Item No.', key:'sku',   width:16 },
        { header:'Picture',  key:'img',   width:14 },
        { header:'Description', key:'title', width:60 },
        { header:'MOQ',      key:'moq',   width:12 },
        { header:'Unit Price', key:'price', width:16 },
        { header:'Link',     key:'url',   width:42 }
      ];

      state.items.forEach(it=>{
        ws.addRow({
          sku: it.sku ?? it.itemNo ?? it.code ?? '',
          img: '',
          title: it.title ?? it.name ?? '',
          moq: it.moq ?? '',
          price: it.price ?? '',
          url: it.url ?? ''
        });
      });

      // 链接 + 行高
      for (let i=0;i<state.items.length;i++) {
        const rowIdx = i + 2; // 第1行为表头
        const url = state.items[i].url || '';
        if (url) ws.getCell(rowIdx,6).value = { text:'链接', hyperlink:url };
        ws.getRow(rowIdx).height = 64;
      }

      // --- 关键：下载图片并嵌入（纯 base64，不能带 data:image/...;base64, 前缀） ---
      const toBase64 = (ab) => {
        const b = new Uint8Array(ab); let s=''; for (let i=0;i<b.length;i++) s += String.fromCharCode(b[i]);
        // 纯 base64（ExcelJS 需要的就是这个）
        return btoa(s);
      };
      const detectExt = (ct, url) => (/png/i.test(ct) || /\.png(\?|$)/i.test(url)) ? 'png' : 'jpeg';

      // 控制并发，避免一次性太多请求
      const runBatch = async (arr, limit, worker) => {
        const q = arr.slice(); const running = [];
        const tick = () => {
          while (running.length < limit && q.length) {
            const idx = arr.length - q.length;
            const item = q.shift();
            const p = worker(item, idx).finally(() => running.splice(running.indexOf(p),1));
            running.push(p);
          }
          if (running.length) return Promise.race(running).then(tick);
        };
        await tick(); await Promise.all(running);
      };

      await runBatch(state.items, 6, async (it, idx) => {
        if (!it.img) return;
        try {
          const proxied = `${api}/v1/api/image?url=${encodeURIComponent(it.img)}`;
          const r = await fetch(proxied);
          if (!r.ok) return;
          const ab  = await r.arrayBuffer();
          const ct  = r.headers.get('content-type') || '';
          const ext = detectExt(ct, it.img);
          const base64 = toBase64(ab);

          // ！！一行补丁：ExcelJS 需要纯 base64，不能带 dataURL 前缀
          const imageId = wb.addImage({ base64: base64, extension: ext });

          const rowIdx = idx + 2; // 表头占第1行
          // 使用 oneCellAnchor：定位到 B 列对应行，指定尺寸
          ws.addImage(imageId, { tl:{ col:1, row: rowIdx-1 }, ext:{ width:60, height:60 }, editAs: 'oneCell' });
        } catch {}
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = el('a', { download:`catalog-preview-${new Date().toISOString().slice(0,10)}-${Date.now()}.xlsx` });
      a.href = URL.createObjectURL(blob); document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800);
      toast('ok','已导出 Excel（含图片）');
    } catch (e) {
      console.error('[exceljs]', e);
      toast('fail','ExcelJS 导出遇到问题，回退为 .xls（不含图）');
      const table = els.table;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${table ? table.outerHTML : ''}</body></html>`;
      const blob = new Blob([html], { type:'application/vnd.ms-excel' });
      const a = el('a', { download:`catalog-${Date.now()}.xls` });
      a.href = URL.createObjectURL(blob); document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800);
    }
  }

  // ---------- 启动 ----------
  function start(){
    hookExistingUI();
    els.btnFetch  && els.btnFetch.addEventListener('click', fetchCatalog);
    els.btnExport && els.btnExport.addEventListener('click', exportExcel);
    els.btnClear  && els.btnClear.addEventListener('click', clearData);
    els.url && els.url.addEventListener('keydown', e => { if(e.key==='Enter') fetchCatalog(); });
    ensureToast(); ensureTable(); clearData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
