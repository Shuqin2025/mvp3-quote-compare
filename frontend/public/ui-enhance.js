/**
 * ui-enhance.js — 前端增强脚本（完整替换版）
 * 版本：2025-11-04-1
 *
 * 关键能力：
 *  - “抓取目录”按钮防重复点击、完成后自动滚动到表格顶部；
 *  - 解析 ?api= 的后端网关地址，所有请求统一走该网关；
 *  - 目录解析使用 GET /v1/api/catalog/parse?url=...（避免 CORS 预检）；
 *  - 传入 t= 站点类型提示（自动猜，也支持后端 /detect 回退）；
 *  - 表格图片优先直链，失败自动切换到网关图片代理 /v1/api/image?format=raw；
 *  - 导出 Excel（ExcelJS）：内嵌前 200 张图片（失败回退 URL 文本）；
 *  - 兼容 rows / data / list / items / products 多字段；
 *  - 链接列显示为“🔗 链接”按钮；
 *  - <img loading="lazy" decoding="async" referrerPolicy="no-referrer">；
 *
 * ⚠️ 页面请确保用版本号绕过缓存：
 *    <script type="module" src="/ui-enhance.js?v=2025-11-04-1"></script>
 */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getApiBase() {
    try {
      const u = new URL(location.href);
      const api = u.searchParams.get("api");
      return (api || "").replace(/\/+$/, "");
    } catch {
      return "";
    }
  }
  const API_BASE = getApiBase();
  console.info("[UI] API_BASE =", API_BASE || "(empty)");

  const els = {
    urlInput:
      $("#txtUrl") ||
      $("#url") ||
      $('input[type="url"], input[name="url"]') ||
      $("input"),
    btnFetch:
      $("#btnFetch") ||
      $$(".btn").find((b) => /抓取|Fetch|采集/i.test(b?.textContent || "")),
    selectLimit: $("#selLimit") || $("#pageSize") || $("select"),
    btnExport:
      $("#btnExport") ||
      $$(".btn").find((b) => /导出|Export/i.test(b?.textContent || "")),
    btnClear: $("#btnClear") || $$(".btn").find((b) => /清空|Clear/i.test(b?.textContent || "")),
    toast: $("#status") || $("#okbar") || $(".alert") || $(".msg") || null,
    table: $("#tbl") || $("table"),
    thead: $("#tbl thead") || $("table thead") || $("thead"),
    tbody: $("#tbl tbody") || $("table tbody") || $("tbody"),
  };

  function setToast(msg, ok = true) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.style.display = "block";
    els.toast.style.background = ok ? "#fff8e1" : "#ffecec";
    els.toast.style.color = ok ? "#333" : "#b00020";
  }

  function clearTable() {
    if (els.tbody) els.tbody.innerHTML = "";
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function guessAdapterFromUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.toLowerCase();
      if (/(^|\.)memoryking\.de$/.test(host)) return "memoryking";
      if (/s-impuls-shop\.de$/.test(host)) return "generic-cards";
      if (host.endsWith("myshopify.com") || path.includes("/collections/")) return "shopify";
      if (path.includes("/product-category/") || path.startsWith("/shop/")) return "woocommerce";
      if (path.includes("/catalog/")) return "magento";
      return "";
    } catch {
      return "";
    }
  }

  async function detectTypeByApi(url) {
    if (!API_BASE) return "";
    try {
      const resp = await fetch(`${API_BASE}/v1/api/detect?url=${encodeURIComponent(url)}`, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-cache",
      });
      if (!resp.ok) return "";
      const j = await resp.json();
      return (j && j.ok && j.type) ? j.type : "";
    } catch {
      return "";
    }
  }

  async function parseCatalog(url, limit, hintT) {
    const qs = new URLSearchParams();
    qs.set("url", url);
    if (limit) qs.set("limit", String(limit));
    qs.set("imgCount", "2");
    qs.set("compare", "1");
    qs.set("detailSkuMax", "8");
    if (hintT) qs.set("t", hintT);

    const finalUrl = `${API_BASE}/v1/api/catalog/parse?${qs.toString()}`;
    console.info("[UI] GET", finalUrl);

    const resp = await fetch(finalUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-cache",
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  }

  function pickArray(data) {
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.products)) return data.products;
    return [];
  }

  function toAbs(u, base) {
    if (!u) return "";
    try { return new URL(u, base).href; } catch { return u; }
  }

  let lastRows = [];

  function normalizeRows(rawData) {
    const base = (els.urlInput?.value || "").trim();
    const arr = pickArray(rawData);
    return arr.map((p) => {
      const link = toAbs(p.link || p.url || "", base);
      const imgCandidate = p.img || (Array.isArray(p.imgs) ? p.imgs[0] : "") || p.image || p.thumb || "";
      return {
        sku: p.sku || p.code || p.id || "",
        title: p.title || p.name || p.desc || "",
        img: toAbs(imgCandidate, base),
        moq: p.moq || "",
        price: p.price || "",
        currency: p.currency || "",
        link,
      };
    });
  }

  function renderRows(rows) {
    lastRows = rows || [];
    clearTable();
    if (!els.tbody || !Array.isArray(rows) || rows.length === 0) return;

    const frag = document.createDocumentFragment();

    rows.forEach((r, i) => {
      const tr = document.createElement("tr");

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(i + 1);
      tr.appendChild(tdIdx);

      const tdSku = document.createElement("td");
      tdSku.textContent = r.sku || "—";
      tr.appendChild(tdSku);

      const tdImg = document.createElement("td");
      if (r.img) {
        const img = document.createElement("img");
        const srcRaw = r.img;
        const viaProxy = API_BASE
          ? `${API_BASE}/v1/api/image?format=raw&url=${encodeURIComponent(srcRaw)}`
          : srcRaw;
        const needProxy = /loader\.svg|placeholder/i.test(srcRaw);
        img.src = needProxy ? viaProxy : srcRaw;
        img.onerror = () => { if (img.src !== viaProxy) img.src = viaProxy; };
        img.alt = r.title || "";
        img.referrerPolicy = "no-referrer";
        img.loading = "lazy";
        img.decoding = "async";
        img.style.maxWidth = "80px";
        img.style.maxHeight = "80px";
        tdImg.appendChild(img);
      } else {
        tdImg.textContent = "—";
      }
      tr.appendChild(tdImg);

      const tdTitle = document.createElement("td");
      tdTitle.textContent = r.title || "—";
      tr.appendChild(tdTitle);

      const tdMoq = document.createElement("td");
      tdMoq.textContent = r.moq || "—";
      tr.appendChild(tdMoq);

      const tdPrice = document.createElement("td");
      tdPrice.textContent = r.price ? r.price : "—";
      tr.appendChild(tdPrice);

      const tdLink = document.createElement("td");
      if (r.link) {
        const a = document.createElement("a");
        a.href = r.link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "🔗 链接";
        a.title = "打开商品页";
        a.style.textDecoration = "none";
        a.style.padding = "4px 8px";
        a.style.border = "1px solid #ddd";
        a.style.borderRadius = "6px";
        a.style.fontSize = "12px";
        tdLink.appendChild(a);
      } else {
        tdLink.textContent = "—";
      }
      tr.appendChild(tdLink);

      frag.appendChild(tr);
    });

    els.tbody.appendChild(frag);
  }

  async function exportExcel() {
    try {
      if (!lastRows.length) {
        setToast("没有可导出的数据", false);
        return;
      }
      if (!window.ExcelJS) {
        setToast("找不到 ExcelJS，回退为 CSV", false);
        exportCsvFallback(lastRows);
        return;
      }

      setToast("正在生成 Excel（内嵌图片，前 200 张）…");
      const ExcelJS = window.ExcelJS;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Catalog");

      const header = ["#", "货号", "图片", "描述", "起订量", "单价", "链接"];
      ws.addRow(header);

      lastRows.forEach((r, i) => {
        const row = ws.addRow([
          i + 1,
          r.sku || "",
          r.img || "",
          r.title || "",
          r.moq || "",
          r.price || "",
          r.link || "",
        ]);
        row.height = 80;
      });

      const limit = Math.min(lastRows.length, 200);
      for (let i = 0; i < limit; i++) {
        const imgUrl = lastRows[i]?.img;
        if (!imgUrl) continue;
        try {
          const realUrl = /^(?:https?:)?\/\/.+/.test(imgUrl) ? imgUrl : new URL(imgUrl, location.href).href;
          const proxied = API_BASE ? `${API_BASE}/v1/api/image?format=raw&url=${encodeURIComponent(realUrl)}` : realUrl;
          const buf = await (await fetch(proxied, { mode: "cors", credentials: "omit", cache: "no-cache" })).arrayBuffer();
          const bytes = new Uint8Array(buf);
          const ext = /\.png(?:$|\?)/i.test(realUrl) ? "png" : "jpeg";
          const imgId = wb.addImage({ buffer: bytes, extension: ext });
          ws.addImage(imgId, { tl: { col: 2, row: i + 1 }, br: { col: 3, row: i + 2 } });
        } catch (e) {
          console.warn("embed image failed", i, e);
        }
      }

      ws.columns = [
        { width: 4 },
        { width: 14 },
        { width: 12 },
        { width: 70 },
        { width: 8 },
        { width: 12 },
        { width: 12 },
      ];

      const blob = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.download = `catalog_${Date.now()}.xlsx`;
      a.href = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      a.click();
      URL.revokeObjectURL(a.href);
      setToast("Excel 导出成功（前 200 张图片已内嵌）");
    } catch (err) {
      console.error(err);
      setToast("Excel 导出失败，已回退 CSV", false);
      exportCsvFallback(lastRows);
    }
  }

  function exportCsvFallback(rows) {
    const header = ["#", "货号", "图片", "描述", "起订量", "单价", "链接"];
    const lines = [header.join(",")];
    rows.forEach((r, i) => {
      const one = [
        i + 1,
        (r.sku || "").replace(/,/g, " "),
        (r.img || "").replace(/,/g, " "),
        (r.title || "").replace(/,/g, " "),
        (r.moq || "").replace(/,/g, " "),
        (r.price || "").replace(/,/g, " "),
        (r.link || "").replace(/,/g, " "),
      ];
      lines.push(one.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.download = `catalog_${Date.now()}.csv`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFetchClick() {
    try {
      const url = (els.urlInput?.value || "").trim();
      if (!url) return;
      if (!API_BASE) {
        setToast("未发现 API 网关 (?api=...)，无法抓取", false);
        return;
      }
      if (els.btnFetch) {
        els.btnFetch.disabled = true;
        const old = els.btnFetch.textContent;
        els.btnFetch.dataset.oldText = old || "";
        els.btnFetch.textContent = "抓取中…";
      }
      clearTable();
      setToast("正在抓取目录…");

      let t = guessAdapterFromUrl(url);
      if (!t) t = await detectTypeByApi(url);

      const limit = parseInt(els.selectLimit?.value || "50", 10) || 50;
      const raw = await parseCatalog(url, limit, t);
      const rows = normalizeRows(raw);
      renderRows(rows);
      setToast(`抓取成功：共 ${rows.length} 条（来源：${raw?.source || t || "auto"}）`);

      await delay(50);
      els.table?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error(err);
      setToast(`抓取失败：${err?.message || err}`, false);
    } finally {
      if (els.btnFetch) {
        els.btnFetch.disabled = false;
        if (els.btnFetch.dataset.oldText) els.btnFetch.textContent = els.btnFetch.dataset.oldText;
      }
    }
  }

  function onClear() {
    clearTable();
    setToast("已清空");
  }

  function init() {
    if (els.btnFetch) els.btnFetch.addEventListener("click", onFetchClick);
    if (els.btnExport) els.btnExport.addEventListener("click", exportExcel);
    if (els.btnClear) els.btnClear.addEventListener("click", onClear);

    if (!window.ExcelJS) {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js";
      s.defer = true;
      document.head.appendChild(s);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
