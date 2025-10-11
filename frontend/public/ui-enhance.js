/**
 * feature/restore - ui-enhance.js
 * - 支持 ?api=<gatewayBase> 指定网关根，例如 ?api=https://yunivera-gateway.onrender.com
 * - 抓取：/v1/api/catalog/parse?url=...&limit=...&img=base64&imgCount=...
 * - 图片兜底：/v1/api/image64?url=... -> { ok:true, base64:"data:image/...;base64,..." }
 * - Excel 导出（ExcelJS）自动嵌入图片（dataURL 或 /image64 兜底）
 */
(() => {
  /** ------------ tiny DOM helpers ------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** ------------ config ------------ */
  const API_BASE =
    new URLSearchParams(location.search).get("api") ||
    (window.__API_BASE || "").trim() ||
    ""; // 建议页面带上 ?api=https://yunivera-gateway.onrender.com

  /** ------------ skeleton（若已有 UI，可忽略） ------------ */
  function ensureLayout() {
    if ($("#mvp3-shell")) return;
    const root = $("#root") || document.body;
    const wrap = document.createElement("div");
    wrap.id = "mvp3-shell";
    wrap.innerHTML = `
      <div class="container">
        <div style="display:flex;gap:8px;margin:6px 0 12px">
          <button class="btn">中文</button><button class="btn">DE</button><button class="btn">EN</button>
        </div>
        <h1 style="margin:8px 0 4px;font-size:24px;font-weight:700">云贸星 智能表格生成器</h1>
        <div style="color:#6b7280;margin-bottom:8px">输入目录型网页链接，秒生成 Excel 产品表格。</div>
        <div class="tool-row" style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
          <input id="input-url" class="url-input" placeholder="粘贴目录页链接（类目/列表页）" />
          <button id="btn-fetch" class="btn primary">抓取目录</button>
          <select id="sel-limit" class="btn"><option>50</option><option>100</option><option>200</option></select>
          <button id="btn-export" class="btn">导出 Excel（.xlsx）</button>
          <button id="btn-clear" class="btn">清空数据</button>
        </div>
        <div class="alert alert-amber" id="js-tip" style="display:none"></div>
        <div class="alert alert-green" id="js-export-tip" style="display:none">已导出 Excel（含图片）。</div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px">
          <table class="grid" style="width:100%;border-collapse:collapse" id="mvp3-table">
            <thead><tr>
              <th style="width:48px">#</th>
              <th style="width:140px">Item No.</th>
              <th style="width:160px">Picture</th>
              <th>Description</th>
              <th style="width:100px">MOQ</th>
              <th style="width:120px">Unit Price</th>
              <th style="width:100px">Link</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;
    root.appendChild(wrap);
  }
  ensureLayout();

  /** ------------ refs ------------ */
  const els = {
    url: $("#input-url") || $("input[type=text]") || $("input"),
    btnFetch: $("#btn-fetch"),
    btnExport: $("#btn-export"),
    btnClear: $("#btn-clear"),
    selectLimit: $("#sel-limit") || $("select"),
    tableBody: $("#mvp3-table tbody") || $("table tbody"),
    tip: $("#js-tip"),
    tipExport: $("#js-export-tip"),
  };

  /** ------------ state ------------ */
  let currentData = [];

  /** ------------ utils ------------ */
  const priceOrPlaceholder = (p) =>
    !p || (typeof p === "string" && !p.trim()) ? "€ 0,00" : p;
  const isCodeLike = (s) => /^\s*\d+(?:-\d+)*\s*$/.test(String(s || ""));
  const idFromUrl = (u = "") => {
    const m = /,(\d+)\.html(?:[?#].*)?$/i.exec(u);
    return m ? m[1] : "";
  };
  const normalizeSku = (item) => {
    const sku = (item.sku ?? "").toString().trim();
    if (isCodeLike(sku)) return sku;
    const fromUrl = idFromUrl(item.url || "");
    if (isCodeLike(fromUrl)) return fromUrl;
    return "";
  };

  /** ------------ 渲染 ------------ */
  function renderTable(items) {
    currentData = items.map((x, i) => ({
      idx: i + 1,
      sku: normalizeSku(x),
      title: (x.title ?? "").toString().trim() || "—",
      url: x.url || "",
      // 优先使用后端返回的 img_b64（dataURL），否则用原链接
      img: x.img_b64 || x.img || "",
      price: priceOrPlaceholder(x.price),
      moq: (x.moq ?? "").toString().trim() || "—",
    }));

    const tbody = els.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    for (const row of currentData) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.idx}</td>
        <td>${row.sku || "—"}</td>
        <td><img src="${row.img}" style="height:54px;max-width:92px;object-fit:contain;border-radius:4px;background:#fff"/></td>
        <td>${row.title}</td>
        <td>${row.moq}</td>
        <td>${row.price}</td>
        <td>${row.url ? `<a href="${row.url}" target="_blank" rel="noreferrer">链接</a>` : ""}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  /** ------------ 调用后端：parse ------------ */
  async function parseCatalog(url, limit) {
    // 首选你最新的路由：/v1/api/catalog/parse
    const endpoints = [
      `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(
        url
      )}&limit=${limit}`,
      // 兜底兼容：/v1/api/parse
      `${API_BASE}/v1/api/parse?url=${encodeURIComponent(url)}&limit=${limit}`,
    ];

    let lastErr;
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, { method: "GET", mode: "cors" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const list = Array.isArray(j?.items) && j.items.length
          ? j.items
          : Array.isArray(j?.products) ? j.products : [];
        if (Array.isArray(list)) return list;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("parse failed");
  }

  /** ------------ 动作：抓取目录（带图转 base64） ------------ */
  async function fetchCatalog() {
    try {
      const url = (els.url?.value || "").trim();
      if (!url) return;
      const limit = parseInt(els.selectLimit?.value || "50", 10) || 50;

      // 关键：让后端把前 limit 张图直接转 base64 带回来 -> img_b64
      const ep = `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(
        url
      )}&limit=${limit}&img=base64&imgCount=${limit}`;

      const r = await fetch(ep, { method: "GET", mode: "cors" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const list = Array.isArray(j?.items) && j.items.length
        ? j.items
        : Array.isArray(j?.products) ? j.products : [];
      if (!Array.isArray(list)) throw new Error("响应格式不正确：items 不是数组。");

      renderTable(list);
      if (els.tip) {
        els.tip.textContent = `抓取成功：共 ${list.length} 条（预览前 ${Math.min(
          list.length,
          limit
        )} 条）`;
        els.tip.style.display = "block";
      }
    } catch (err) {
      console.error("[fetchCatalog]", err);
      alert("抓取失败：" + (err?.message || err));
    }
  }

  /** ------------ 动作：导出 Excel（嵌入图片） ------------ */
  async function exportExcel() {
    if (!window.ExcelJS) {
      alert("ExcelJS 未加载");
      return;
    }
    const ExcelJS = window.ExcelJS;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Catalog");

    ws.columns = [
      { header: "Item No.", key: "sku", width: 18 },
      { header: "Picture", key: "pic", width: 22 },
      { header: "Description", key: "title", width: 60 },
      { header: "MOQ", key: "moq", width: 10 },
      { header: "Unit Price", key: "price", width: 14 },
      { header: "Link", key: "link", width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    const rowsMeta = [];
    for (const row of currentData) {
      const r = ws.addRow({
        sku: row.sku || "",
        pic: "",
        title: row.title,
        moq: row.moq,
        price: row.price,
        link: row.url ? { text: "链接", hyperlink: row.url } : "",
      });
      r.height = 78;
      rowsMeta.push({ excelRow: r.number, img: row.img });
    }

    // 解析 dataURL
    const parseDataUrl = (dataURL) => {
      const m =
        /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(
          dataURL || ""
        );
      if (!m) return null;
      const ct = m[1].toLowerCase();
      let ext = "jpeg";
      if (ct.includes("png")) ext = "png";
      else if (ct.includes("webp")) ext = "webp";
      else if (ct.includes("gif")) ext = "gif";
      else if (ct.includes("bmp")) ext = "bmp";
      return { base64: `data:${ct};base64,${m[2]}`, ext };
    };

    // 调网关拿 base64 兜底
    async function fetchB64ViaServer(imgUrl) {
      const ep = `${API_BASE}/v1/api/image64?url=${encodeURIComponent(imgUrl)}`;
      const r = await fetch(ep, { method: "GET", mode: "cors" });
      if (!r.ok) throw new Error(`image64 HTTP ${r.status}`);
      const j = await r.json();
      if (!j?.base64) throw new Error("no base64");
      const parsed = parseDataUrl(j.base64);
      if (!parsed) throw new Error("bad base64");
      return parsed;
    }

    // 串行嵌入，保证稳定
    for (const meta of rowsMeta) {
      try {
        let base64DataUrl, ext;

        // 1) 优先：如果当前 img 已经是 dataURL
        const parsedFromData = parseDataUrl(meta.img);
        if (parsedFromData) {
          base64DataUrl = parsedFromData.base64;
          ext = parsedFromData.ext;
        }

        // 2) 否则：通过 /image64 兜底
        if (!base64DataUrl && meta.img) {
          const parsed = await fetchB64ViaServer(meta.img);
          base64DataUrl = parsed.base64;
          ext = parsed.ext;
        }

        if (!base64DataUrl) continue;

        const imgId = wb.addImage({ base64: base64DataUrl, extension: ext });
        const rowIdx0 = meta.excelRow - 1; // 0-based
        ws.addImage(imgId, {
          tl: { col: 1, row: rowIdx0 }, // B 列放图
          ext: { width: 120, height: 70 },
          editAs: "oneCell",
        });
      } catch (e) {
        console.warn("[xlsx] embed image failed:", meta.img, e?.message || e);
      }
    }

    const filename = `catalog-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${Date.now()}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();

    if (els.tipExport) els.tipExport.style.display = "block";
  }

  /** ------------ 动作：清空 ------------ */
  function clearData() {
    currentData = [];
    if (els.tableBody) els.tableBody.innerHTML = "";
    if (els.tip) {
      els.tip.textContent = "已清空";
      els.tip.style.display = "block";
    }
  }

  /** ------------ 事件绑定 ------------ */
  els?.btnFetch?.addEventListener("click", fetchCatalog);
  els?.btnExport?.addEventListener("click", exportExcel);
  els?.btnClear?.addEventListener("click", clearData);
  els?.url?.addEventListener?.("keydown", (e) => {
    if (e.key === "Enter") fetchCatalog();
  });

  // 健康检查（不阻塞）
  (async () => {
    try {
      if (API_BASE) await fetch(`${API_BASE}/v1/api/health`, { mode: "cors" });
    } catch {}
  })();
})();
