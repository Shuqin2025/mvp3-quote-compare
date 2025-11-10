/**
 * ui-enhance.js — 前端增强脚本（完整替换版）
 * 版本：2025-11-05-2
 *
 * 解决点：
 *  1) 继续使用 GET 调用 /v1/api/catalog/parse，避免 CORS 预检；附带 t= 类型提示。
 *  2) 页面表格：Memoryking 的商品图片统一走图片代理 /v1/api/image?format=raw，
 *     其它站点先直链，失败再回退到代理；检测 loader.svg / logo / placeholder 自动回退。
 *  3) 导出 Excel：内嵌前 200 张图片（通过 /v1/api/image?format=base64），
 *     链接列显示“🔗 链接”（不是长长的 URL）。
 *  4) 兼容 rows / data / list / items / products 多种后端返回；
 *     渲染后自动滚到表格顶部；抓取按钮防重复点击。
 *
 * ⚠️ 请确保页面引用带版本号以绕过缓存：
 *    <script type="module" src="/ui-enhance.js?v=2025-11-05-2"></script>
 */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getApiBase() {
    try {
      const u = new URL(location.href);
      const api = u.searchParams.get("api");
      return api ? api.replace(/\/+$/, "") : "";
    } catch {
      return "";
    }
  }
  const API_BASE = (()=>{try{const u=new URL(location.href);const api=u.searchParams.get('api');const meta=document.querySelector('meta[name="api-base"]')?.content||'';const base=(api||meta||'/v1/api');return String(base).replace(/\/+$/,'');}catch{ return '/v1/api'; }})();
  console.info("[UI] API_BASE =", API_BASE);

  // ---------- base64 helpers ----------
  const isDataUri = (s) => /^data:image\/[a-z0-9+.-]+;base64,/i.test(String(s||""));
  async function blobToBase64(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  async function fetchImageAsBase64Direct(url) {
    const r = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const blob = await r.blob();
    return await blobToBase64(blob);
  }
  async function fetchImageAsBase64ViaApi(url) {
    if (!API_BASE) throw new Error("no API_BASE");
    const api = `${API_BASE}/image?format=base64&url=${encodeURIComponent(url)}`;
    const r = await fetch(api, { mode: "cors", credentials: "omit", cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (j && j.ok && j.base64) {
      if (/^data:/i.test(j.base64)) return j.base64;
      const ct = j.contentType || "image/jpeg";
      return `data:${ct};base64,${j.base64}`;
    }
    if (j && typeof j === "string" && /^data:/i.test(j)) return j;
    throw new Error("invalid image api response");
  }
  async function ensureBase64ForRowImage(row) {
    const img = pickImgClient(row) || row.img || "";
    if (!img) return row;
    if (isDataUri(img)) return row;
    let dataUrl = "";
    try { dataUrl = await fetchImageAsBase64ViaApi(img); }
    catch { try { dataUrl = await fetchImageAsBase64Direct(img); } catch {} }
    const patched = { ...row };
    if (dataUrl) {
      patched.image = dataUrl;
      patched.img = dataUrl;
      patched.picture = dataUrl;
    }
    return patched;
  }
  async function prepareRowsWithBase64(rows, max = 200) {
    const slice = Array.isArray(rows) ? rows.slice(0, max) : [];
    const rest  = Array.isArray(rows) ? rows.slice(max) : [];
    const done = [];
    for (let i = 0; i < slice.length; i++) {
      try { done.push(await ensureBase64ForRowImage(slice[i])); }
      catch { done.push(slice[i]); }
    }
    return done.concat(rest);
  }


  const els = {
    urlInput:
      $("#txtUrl") ||
      $("#url") ||
      $('input[type="url"], input[name="url"]') ||
      $("input"),

    btnFetch:
      $("#btnFetch") ||
      $$(".btn").find((b) => /抓取|Fetch|采集/.test(b?.textContent || "")),

    selectLimit: $("#selLimit") || $("#pageSize") || $("select"),

    btnExport:
      $("#btnExport") || $$(".btn").find((b) => /导出|Export/i.test(b?.textContent || "")),

    btnClear:
      $("#btnClear") || $$(".btn").find((b) => /清空|Clear/i.test(b?.textContent || "")),

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
    els.toast.style.color = ok ? "#444" : "#b00020";
  }

  function clearTable() {
    if (els.tbody) els.tbody.innerHTML = "";
  }

  function pickImgClient(row) {
    return (row && (row.img || row.image || row.thumb || row.picture)) || "";
  }

  function guessAdapterFromUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.toLowerCase();
      const qs = u.search.toLowerCase();

      if (/(^|\.)memoryking\.de$/.test(host)) return "memoryking";
      if (/s-impuls-shop\.de$/.test(host)) return "generic-cards";

      if (host.endsWith("myshopify.com") || path.includes("/collections/") || path.includes("/products/")) {
        return "shopify";
      }
      if (path.includes("/product-category/") || path === "/shop/" || path.startsWith("/shop/") || path.includes("/product-tag/")) {
        return "woocommerce";
      }
      if (/[?&](scategory|spage|sviewport)=/.test(qs) || path.includes("/listing/") || path.includes("/kategorie/") || path.includes("/kategorien/")) {
        return "shopware";
      }
      if (path.includes("/catalog/") || path.includes("/mage/")) {
        return "magento";
      }
      return "";
    } catch {
      return "";
    }
  }

  async function detectType(url) {
    if (!API_BASE) return null;
    try {
      const r = await fetch(`${API_BASE}/detect?url=${encodeURIComponent(url)}`, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-cache",
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.ok && j?.type ? j.type : null;
    } catch {
      return null;
    }
  }

  async function parseCatalog(url, limit, hintT) {
    const qs = new URLSearchParams();
    qs.set("url", url);
    if (limit) qs.set("limit", String(limit));
    qs.set("imgCount", "2");
    qs.set("compare", "1");
    qs.set("detailSkuMax", "8");
    qs.set("imgDelim", " ");
    if (hintT) qs.set("t", hintT);

    const finalUrl = `${API_BASE}/catalog/parse?${qs.toString()}`;
    console.info("[UI] parseCatalog GET →", finalUrl);

    const resp = await fetch(finalUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-cache",
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data;
  }

  let lastRows = [];

  function pickArray(data) {
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.products)) return data.products;
    return [];
  }

  function normalizeRows(rawData) {
    const list = pickArray(rawData);
    const baseUrlForAbs = (els.urlInput?.value || "").trim();
    const toAbs = (maybeRel) => {
      if (!maybeRel) return "";
      try { return new URL(maybeRel, baseUrlForAbs).href; }
      catch { return maybeRel; }
    };

    return list.map((p) => {
      const link = toAbs(p.link || p.url || "");
      const imgCandidate = p.img || (Array.isArray(p.imgs) ? p.imgs[0] : "");
      const imgAbs = toAbs(imgCandidate);

      return {
        sku: p.sku || p.code || p.id || "",
        title: p.title || p.name || p.desc || "",
        img: imgAbs,
        moq: p.moq || "",
        price: p.price || "",
        currency: p.currency || "",
        link,
        url: link,
        desc: p.desc || "",
      };
    });
  }

  function hostFrom(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
  }

  function renderRows(rows) {
    lastRows = rows || [];
    clearTable();
    if (!rows?.length) return;

    const frag = document.createDocumentFragment();
    const sourceUrl = (els.urlInput?.value || "").trim();
    const srcHost = hostFrom(sourceUrl);

    rows.forEach((r, idx) => {
      const tr = document.createElement("tr");

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(idx + 1);

      const tdSku = document.createElement("td");
      tdSku.textContent = r.sku || "—";

      const tdImg = document.createElement("td");
      if (r.img) {
        const imgEl = document.createElement("img");
        const srcRaw = (pickImgClient(r) || r.img || "");

        const mustProxy = /(^|\.)memoryking\.de$/.test(srcHost);
        const proxyUrl = API_BASE
          ? `${API_BASE}/image?format=raw&url=${encodeURIComponent(srcRaw)}`
          : srcRaw;

        const isPlaceholder = /loader\.svg|logo|placeholder|spacer\.gif/i.test(srcRaw);

        imgEl.src = (mustProxy || isPlaceholder) ? proxyUrl : srcRaw;
        imgEl.onerror = () => {
          if (imgEl.src !== proxyUrl) imgEl.src = proxyUrl;
        };
        imgEl.alt = r.title || "";
        imgEl.referrerPolicy = "no-referrer";
        imgEl.loading = "lazy";
        imgEl.style.maxWidth = "80px";
        imgEl.style.maxHeight = "80px";
        tdImg.appendChild(imgEl);
      } else {
        tdImg.textContent = "—";
      }

      const tdTitle = document.createElement("td");
      tdTitle.textContent = r.title || r.desc || "—";

      const tdMoq = document.createElement("td");
      tdMoq.textContent = r.moq || "—";

      const tdPrice = document.createElement("td");
      tdPrice.textContent = r.price ? (r.currency ? `${r.price} ${r.currency}` : r.price) : "—";

      const tdLink = document.createElement("td");
      if (r.link || r.url) {
        const a = document.createElement("a");
        a.href = r.link || r.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = "打开商品页";
        a.textContent = "🔗 链接";
        a.style.textDecoration = "none";
        a.style.padding = "4px 8px";
        a.style.border = "1px solid #ddd";
        a.style.borderRadius = "6px";
        a.style.fontSize = "12px";
        tdLink.appendChild(a);
      } else tdLink.textContent = "—";

      tr.appendChild(tdIdx);
      tr.appendChild(tdSku);
      tr.appendChild(tdImg);
      tr.appendChild(tdTitle);
      tr.appendChild(tdMoq);
      tr.appendChild(tdPrice);
      tr.appendChild(tdLink);

      frag.appendChild(tr);
    });

    if (els.tbody) els.tbody.appendChild(frag);
  }

  async function exportXlsx() {
    if (!lastRows?.length) {
      setToast("没有可以导出的数据", false);
      return;
    }

    const hasExcel = !!window.ExcelJS;
    if (!hasExcel) {
      const header = ["#", "货号", "图片", "描述", "起订量", "单价", "链接"];
      const lines = [header.join(",")];
      lastRows.forEach((r, i) => {
        const rowArr = [
          String(i + 1),
          (r.sku || "").replace(/,/g, " "),
          (r.img || "").replace(/,/g, " "),
          (r.title || r.desc || "").replace(/,/g, " "),
          (r.moq || "").toString().replace(/,/g, " "),
          (r.price || "").toString().replace(/,/g, " "),
          r.link || r.url || "",
        ];
        lines.push(rowArr.join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "catalog.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Catalog");

      ws.columns = [
        { header: "#", key: "idx", width: 5 },
        { header: "货号", key: "sku", width: 18 },
        { header: "图片", key: "img", width: 30 },
        { header: "描述", key: "title", width: 46 },
        { header: "起订量", key: "moq", width: 10 },
        { header: "单价", key: "price", width: 15 },
        { header: "链接", key: "link", width: 12 },
      ];
      lastRows.forEach((r, i) => {
        ws.addRow({
          idx: i + 1,
          sku: r.sku || "",
          img: r.img || "",
          title: r.title || r.desc || "",
          moq: r.moq || "",
          price: r.currency ? `${r.price || ""} ${r.currency}` : r.price || "",
          link: r.link || r.url || "",
        });
      });

      const MAX_EMBED = 200;
      const N = Math.min(lastRows.length, MAX_EMBED);
      const colImgIndex = 3;
      for (let i = 0; i < N; i++) {
        const r = lastRows[i];
        const imgUrl = r?.img ? String(r.img) : "";
        if (!imgUrl || !API_BASE) continue;
        try {
          const api = `${API_BASE}/image?format=base64&url=${encodeURIComponent(imgUrl)}`;
          const resp = await fetch(api, { mode: "cors", credentials: "omit", cache: "no-cache" });
          const j = await resp.json();
          if (!(j && j.ok && j.base64)) continue;

          const ct = String(j.contentType || "image/jpeg").toLowerCase();
          const ext =
            ct.includes("png") ? "png" :
            ct.includes("gif") ? "gif" :
            ct.includes("webp") ? "webp" : "jpeg";

          const base64 = j.base64.startsWith("data:") ? j.base64.split(",")[1] : j.base64;

          const imageId = wb.addImage({ base64, extension: ext });
          const rowIndex = i + 2;
          ws.getRow(rowIndex).height = 90;
          ws.addImage(imageId, { tl: { col: colImgIndex - 1, row: rowIndex - 1 }, ext: { width: 120, height: 80 } });
        } catch {}
      }

      for (let i = 0; i < lastRows.length; i++) {
        const rowIndex = i + 2;
        const linkUrl = lastRows[i].link || lastRows[i].url || "";
        if (!linkUrl) continue;
        ws.getCell(rowIndex, 7).value = { text: "🔗 链接", hyperlink: linkUrl };
        ws.getCell(rowIndex, 7).style.font = { color: { argb: "FF2F80ED" }, underline: true };
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "catalog.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      setToast("导出失败：" + err.message, false);
    }
  }

  async function handleFetchClick() {
    if (!API_BASE) {
      setToast("缺少网关参数 ?api=...，无法抓取", false);
      console.warn("[UI] 没检测到 API_BASE。请用 https://your.site/?api=https://your-gateway 的形式打开页面。");
      return;
    }
    const btn = els.btnFetch;
    const limitSel = els.selectLimit;
    const url = (els.urlInput?.value || "").trim();
    if (!url) {
      setToast("请输入要抓取的目录链接", false);
      return;
    }

    if (btn && btn.disabled) return;
    const origText = btn ? (btn.textContent || "") : "";
    if (btn) { btn.disabled = true; btn.textContent = "抓取中…"; }

    try {
      const limitVal = parseInt((limitSel && limitSel.value) || "50", 10) || 50;

      let t = guessAdapterFromUrl(url);
      if (!t) {
        try { t = await detectType(url); } catch {}
      }
      console.info("[UI] adapter hint =", t || "(none)");

      const data = await parseCatalog(url, limitVal, t || "");

      const rows = data.rows || data.items || data.data || data.list || [];
      if (data && data.ok !== false) {
        const total = data.count || rows.length || 0;
        setToast(`抓取成功：共 ${total} 条${data.adapter ? `（来源：${data.adapter}）` : ""}`);
        const normRows = normalizeRows(data);
        renderRows(normRows);

        try {
          const target = els.table || els.tbody || document.body;
          if (target?.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {}
      } else {
        setToast(`抓取失败：${data?.error || "unknown"}`, false);
      }
    } catch (err) {
      console.error("[UI] fetch error", err);
      setToast("抓取失败", false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
  }

  if (els.btnFetch) {
    if ((els.btnFetch.getAttribute("type") || "").toLowerCase() !== "button") {
      els.btnFetch.setAttribute("type", "button");
    }
    els.btnFetch.addEventListener("click", handleFetchClick);
  }
  if (els.urlInput?.addEventListener) {
    els.urlInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") handleFetchClick(); });
  }
  
  if (els.btnExport) {
    els.btnExport.addEventListener("click", async () => {
      try {
        if (!lastRows?.length) { setToast("没有可以导出的数据", false); return; }
        setToast("正在准备图片（base64）…", true);
        const prepped = await prepareRowsWithBase64(lastRows, 200);
        window.__rowsForExport = prepped;
        if (typeof window.exportXlsx === "function") {
          if (window.exportXlsx.length >= 1) { await window.exportXlsx(prepped); }
          else { await window.exportXlsx(); }
        } else {
          console.error("export-xlsx.js not loaded");
          alert("导出模块未加载");
        }
        setToast("正在导出，请稍候…", true);
      } catch(e){ console.error(e); setToast("导出失败", false); }
    });
  }
catch(e){ console.error(e); } }); }
  if (els.btnClear) {
    els.btnClear.addEventListener("click", () => { clearTable(); lastRows = []; setToast("已清空"); });
  }

  (async () => {
    if (!API_BASE) return;
    const healthUrl = `${API_BASE}/health`;
    console.info("[UI] health check →", healthUrl);
    try {
      const r = await fetch(healthUrl, { mode: "cors", credentials: "omit" });
      console.info("[UI] health status:", r.status);
    } catch (err) {
      console.warn("[UI] health failed:", err);
    }
  })();

  console.info("[UI] ui-enhance.js version = 2025-11-05-2");
  setTimeout(() => {
    console.info("[UI] late-check DOM ready?",
      { btnFetch: !!els.btnFetch, urlInput: !!els.urlInput, tbody: !!els.tbody, API_BASE });
  }, 800);
})();
