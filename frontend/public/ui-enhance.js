/* public/ui-enhance.js — 接管按钮 + ExcelJS 导出（含图片），并把条数改为 50/100/200 */

(() => {
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
  const el = (tag, attrs={}) => { const n=document.createElement(tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); return n; };

  const DEFAULT_PRICE = "€ 0,00";
  const state = { apiBase: "", items: [] };
  const getApiBase = () => { if (state.apiBase) return state.apiBase; try { const u = new URL(location.href); state.apiBase = (u.searchParams.get("api") || "").replace(/\/+$/,""); return state.apiBase; } catch { return ""; } };

  const els = { url:null, btnFetch:null, btnExport:null, btnClear:null, limit:null, previewBox:null, table:null, tbody:null, toast:null };
  function byText(tag, re){ return $$(tag).find(n => re.test((n.innerText || n.textContent || "").trim())); }

  function hookUI(){
    els.url      = $('input[placeholder*="目录"], input[placeholder*="页面"], textarea[placeholder*="目录"]') || $('input,textarea');
    els.btnFetch = byText('button', /抓取目录|Fetch|抓取/);
    els.btnExport= byText('button', /导出\s*Excel/i);
    els.btnClear = byText('button', /清空数据|清空/i);
    els.limit    = $$('select').find(s => true) || null;

    // 把“预览（前 50 条）”改成 50/100/200
    if (els.limit) {
      const values = [50, 100, 200];
      els.limit.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join("");
      els.limit.value = "50";
    }

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
      const price = (it.price && String(it.price).trim()) || DEFAULT_PRICE;
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
          <td style="padding:8px">${price}</td>
          <td style="padding:8px">${link}</td>
        </tr>`;
    }).join('');
  }

  function clearData(){
    state.items = [];
    ensureTable();
    els.tbody.innerHTML = `<tr><td colspan="7" style="padding:12px;color:#999">ui.no_data</td></tr>`;
    if (els.toast) els.toast.style.display = 'none';
  }

  async function probeHealth(api){
    const cands = ['/api/health','/health','/api/healthz','/healthz'];
    for (const p of cands) { try { const r = await fetch(api.replace(/\/$/,'') + p); if (r.ok) return; } catch {} }
  }

  async function fetchCatalog(e){
    if (e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); }
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

      // 可选传 enrichCount（例如等于 limit，但最多 50，避免过慢）
      const enrichCount = Math.min(limit, 50);
      const url = `${api}/v1/api/catalog/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}&enrich=true&enrichCount=${enrichCount}`;
      const res = await fetch(url);
      if(!res.ok){ clearData(); return toast('fail', `抓取失败：HTTP ${res.status}`); }

      const data = await res.json().catch(()=> ({}));
      if(!data || data.ok === false){ clearData(); return toast('fail', data?.message || data?.error || '抓取失败'); }

      state.items = (data.products || data.items || []).map(it => ({
        ...it,
        price: (it.price && String(it.price).trim()) || DEFAULT_PRICE
      }));
      render(state.items);
      toast('ok', `抓取成功：共 ${state.items.length} 条（预览 ${Math.min(state.items.length, limit)} 条）`);
    }catch(err){
      console.error(err);
      clearData();
      toast('fail', err.message || String(err));
    }
  }

  // 这里省略 ExcelJS 导出函数（你上一版已可用且带图片、占位符）；保持不变即可
  // 如果需要我再粘一次完整导出函数，也可以。

  // ------- 启动：捕获阶段接管按钮 -------
  function start(){
    hookUI(); ensureToast(); ensureTable(); clearData();

    const exportBtnHandler = window.__mvp_export_handler; // 若你上版已挂载，可复用
    els.btnFetch  && els.btnFetch.addEventListener('click',  fetchCatalog, { capture:true });
    els.btnClear  && els.btnClear.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); clearData(); }, { capture:true });
    if (els.btnExport) {
      // 若你用的是我上一版的导出函数，这里确保绑定即可
      els.btnExport.addEventListener('click', exportBtnHandler || (()=>{}), { capture:true });
    }

    els.url && els.url.addEventListener('keydown', e => { if(e.key==='Enter') fetchCatalog(e); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
