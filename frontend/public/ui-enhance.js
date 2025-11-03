/**
 * MVP3 前端增强脚本（完整替换版，含 rows/data/list/items/products 兼容）
 * 新增：防重复点击 + 抓取完成后自动滚动到结果表格
 */

(() => {
  /********************
   * 小工具 & DOM引用 *
   ********************/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // 解析 API_BASE：从 ?api= 里拿，去掉末尾的 /
  function getApiBase() {
    try {
      const u = new URL(location.href);
      const apiParam = u.searchParams.get("api");
      if (!apiParam) return "";
      return apiParam.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }
  const API_BASE = getApiBase();
  console.info("[UI] API_BASE =", API_BASE);

  // DOM 节点（多备用名，尽量不挑剔你的 HTML）
  const els = {
    urlInput:
      $("#txtUrl") ||
      $("#url") ||
      $('input[type="url"], input[name="url"]') ||
      $("input"),

    btnFetch:
      $("#btnFetch") || $$(".btn").find((b) => /抓取|Fetch|采集/.test(b?.textContent || "")),

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

  // 黄色/粉色小提醒条
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

  
  // 取图兜底（前端容错）
  function pickImgClient(row) {
    return (row && (row.img || row.image || row.thumb || row.picture)) || "";
  }
/******************************
   * 适配器映射 & 适配器推断逻辑 *
   ******************************/

  const TYPE_TO_T = {
    Shopify: "shopify",
    WooCommerce: "woocommerce",
    "Woo Commerce": "woocommerce",
    Woo: "woocommerce",
    Shopware: "shopware",
    Magento: "magento",
    OpenCart: "opencart",
  };

  function guessAdapterFromUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.toLowerCase();
      const qs = u.search.toLowerCase();

      if (/(^|\.)memoryking\.de$/.test(host)) return "memoryking";

      if (
        host.endsWith("myshopify.com") ||
        path.includes("/collections/") ||
        path.includes("/products/")
      ) return "shopify";

      if (
        path.includes("/product-category/") || 
        path === "/shop/" || path.startsWith("/shop/") ||
        path.includes("/product-tag/")
      ) return "woocommerce";

      if (/[?&](scategory|spage|sviewport)=/.test(qs) ||
          path.includes("/listing/") || path.includes("/kategorie/") || path.includes("/kategorien/")
      ) return "shopware";

      if (path.includes("/catalog/") || path.includes("/mage/")) return "magento";

      return "";
    } catch {
      return "";
    }
  }

  /**********************
   * 后端交互：detect() *
   **********************/
  async function detectType(url) {
    if (!API_BASE) return null;
    try {
      const r = await fetch(`${API_BASE}/v1/api/detect?url=${encodeURIComponent(url)}`, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-cache",
      });
      if (!r.ok) {
        console.warn("[UI] detect HTTP", r.status);
        return null;
      }
      const j = await r.json();
      if (j?.ok && j?.type) {
        console.info("[UI] detectType() =>", j.type);
        return j.type;
      }
      return null;
    } catch (err) {
      console.warn("[UI] detectType() error:", err);
      return null;
    }
  }

  /***********************************
   * 后端交互：parseCatalog() (GET)  *
   ***********************************/
  async function parseCatalog(url, limit, hintT) {
    const qs = new URLSearchParams();
    qs.set("url", url);
    if (limit) qs.set("limit", String(limit));

    // 温和默认值；后端会忽略不认识的字段
    qs.set("imgCount", "2");
    qs.set("compare", "1");
    qs.set("detailSkuMax", "8");
    qs.set("imgDelim", " ");

    if (hintT) qs.set("t", hintT);

    const finalUrl = `${API_BASE}/v1/api/catalog/parse?${qs.toString()}`;
    console.info("[UI] parseCatalog GET =>", finalUrl);

    const resp = await fetch(finalUrl, {
      method: "GET", // 关键：GET，避免浏览器发 OPTIONS 预检
      mode: "cors",
      credentials: "omit",
      cache: "no-cache",
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    console.info("[UI] parseCatalog() data:", data);
    return data;
  }

  /************************
   * 数据标准化 & 渲染表格 *
   ************************/
  let lastRows = []; // 导出用

  function pickArray(data) {
    // 按优先级读取：rows → data → list → items → products
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
      try {
        return new URL(maybeRel, baseUrlForAbs).href;
      } catch {
        return maybeRel;
      }
    };

    return list.map((p) => {
      const link = toAbs(p.link || p.url || "");
      let imgCandidate = p.img || (Array.isArray(p.imgs) ? p.imgs[0] : "");
      if (/loader\.svg|placeholder|spacer\.gif/i.test(String(imgCandidate || "")) && Array.isArray(p.imgs)) {
        const alt = p.imgs.find(x => !/loader\.svg|placeholder|spacer\.gif/i.test(String(x || "")));
        if (alt) imgCandidate = alt;
      }
      const imgAbs = toAbs(imgCandidate);

      return {
        sku: p.sku || p.code || "",
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

  function renderRows(rows) {
    lastRows = rows || [];
    clearTable();
    if (!rows?.length) return;

    const frag = document.createDocumentFragment();

    rows.forEach((r, idx) => {
      const tr = document.createElement("tr");

      // 1 序号
      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(idx + 1);

      // 2 货号
      const tdSku = document.createElement("td");
      tdSku.textContent = r.sku || "—";

      // 3 图片：先用直链，失败再走网关代理（format=raw）
      const tdImg = document.createElement("td");
      if (r.img) {
        const imgEl = document.createElement("img");
        const srcRaw = (pickImgClient(r) || r.img || "");
        const srcProxy = API_BASE
          ? `${API_BASE}/v1/api/image?format=raw&url=${encodeURIComponent(srcRaw)}`
          : srcRaw;
        // Memoryking 等站可能返回 loader.svg 等占位图；若命中占位，直接走代理
        const isPlaceholder = /loader\.svg|placeholder|spacer\.gif/i.test(srcRaw);
        const firstSrc = isPlaceholder ? srcProxy : srcRaw;
        imgEl.src = firstSrc;
        imgEl.onerror = () => { if (imgEl.src != srcProxy) imgEl.src = srcProxy; };
        imgEl.alt = r.title || "";
        imgEl.referrerPolicy = "no-referrer";
        imgEl.loading = "lazy";
        imgEl.style.maxWidth = "80px";
        imgEl.style.maxHeight = "80px";
        tdImg.appendChild(imgEl);
      } else {

        tdImg.textContent = "—";
      }

      // 4 描述
      const tdTitle = document.createElement("td");
      tdTitle.textContent = r.title || r.desc || "—";

      // 5 起订量
      const tdMoq = document.createElement("td");
      tdMoq.textContent = r.moq || "—";

      // 6 单价（带货币）
      const tdPrice = document.createElement("td");
      tdPrice.textContent = r.price
        ? r.currency
          ? `${r.price} ${r.currency}`
          : r.price
        : "—";

      // 7 链接（小图标按钮）
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
      } else { tdLink.textContent = "—"; }
      // ✅ 把所有单元格按列顺序插入
      tr.appendChild(tdIdx);
      tr.appendChild(tdSku);
      tr.appendChild(tdImg);
      tr.appendChild(tdTitle);
      tr.appendChild(tdMoq);
      tr.appendChild(tdPrice);
      tr.appendChild(tdLink);

      frag.appendChild(tr);
    });

    if (els.tbody) {
      els.tbody.appendChild(frag);
    }
  }

  /*****************
   * 导出（xlsx/csv）
   *****************/
  async function exportXlsx() {
    if (!lastRows?.length) {
      setToast("没有可以导出的数据", false);
      return;
    }

    const hasExcel = !!window.ExcelJS;
    if (!hasExcel) {
      // 回退 CSV
      const header = ["#", "货号", "标题", "MOQ", "单价", "链接"];
      const lines = [header.join(",")];
      lastRows.forEach((r, i) => {
        const rowArr = [
          String(i + 1),
          (r.sku || "").replace(/,/g, " "),
          (r.title || r.desc || "").replace(/,/g, " "),
          (r.moq || "").toString().replace(/,/g, " "),
          (r.price || "").toString().replace(/,/g, " "),
          r.link || r.url || "",
        ];
        lines.push(rowArr.join(","));
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "catalog.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    try {
      // 用 ExcelJS 生成 .xlsx
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Sheet1");

      ws.columns = [
        { header: "#", key: "idx", width: 5 },
        { header: "货号", key: "sku", width: 20 },
        { header: "图片", key: "img", width: 30 },
        { header: "描述", key: "title", width: 40 },
        { header: "起订量", key: "moq", width: 10 },
        { header: "单价", key: "price", width: 15 },
        { header: "链接", key: "link", width: 40 },
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

      // —— 尝试内嵌前 50 张图片（失败自动忽略，单元格保留 URL）——
      const N = Math.min(50, lastRows.length);
      const colImgIndex = 3; // C 列（1-based）
      for (let i = 0; i < N; i++) {
        const r = lastRows[i];
        const url = r?.img ? String(r.img) : "";
        if (!url || !API_BASE) continue;
        try {
          const api = `${API_BASE}/v1/api/image?format=base64&url=${encodeURIComponent(url)}`;
          const resp = await fetch(api, { mode: "cors", credentials: "omit", cache: "no-cache" });
          const j = await resp.json();
          if (!j?.ok || !j?.base64) continue;
          const ct = String(j.contentType || "image/jpeg").toLowerCase();
          const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" :
                      ct.includes("webp") ? "webp" : "jpeg";
          const pure = j.base64.startsWith('data:') ? j.base64.split(',')[1] : j.base64;
          const imageId = wb.addImage({ base64: pure, extension: ext });
          const rowIndex = i + 2; // 第1行为表头
          ws.getRow(rowIndex).height = 90;
          ws.addImage(imageId, { tl: { col: colImgIndex - 1, row: rowIndex - 1 }, ext: { width: 120, height: 80 } });
        } catch {}
      }
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
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

  /*********************************
   * 点击“抓取目录”主流程入口函数  *
   *********************************/
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

    // 防重复点击
    if (btn && btn.disabled) return;
    const origText = btn ? (btn.textContent || "") : "";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "抓取中…";
    }

    try {
      // 读取条数
      const limitVal = parseInt((limitSel && limitSel.value) || "50", 10) || 50;

      // 调后端
      const qs = new URLSearchParams({ url, limit: String(limitVal) });
      const finalUrl = `${API_BASE}/v1/api/catalog/parse?${qs.toString()}`;
      const resp = await fetch(finalUrl, { method: "GET", mode: "cors", credentials: "omit", cache: "no-cache" });
      const data = await resp.json();

      // 兼容 rows/items/data/list
      const rows = data.rows || data.items || data.data || data.list || [];

      if (data && data.ok !== false) {
        const total = data.count || rows.length || 0;
        setToast(`抓取成功：共 ${total} 条${data.adapter ? `（来源：${data.adapter}）` : ""}`);
        const normRows = normalizeRows(data);
        renderRows(normRows);

        // 渲染后自动滚动到表格顶部
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
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }
  }

  /*****************
   * 按钮/事件绑定 *
   *****************/
  if (els.btnFetch) {
    // 避免 <button type="submit"> 触发表单提交
    if ((els.btnFetch.getAttribute("type") || "").toLowerCase() !== "button") {
      els.btnFetch.setAttribute("type", "button");
    }
    els.btnFetch.addEventListener("click", handleFetchClick);
  }

  if (els.urlInput?.addEventListener) {
    els.urlInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") handleFetchClick();
    });
  }

  if (els.btnExport) {
    els.btnExport.addEventListener("click", exportXlsx);
  }

  if (els.btnClear) {
    els.btnClear.addEventListener("click", () => {
      clearTable();
      lastRows = [];
      setToast("已清空");
    });
  }

  /*********************************
   * 轻量自检：健康检查日志
   *********************************/
  (async () => {
    if (!API_BASE) return;
    const healthUrl = `${API_BASE}/v1/api/health`;
    console.info("[UI] health check →", healthUrl);
    try {
      const r = await fetch(healthUrl, { mode: "cors", credentials: "omit" });
      console.info("[UI] health status:", r.status);
    } catch (err) {
      console.warn("[UI] health failed:", err);
    }
  })();

  setTimeout(() => {
    console.info("[UI] late-check DOM ready?", {
      btnFetch: !!els.btnFetch,
      urlInput: !!els.urlInput,
      tbody: !!els.tbody,
      API_BASE,
    });
  }, 800);
})();
