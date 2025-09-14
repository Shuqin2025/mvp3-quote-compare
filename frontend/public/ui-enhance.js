/* ui-enhance v3.5 — MVP3 页面骨架脚本（稳定版）
 * 功能：
 * 1) 解析 ?api=… 作为后端 Base（无则默认同源）
 * 2) “抓取目录” 调用：GET {API}/v1/api/catalog/parse?url=…&limit=…
 * 3) 结果在页面下方表格渲染
 * 4) “导出 Excel（.xlsx）” 调用：GET {API}/v1/api/catalog/export?url=…&limit=…
 *    （后端已负责把图片真实内嵌到 Excel）
 */

(function(){
  const $ = sel => document.querySelector(sel);

  // ---- 解析 API Base ----
  function getApiBase() {
    try {
      const sp = new URLSearchParams(location.search);
      const raw = sp.get('api') || '';
      if (!raw) return '';               // 同源
      // 允许 ?api=https://xxx 或 ?api=xxx（Render 上常见没有协议的写法）
      const hasProto = /^https?:\/\//i.test(raw);
      return hasProto ? raw.replace(/\/+$/,'') : `https://${raw.replace(/\/+$/,'')}`;
    } catch {
      return '';
    }
  }
  const API_BASE = getApiBase();
  $('#envNote').textContent = API_BASE ? `API_BASE：${API_BASE}` : 'API_BASE：同源';

  // ---- 节点 ----
  const inputUrl   = $('#inputUrl');
  const btnFetch   = $('#btnFetch');
  const btnExportT = $('#btnExportTop');
  const btnExportB = $('#btnExportBottom');
  const btnClear   = $('#btnClear');
  const limitSel   = $('#limit');
  const holder     = $('#holder');
  const tableWrap  = $('#tableWrap');
  const tbody      = $('#resultBody');
  const stat       = $('#stat');

  let lastUrl = '';
  let lastCount = 0;

  // ---- 工具 ----
  function setBusy(busy){
    [btnFetch, btnExportT, btnExportB, btnClear].forEach(b=> b.disabled = !!busy);
  }

  function showStat(text, ok=true){
    stat.style.display = 'block';
    stat.style.background = ok ? '#ecfdf5' : '#fef2f2';
    stat.style.borderColor = ok ? '#a7f3d0' : '#fecaca';
    stat.style.color = ok ? '#065f46' : '#991b1b';
    stat.textContent = text;
  }

  function renderRows(items){
    tbody.innerHTML = '';
    if (!Array.isArray(items) || !items.length){
      holder.style.display = '';
      tableWrap.style.display = 'none';
      holder.textContent = 'ui.no_data';
      return;
    }
    holder.style.display = 'none';
    tableWrap.style.display = '';

    items.forEach((it, idx) => {
      const tr = document.createElement('tr');

      const tdIdx = document.createElement('td');
      tdIdx.textContent = String(idx+1);
      tr.appendChild(tdIdx);

      const tdSku = document.createElement('td');
      tdSku.textContent = it.sku || it.itemNo || '';
      tr.appendChild(tdSku);

      const tdImg = document.createElement('td');
      tdImg.className = 'imgCell';
      if (it.img) {
        const img = new Image();
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = it.img;
        tdImg.appendChild(img);
      } else {
        tdImg.innerHTML = '<span class="muted">—</span>';
      }
      tr.appendChild(tdImg);

      const tdDesc = document.createElement('td');
      tdDesc.textContent = it.title || it.description || '';
      tr.appendChild(tdDesc);

      const tdMoq = document.createElement('td');
      tdMoq.textContent = it.moq || '';
      tr.appendChild(tdMoq);

      const tdPrice = document.createElement('td');
      tdPrice.textContent = it.price || '';
      tr.appendChild(tdPrice);

      const tdLink = document.createElement('td');
      if (it.url) {
        const a = document.createElement('a');
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = '链接';
        tdLink.appendChild(a);
      } else {
        tdLink.innerHTML = '<span class="muted">—</span>';
      }
      tr.appendChild(tdLink);

      tbody.appendChild(tr);
    });
  }

  // ---- 调用后端：parse ----
  async function doFetch(){
    const url = (inputUrl.value || '').trim();
    if (!url) {
      showStat('请输入目录页链接。', false);
      return;
    }
    setBusy(true);
    showStat('正在抓取中…');

    try{
      const base = API_BASE || '';
      const endpoint = `${base}/v1/api/catalog/parse?url=${encodeURIComponent(url)}&limit=${encodeURIComponent(limitSel.value)}`;
      const res = await fetch(endpoint, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // 兼容多种返回结构：{items:[]} 或 {data:{items:[]}} 或 直接 []
      const items = Array.isArray(data) ? data
                  : Array.isArray(data.items) ? data.items
                  : (data.data && Array.isArray(data.data.items)) ? data.data.items
                  : [];

      renderRows(items);
      lastUrl = url;
      lastCount = items.length;
      showStat(`抓取成功，共 ${lastCount} 条`);
    }catch(err){
      console.error('[mvp3] fetch error:', err);
      renderRows([]);
      showStat(`抓取失败：${err.message || err}`, false);
      alert(`抓取失败：${err.message || err}`);
    }finally{
      setBusy(false);
    }
  }

  // ---- 调用后端：export（由后端内嵌图片）----
  function doExport(){
    const url = (inputUrl.value || '').trim();
    if (!url){
      showStat('请先输入目录页链接。', false);
      return;
    }
    const base = API_BASE || '';
    const endpoint = `${base}/v1/api/catalog/export?url=${encodeURIComponent(url)}&limit=${encodeURIComponent(limitSel.value)}`;

    // 采用“打开下载链接”的方式，让浏览器直接下载文件
    const a = document.createElement('a');
    a.href = endpoint;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- 清空 ----
  function doClear(){
    inputUrl.value = '';
    tbody.innerHTML = '';
    holder.style.display = '';
    tableWrap.style.display = 'none';
    showStat('已清空。');
  }

  // ---- 按钮绑定 ----
  btnFetch.addEventListener('click', doFetch);
  btnExportT.addEventListener('click', doExport);
  btnExportB.addEventListener('click', doExport);
  btnClear.addEventListener('click', doClear);

  // 回车触发抓取
  inputUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doFetch();
  });

  // 语言按钮（占位）
  document.querySelectorAll('[data-lang]').forEach(b=>{
    b.addEventListener('click', ()=> alert('多语言切换占位功能'));
  });

  // 初始：如果地址栏自带 ?api=… 仅显示绿色提示
  showStat('部署已就绪：可输入链接抓取；导出按钮会从后端生成内嵌图片的 Excel。', true);
})();
