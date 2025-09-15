/* public/ui-enhance.js — 强化接管版：多事件 + 逐级匹配文本；Excel 导出含图片与价格占位符 */

(() => {

  // ---- 轻量 Buffer polyfill（防止第三方脚本误用）----
  if (typeof window.Buffer === 'undefined') {
    window.Buffer = {
      from: (data, enc) => {
        if (enc === 'base64') {
          const bin = atob(data);
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          return out;
        }
        throw new Error('Unsupported encoding: ' + enc);
      },
      isBuffer: (v) => v instanceof Uint8Array
    };
  }

  const $  = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
  const el = (t, a={}) => { const n=document.createElement(t); for (const[k,v] of Object.entries(a)) n.setAttribute(k,v); return n; };

  const DEFAULT_PRICE = '€ 0,00';
  const state = { apiBase:'', items:[] };

  const getApiBase = () => {
    if (state.apiBase) return state.apiBase;
    try {
      const u = new URL(location.href);
      state.apiBase = (u.searchParams.get('api') || '').replace(/\/+$/,'');
      return state.apiBase;
    } catch { return ''; }
  };

  // ---- UI & Toast ----
  const els = { url:null, limit:null, previewBox:null, table:null, tbody:null, toast:null };

  function hookUI(){
    // 输入框（尽量找“目录/列表/页面”占位，找不到就退化到首个 input/textarea）
    els.url =
      $('input[placeholder*="目录"], input[placeholder*="页面"], input[placeholder*="列表"], textarea[placeholder*="目录"]') ||
      $('input[type=text]') || $('textarea') || $('input,textarea');

    // 下拉（只打一次补丁）
    const sel = $$('select').find(s => true);
    if (sel && !sel.dataset.mvp3Patched) {
      sel.innerHTML = [50,100,200].map(v => `<option value="${v}">${v}</option>`).join('');
      sel.value = '50';
      sel.dataset.mvp3Patched = '1';
    }
    els.limit = sel || null;

    // 预览容器（含 ui.no_data 的那个大盒子）
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
    els.toast.style.borderLeftColor = type==='ok' ? '#10b981' : '#f59e0b';
    els.toast.textContent = msg;
  }

  // ---- 预览表 ----
  function ensureTable(){
    if (els.table && document.body.contains(els.table)) return;
    const wrap = el('div'); wrap.style.cssText = 'margin-top:8px;';
    els.table = el('table', { style:'width:100%;border-collapse:collapse;background:#fff;font-size:14px;table-layout:fixed;border:1px dashed #ddd;' });
    const thead = el('thead'); thead.innerHTML = `
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
  function clearData(){
    state.items = [];
    ensureTable();
    els.tbody.innerHTML = `<tr><td colspan="7" style="padding:12px;color:#999">ui.no_data</td></tr>`;
    if (els.toast) els.toast.style.display = 'none';
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

  async function probeHealth(api){
    const cs = ['/api/health','/health','/api/healthz','/healthz'];
    for (const p of cs) { try { const r = await fetch(api.replace(/\/$/,'') + p); if (r.ok) return; } catch {} }
  }

  // ---- 抓取 ----
  async function fetchCatalog(){
    try{
      hookUI();                         // 每次操作前刷新引用
      const api = getApiBase(); if(!api) return toast('fail','缺少 ?api= 后端地址');
      const raw = (els.url && (els.url.value || els.url.textContent) || '').trim();
      if(!raw) return toast('fail','请输入目录/列表页链接');

      let targetUrl = raw;
      try { const u = new URL(raw); const u2 = u.searchParams.get('url'); if(u2) targetUrl = decodeURIComponent(u2); } catch {}

      const limit = parseInt((els.limit && els.limit.value) || '50',10)||50;
      const enrichCount = Math.min(limit, 50);
      toast('ok','正在抓取中…'); probeHealth(api);

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
    }catch(err){ console.error(err); clearData(); toast('fail', err.message || String(err)); }
  }

  // ---- ExcelJS 导出（含图片）----
  async function exportExcel(){
    hookUI();
    if (!state.items.length) return toast('fail','没有可导出的数据');

    // 无 ExcelJS：退化为 HTML 表格（xls）下载
    if (typeof ExcelJS === 'undefined') {
      const table = els.table;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${table?table.outerHTML:''}</body></html>`;
      const blob = new Blob([html], { type:'application/vnd.ms-excel' });
      const a = el('a', { download:`catalog-${Date.now()}.xls` });
      a.href = URL.createObjectURL(blob); document.body.appendChild(a); a.click();
      // 给足时间，避免过早 revoke 导致下载被中断
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 30000);
      return;
    }

    const api = getApiBase();
    const wb  = new ExcelJS.Workbook();
    const ws  = wb.addWorksheet('Catalog', { properties:{ defaultRowHeight: 64 } });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from:'A1', to:'F1' };
    ws.getRow(1).font = { bold:true };

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
        price: (it.price && String(it.price).trim()) || DEFAULT_PRICE,
        url: it.url ?? ''
      });
    });

    for (let i=0;i<state.items.length;i++){
      const rowIdx = i + 2;
      const url = state.items[i].url || '';
      if (url) ws.getCell(rowIdx,6).value = { text:'链接', hyperlink:url };
      ws.getRow(rowIdx).height = 64;
    }

    const toBase64 = (ab) => {
      const b = new Uint8Array(ab); let s=''; for (let i=0;i<b.length;i++) s += String.fromCharCode(b[i]); return btoa(s);
    };
    const detectExt = (ct, url) => (/png/i.test(ct) || /\.png(\?|$)/i.test(url)) ? 'png' : 'jpeg';

    const runBatch = async (arr, limit, worker) => {
      let idx = 0; const runners = Array.from({length:limit}).map(async () => {
        for (; idx < arr.length; ) { const i = idx++; await worker(arr[i], i); }
      }); await Promise.all(runners);
    };

    // 并发取图并嵌入
    await runBatch(state.items, 6, async (it, idx) => {
      if (!it.img) return;
      try {
        const proxied = `${api}/v1/api/image?url=${encodeURIComponent(it.img)}`;
        console.log('[xlsx] fetch image via proxy:', proxied);
        const r = await fetch(proxied, { cache:'no-store' });
        if (!r.ok) return;
        const ab  = await r.arrayBuffer();
        const ct  = r.headers.get('content-type') || '';
        const ext = detectExt(ct, it.img);
        const base64 = toBase64(ab);
        const imageId = wb.addImage({ base64, extension: ext });
        const rowIdx  = idx + 2;
        ws.addImage(imageId, { tl:{ col:1, row: rowIdx-1 }, ext:{ width:60, height:60 }, editAs:'oneCell' });
      } catch (e) {
        console.warn('embed image failed', it.img, e);
      }
    });

    const host = (()=>{ try { return new URL(els.url.value).hostname.replace(/^www\./,''); } catch { return 'catalog'; } })();
    const buf = await wb.xlsx.writeBuffer();

    // —— 关键修复：更稳妥的下载触发 + 更长 revoke 时间 + 旧 Edge 兼容 ——
    const filename = `${host}-catalog-${new Date().toISOString().slice(0,10)}.xlsx`;
    const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (window.navigator && typeof window.navigator.msSaveOrOpenBlob === 'function') {
      // 旧 Edge / IE
      window.navigator.msSaveOrOpenBlob(blob, filename);
    } else {
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = urlObj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      console.log('[xlsx] download triggered:', filename);
      // 30 秒后再 revoke，避免某些环境下下载尚未真正开始就被撤销
      setTimeout(() => {
        URL.revokeObjectURL(urlObj);
        a.remove();
      }, 30000);
    }

    toast('ok','已导出 Excel（含图片、价格占位符）');
  }

  // ---- 事件接管：不依赖标签，逐级匹配文本 ----
  function matchActionFromNode(node){
    let depth = 0, cur = node;
    while (cur && depth < 4) {
      const text = (cur.innerText || cur.textContent || '').replace(/\s+/g,'').trim();
      if (!text) { cur = cur.parentElement; depth++; continue; }
      if (/导出Excel/i.test(text) || /导出Excel（.xlsx）?/.test(text)) return 'export';
      if (/抓取目录|抓取/i.test(text)) return 'fetch';
      if (/清空数据|清空/i.test(text)) return 'clear';
      cur = cur.parentElement; depth++;
    }
    return null;
  }

  function handleAction(action, e){
    if (!action) return;
    e && (e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation?.());
    console.log('[mvp3] action:', action);
    if (action === 'export') return exportExcel();
    if (action === 'fetch')  return fetchCatalog();
    if (action === 'clear')  return clearData();
  }

  function delegateAny(e){ handleAction(matchActionFromNode(e.target), e); }

  function start(){
    hookUI(); ensureToast(); ensureTable(); clearData();

    // 最大化命中率：多事件 + 捕获阶段
    ['click','pointerup','mouseup'].forEach(evt => {
      document.addEventListener(evt, delegateAny, true);
    });
    document.addEventListener('submit', (e)=> { handleAction('fetch', e); }, true);

    // 在输入框按回车也能触发
    els.url && els.url.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fetchCatalog(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
