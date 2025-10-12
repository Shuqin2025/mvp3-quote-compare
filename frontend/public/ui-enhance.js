/**
 * feature/restore - ui-enhance.js
 * - 读取 ?api=<gatewayBase>，例如 ?api=https://yunivera-gateway.onrender.com
 * - 目录抓取：/v1/api/catalog/parse?url=...&limit=...&img=base64&imgCount=...
 * - 图片兜底：/v1/api/image64?url=...  -> { ok:true, base64:"data:image/...;base64,..." }
 * - Excel 导出自动嵌入图片（优先 dataURL，再次 /image64）
 */
(() => {
  /** ------------ tiny DOM helpers ------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** ------------ config ------------ */
  const API_BASE =
    new URLSearchParams(location.search).get("api") ||
    (window.__API_BASE || "").trim() ||
    ""; // 建议用 ?api=https://yunivera-gateway.onrender.com
  window.__debugApiBase = API_BASE;

  /** ------------ 获取页面已有元素（与你现在的页面兼容） ------------ */
  const els = {
    url:
      $("#input-url") ||
      $("#url") ||
      $("input[type=text]") ||
      $("input"),
    btnFetch: $("#btn-fetch") || $("#fetch") || $("[data-action='fetch']"),
    btnExport: $("#btnExport") || $("#btn-export") || $("[data-action='export']"),
    btnClear: $("#btnClear") || $("#btn-clear") || $("[data-action='clear']"),
    selectLimit: $("#sel-limit") || $("select"),
    tableBody: $("#mvp3-table tbody") || $("table tbody"),
    tip: $("#js-tip"),
    tipExport: $("#js-export-tip"),
  };

  /** ------------ 状态 ------------ */
  let currentData = [];

  /** ------------ 工具 ------------ */
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

  /** ------------ 渲染到表格 ------------ */
  function renderTable(items) {
    currentData = items.map((x, i) => ({
      idx: i + 1,
      sku: normalizeSku(x),
      title: (x.title ?? "").toString().trim() || "—",
      url: x.url || "",
      img: x.img_b64 || x.img || "", // 优先 dataURL
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

  /** ------------ 目录抓取（带图转 base64） ------------ */
  async function fetchCatalog() {
    try {
      const url = (els.url?.value || "").trim();
      if (!API_BASE) throw new Error("未指定 API 网关，请在地址栏带上 ?api=...");
      if (!url) throw new Error("请输入列表页链接");
      const limit = parseInt(els.selectLimit?.value || "50", 10) || 50;

      // 关键：让后端直接把前 limit 张图转成 base64 返回（字段 img_b64）
      const ep = `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(
        url
      )}&limit=${limit}&img=base64&imgCount=${limit}`;

      console.log("[fetchCatalog] GET", ep);
      const r = await fetch(ep, { method: "GET", mode: "cors" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      // 兼容两种字段：items / products
      const list = Array.isArray(j?.items) && j.items.length
        ? j.items
        : Array.isArray(j?.products) ? j.products : [];

      if (!Array.isArray(list)) {
        console.error("响应原文:", j);
        throw new Error("响应格式不正确：items/products 不是数组。");
      }

      renderTable(list);
      if (els.tip) {
        els.tip.textContent = `抓取成功：共 ${list.length} 条（预览前 ${Math.min(
          list.length,
          limit
        )} 条）`;
        els.tip.style.display = "block";
      }
    } catch (err) {
      console.error("[fetchCatalog] error", err);
      alert("抓取失败：" + (err?.message || err));
    }
  }

  /** ------------ Excel 导出（嵌入图片） ------------ */
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

    async function fetchB64ViaServer(imgUrl) {
      if (!imgUrl) throw new Error("empty url");
      const ep = `${API_BASE}/v1/api/image64?url=${encodeURIComponent(imgUrl)}`;
      console.log("[image64] GET", ep);
      const r = await fetch(ep, { method: "GET", mode: "cors" });
      if (!r.ok) throw new Error(`image64 HTTP ${r.status}`);
      const j = await r.json();
      if (!j?.base64) throw new Error("no base64");
      const parsed = parseDataUrl(j.base64);
      if (!parsed) throw new Error("bad base64");
      return parsed;
    }

    for (const meta of rowsMeta) {
      try {
        let base64DataUrl, ext;

        // 1) 优先：当前 img 已经是 dataURL（img_b64）
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
        ws.addImage(imgId, {
          tl: { col: 1, row: meta.excelRow - 1 }, // 第二列（0-based col=1）
          ext: { width: 150, height: 78 },
        });
      } catch (e) {
        console.warn("embed image failed:", e);
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `catalog-${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
    if (els.tipExport) els.tipExport.style.display = "block";
  }

  /** ------------ 清空 ------------ */
  function clearAll() {
    currentData = [];
    if (els.tableBody) els.tableBody.innerHTML = "";
    if (els.tip) els.tip.style.display = "none";
    if (els.tipExport) els.tipExport.style.display = "none";
  }

  /** ------------ 事件绑定 ------------ */
  els.btnFetch && els.btnFetch.addEventListener("click", fetchCatalog);
  els.btnExport && els.btnExport.addEventListener("click", exportExcel);
  els.btnClear && els.btnClear.addEventListener("click", clearAll);
  els.url && els.url.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fetchCatalog();
  });

  // 便于你在控制台手动试
  window.mvp3FetchTest = fetchCatalog;
})();
