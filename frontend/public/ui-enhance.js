/**
 * MVP3 前端增强脚本（完整替换版，含 rows/data/list/items/products 兼容）
 *
 * 目标：
 * 1) 所有后端请求一律走你提供的网关 API_BASE：
 *    API_BASE = location.search 里的 ?api=... ，例如：
 *    https://www.yunivera.com/?api=https://yunivera-gateway.onrender.com
 *
 * 2) 抓取逻辑（避免预检，全部 GET）：
 *    - 先调 /v1/api/detect?url=...
 *    - 再调 /v1/api/catalog/parse?... （尽量附上 t=adapter 提示后端）
 *
 * 3) 渲染产品表格，并支持导出（优先 .xlsx，缺少 ExcelJS 时回退 CSV）
 * 4) Console 注入调试日志，排查更方便
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

  /******************************
   * 适配器映射 & 适配器推断逻辑 *
   ******************************/

  // 后端 detect() 的类型名  ->  我们告诉后端 parse() 的 t= 值
  const TYPE_TO_T = {
    Shopify: "shopify",
    WooCommerce: "woocommerce",
    "Woo Commerce": "woocommerce",
    Woo: "woocommerce",
    Shopware: "shopware",
    Magento: "magento",
    OpenCart: "opencart",
  };

  // 我们再额外根据 URL 猜一遍，弥补 detect 不准的情况
  function guessAdapterFromUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.toLowerCase();
      const qs = u.search.toLowerCase();

      // 站点专用优先：memoryking.de
      if (/(^|\.)memoryking\.de$/.test(host)) {
        return "memoryking";
      }

      // Shopify 常见特征
      if (
        host.endsWith("myshopify.com") ||
        /(^|\.)kith\.com$/.test(host) ||
        path.includes("/collections/") ||
        path.includes("/products/")
      ) {
        return "shopify";
      }

      // WooCommerce 常见目录
      if (
        path.includes("/product-category/") ||
        path === "/shop/" ||
        path.startsWith("/shop/") ||
        path.includes("/product-tag/")
      ) {
        return "woocommerce";
      }

      // Shopware 常见 query / 路径
      if (
        /[?&](scategory|spage|sviewport)=/.test(qs) ||
        path.includes("/listing/") ||
        path.includes("/kategorie/") ||
        path.includes("/kategorien/")
      ) {
        return "shopware";
      }

      // Magento 粗略特征
      if (path.includes("/catalog/") || path.includes("/mage/")) {
        return "magento";
      }

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
      // 期望 { ok:true, type:"Shopware" }
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

    // 温和的默认值；后端会忽略不认识的字段
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
      const imgCandidate = p.img || (Array.isArray(p.imgs) ? p.imgs[0] : "");
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

      // 3 图片（统一走网关代理，避免跨域）
      const tdImg = document.createElement("td");
      if (r.img) {
        const imgEl = document.createElement("img");
        const proxied = API_BASE
          ? `${API_BASE}/v1/api/image?url=${encodeURIComponent(r.img)}`
          : r.img;
        imgEl.src = proxied;
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

      // 7 链接
      const tdLink = document.createElement("td");
      if (r.link || r.url) {
        const a = document.createElement("a");
        a.href = r.link || r.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "链接";
        tdLink.appendChild(a);
      } else {
        tdLink.textContent = "—";
      }

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
      console.warn(
        "[UI] 没检测到 API_BASE。请用 https://www.yunivera.com/?api=https://yunivera-gateway.onrender.com 的形式打开页面。"
      );
      return;
    }

    const btn = els.btnFetch;
    const limitSel = els.selectLimit;

    const url = (els.urlInput?.value || "").trim();
    if (!url) {
      setToast("请输入要抓取的目录链接", false);
      return;
    }

    // UI 状态
    clearTable();
    if (btn) btn.disabled = true;
    setToast("正在检测站点类型…");

    // 1) 先问后端 detect
    let detectedType = "Unknown";
    try {
      const tpe = await detectType(url);
      if (tpe) detectedType = tpe;
    } catch (err) {
      console.warn("[UI] detectType failed:", err);
    }

    // 2) 再自己猜一遍（memoryking 等专用优先）
    const guessT = guessAdapterFromUrl(url);

    // 3) 合并成 hintT
    const hintT = guessT || TYPE_TO_T[detectedType] || "";

    setToast(`开始抓取数据（${detectedType}）${hintT ? `（adapter: ${hintT}）` : "（adapter: auto）"} …`);

    // 4) 读取条数
    const limitVal = parseInt((limitSel && limitSel.value) || "50", 10) || 50;

    // 5) 真正抓数据
    try {
      const data = await parseCatalog(url, limitVal, hintT);

      if (!data || data.ok === false) {
        setToast(`抓取失败：${data?.error || "unknown"}`, false);
      } else {
        const list = pickArray(data);
        const total = data.count || (Array.isArray(list) ? list.length : 0);
        if (data.adapter) {
          setToast(`抓取成功：共 ${total} 条（来源：${data.adapter}）`);
        } else {
          setToast(`抓取成功：共 ${total} 条`);
        }
        const normRows = normalizeRows(data);
        renderRows(normRows);
      }
    } catch (err) {
      console.error(err);
      setToast("抓取失败：" + (err.message || err), false);
    } finally {
      if (btn) btn.disabled = false;
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

  // 回车也能触发抓取
  if (els.urlInput?.addEventListener) {
    els.urlInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") handleFetchClick();
    });
  }

  // 导出
  if (els.btnExport) {
    els.btnExport.addEventListener("click", exportXlsx);
  }

  // 清空
  if (els.btnClear) {
    els.btnClear.addEventListener("click", () => {
      clearTable();
      lastRows = [];
      setToast("已清空");
    });
  }

  /*********************************
   * 轻量自检：打一下健康检查日志   *
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

  /*****************************************
   * 延迟日志：看看按钮 / DOM 是否都在线    *
   *****************************************/
  setTimeout(() => {
    console.info("[UI] late-check DOM ready?", {
      btnFetch: !!els.btnFetch,
      urlInput: !!els.urlInput,
      tbody: !!els.tbody,
      API_BASE,
    });
  }, 800);
})();
