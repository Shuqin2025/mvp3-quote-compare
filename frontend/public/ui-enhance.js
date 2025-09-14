/* public/ui-enhance.js —— 直接覆盖即可 */

(() => {
  // ---------- 小工具 ----------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const el = (tag, attrs = {}) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

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

  // ---------- 页面标题 & 自有容器 ----------
  function ensureHeader() {
    if (!$("#mvp3-title")) {
      const h = el("h1", { id: "mvp3-title" });
      h.textContent = "云贸星 智能表格生成器";
      h.style.cssText = "font:600 22px/1.4 system-ui,Arial; margin:10px 0 6px;";
      document.body.insertBefore(h, document.body.firstChild);
    }
  }
  let root = null, toastEl = null, tbody = null;
  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    root = el("div", { id: "mvp3-root" });
    root.style.cssText = "margin:8px 0 24px;";
    document.body.appendChild(root);
    return root;
  }

  function toast(type, msg) {
    if (!toastEl) {
      toastEl = el("div", { id:"mvp3-toast" });
      toastEl.style.cssText = "display:none;margin:10px 0;padding:8px 12px;border-left:4px solid #0ea5e9;background:#f0f9ff;border-radius:6px;";
      ensureRoot().prepend(toastEl);
    }
    toastEl.style.display = "block";
    toastEl.style.borderLeftColor = type === "ok" ? "#10b981" : "#f59e0b";
    toastEl.textContent = msg;
  }

  // ---------- 工具栏 ----------
  function ensureToolbar() {
    const barId = "mvp3-toolbar";
    if ($("#"+barId)) return;
    const bar = el("div", { id: barId });
    bar.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;";

    const input = el("input", { id:"mvp3-url", placeholder:"输入目录型网页链接", type:"text" });
    input.style.cssText = "flex:1;min-width:360px;padding:8px;border:1px solid #ccc;border-radius:6px;";
    bar.appendChild(input);

    const btnFetch = el("button", { id:"btnFetch", type:"button" });
    btnFetch.className = "btn primary";
    btnFetch.textContent = "抓取目录";
    btnFetch.style.cssText = "padding:8px 12px;border:1px solid #2f6fed;background:#2f6fed;color:#fff;border-radius:6px;cursor:pointer;";
    bar.appendChild(btnFetch);

    const sel = el("select", { id:"pageSize" });
    sel.innerHTML = `<option>50</option><option>100</option><option>150</option>`;
    sel.style.cssText = "padding:6px;border:1px solid #ccc;border-radius:6px;";
    bar.appendChild(sel);

    const btnXlsx = el("button", { id:"btnExport", type:"button" });
    btnXlsx.textContent = "导出 Excel（.xlsx）";
    btnXlsx.style.cssText = "padding:8px 12px;border:1px solid #888;background:#fff;border-radius:6px;cursor:pointer;";
    bar.appendChild(btnXlsx);

    const btnClear = el("button", { id:"btnClear", type:"button" });
    btnClear.textContent = "清空数据";
    btnClear.style.cssText = "margin-left:auto;padding:8px 12px;border:1px solid #bbb;background:#fafafa;border-radius:6px;cursor:pointer;";
    bar.appendChild(btnClear);

    ensureRoot().appendChild(bar);

    btnFetch.addEventListener("click", fetchCatalog);
    btnXlsx.addEventListener("click", exportExcel);
    btnClear.addEventListener("click", clearData);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") fetchCatalog(); });

    // 尝试从宿主页面找输入框初值
    const hostInput = document.querySelector("input[placeholder*='目录'], textarea");
    if (hostInput && hostInput.value) input.value = hostInput.value;
  }

  // ---------- 表格 ----------
  function ensureTable() {
    if (!$("#mvp3-table")) {
      const table = el("table", { id:"mvp3-table" });
      table.style.cssText = "width:100%;border-collapse:collapse;background:#fff;font-size:14px;table-layout:fixed;border:1px solid #eee;";
      const thead = el("thead");
      thead.innerHTML = `
        <tr style="text-align:left;border-bottom:1px solid #eee;background:#fafafa">
          <th style="padding:8px;width:48px">#</th>
          <th style="padding:8px;width:160px">Item No.</th>
          <th style="padding:8px;width:72px">Picture</th>
          <th style="padding:8px">Description</th>
          <th style="padding:8px;width:120px">MOQ</th>
          <th style="padding:8px;width:140px">Unit Price</th>
          <th style="padding:8px;width:90px">Link</th>
        </tr>`;
      tbody = el("tbody");
      table.appendChild(thead); table.appendChild(tbody);
      ensureRoot().appendChild(table);
    }
  }

  function render(items) {
    ensureTable();
    if (!Array.isArray(items) || !items.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:12px;color:#999">No data</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map((it, i) => {
      const sku   = it.sku ?? it.itemNo ?? it.code ?? "";
      const title = it.title ?? it.name ?? "";
      const price = it.price ?? "";
      const moq   = it.moq ?? "";
      const img   = it.img ? `<img src="${it.img}" alt="" loading="lazy"
                      style="width:54px;height:54px;object-fit:cover;border:1px solid #eee;border-radius:4px;" />` : "";
      const link  = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">链接</a>` : "";
      return `
        <tr style="border-bottom:1px dashed #eee">
          <td style="padding:8px">${i + 1}</td>
          <td style="padding:8px;word-break:break-all">${sku}</td>
          <td style="padding:8px">${img}</td>
          <td style="padding:8px;word-break:break-word">${title}</td>
          <td style="padding:8px">${moq || "—"}</td>
          <td style="padding:8px">${price || "—"}</td>
          <td style="padding:8px">${link}</td>
        </tr>`;
    }).join("");
  }

  function clearData() {
    state.items = [];
    ensureTable();
    tbody.innerHTML = `<tr><td colspan="7" style="padding:12px;color:#999">No data</td></tr>`;
    if (toastEl) toastEl.style.display = "none";
  }

  // ---------- 健康探测（可忽略失败，不阻塞） ----------
  async function probeHealth(api) {
    const lst = ["/api/health","/health","/api/healthz","/healthz"];
    for (const p of lst) {
      try {
        const r = await fetch(api.replace(/\/$/,"") + p);
        if (r.ok) return true;
      } catch {}
    }
    return false;
  }

  // ---------- 抓取（默认 enrich=true 以便补“价格/MOQ”） ----------
  async function fetchCatalog() {
    try {
      const api = getApiBase();
      if (!api) return toast("fail", "缺少 ?api= 后端地址");

      const input = $("#mvp3-url") || document.querySelector("input,textarea");
      const raw  = (input && (input.value || input.textContent) || "").trim();
      if (!raw)  return toast("fail", "请输入目录/列表页链接");

      // 如果粘贴的是 “?url=xxx” 的外层链接，提取真正的 url
      let targetUrl = raw;
      try { const u = new URL(raw); const u2 = u.searchParams.get("url"); if (u2) targetUrl = decodeURIComponent(u2); } catch {}

      probeHealth(api); // 异步探测，不影响主流程

      const limit = parseInt(($("#pageSize")?.value) || "50", 10) || 50;
      toast("ok", "正在抓取中…");

      const url = `${api}/v1/api/catalog/parse?url=${encodeURIComponent(targetUrl)}&limit=${limit}&enrich=true`;
      const res = await fetch(url);
      if (!res.ok) { clearData(); return toast("fail", `抓取失败：HTTP ${res.status}`); }

      const data = await res.json().catch(() => ({}));
      if (!data || data.ok === false) { clearData(); return toast("fail", data?.message || data?.error || "抓取失败"); }

      state.items = data.products || data.items || [];
      render(state.items);
      toast("ok", `抓取成功：共 ${state.items.length} 条（预览前 ${Math.min(state.items.length, limit)} 条）`);
    } catch (e) {
      console.error(e);
      clearData();
      toast("fail", e.message || String(e));
    }
  }

  // ---------- 导出（优先 ExcelJS 含图片；无 ExcelJS 回退 .xls） ----------
  async function exportExcel() {
    if (!state.items || state.items.length === 0) return toast("fail","没有可导出的数据");
    if (typeof ExcelJS === "undefined") return exportHtmlAsXls();

    try {
      const api = getApiBase();
      const wb  = new ExcelJS.Workbook();
      const ws  = wb.addWorksheet("Catalog", { properties:{ defaultRowHeight: 60 } });

      ws.columns = [
        { header: "Item No.",   key: "sku",   width: 16 },
        { header: "Picture",    key: "img",   width: 12 },
        { header: "Description",key: "title", width: 60 },
        { header: "MOQ",        key: "moq",   width: 10 },
        { header: "Unit Price", key: "price", width: 14 },
        { header: "Link",       key: "url",   width: 42 },
      ];

      // 行数据
      state.items.forEach((it) => {
        ws.addRow({
          sku:   it.sku ?? it.itemNo ?? it.code ?? "",
          img:   "", // 图片稍后插入
          title: it.title ?? it.name ?? "",
          moq:   it.moq ?? "",
          price: it.price ?? "",
          url:   it.url ?? "",
        });
      });

      // 超链接
      for (let i = 0; i < state.items.length; i++) {
        const rowIdx = i + 2; // 1 是表头
        const url = state.items[i].url || "";
        if (url) ws.getCell(rowIdx, 6).value = { text: "链接", hyperlink: url };
        ws.getRow(rowIdx).height = 60;
      }

      // 插入图片（通过你的图片代理）
      const toBase64 = (buf) => {
        const b = new Uint8Array(buf);
        let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
        return btoa(s);
      };
      const extFrom = (ct, url) => {
        if (/png/i.test(ct) || /\.png(\?|$)/i.test(url)) return "png";
        return "jpeg";
      };

      for (let i = 0; i < state.items.length; i++) {
        const it = state.items[i];
        if (!it.img) continue;

        try {
          const proxied = `${api}/v1/api/image?url=${encodeURIComponent(it.img)}`;
          const r = await fetch(proxied);
          if (!r.ok) continue;
          const ab  = await r.arrayBuffer();
          const ct  = r.headers.get("content-type") || "";
          const ext = extFrom(ct, it.img);
          const base64 = toBase64(ab);
          const imageId = wb.addImage({ base64: `data:image/${ext};base64,${base64}`, extension: ext });

          // 图片放在第 2 列（B 列）
          ws.addImage(imageId, {
            tl:  { col: 1, row: i + 1 },     // 从 0 开始计；第 2 列、第 (i+2) 行 -> (1, i+1)
            ext: { width: 56, height: 56 },
          });
        } catch {}
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = el("a", { download: `catalog-preview-${new Date().toISOString().slice(0,10)}-${Date.now()}.xlsx` });
      a.href = URL.createObjectURL(blob);
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);

      toast("ok", "已导出 Excel（含图片）");
    } catch (e) {
      console.error(e);
      toast("fail", "ExcelJS 导出失败，回退为 .xls");
      exportHtmlAsXls();
    }
  }

  // 回退：把 HTML 表格保存为 .xls（不含图片）
  function exportHtmlAsXls() {
    const table = $("#mvp3-table");
    if (!table) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const a = el("a", { download: `catalog-${Date.now()}.xls` });
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  // ---------- 启动 ----------
  function start() {
    ensureHeader();
    ensureRoot();
    ensureToolbar();
    ensureTable();
    tbody.innerHTML = `<tr><td colspan="7" style="padding:12px;color:#999">ui.no_data</td></tr>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

