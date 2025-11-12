/**
 * ui-enhance.plus.js
 * - 统一解析 apiBase（优先 URL ?api=，否则自动从站点拼出）
 * - 目录抓取：GET {apiBase}/catalog/parse?url=&limit=
 * - 图片：优先走 {apiBase}/image?format=raw&url=，失败退回直链原图
 * - 导出：优先 POST {apiBase}/export-xlsx，失败退回前端本地生成
 *
 * 需要配合 public/export-xlsx.js
 */

(function () {
  const qs = new URLSearchParams(location.search);
  const fromQuery = qs.get("api");
  const apiBase =
    (fromQuery && fromQuery.replace(/\/+$/, "")) ||
    "https://yunivera-gateway.onrender.com/v1";

  // 控件
  const $url = document.querySelector("#txtUrl") || document.querySelector('input[type="text"]');
  const $limit = document.querySelector("#txtLimit") || document.querySelector('input[type="number"]');
  const $btnFetch = document.querySelector("#btnFetch") || document.querySelector('button[id="btnFetch"]');
  const $btnExport = document.querySelector("#btnExport") || document.querySelector('button[id="btnExport"]');
  const $btnClear = document.querySelector("#btnClear") || document.querySelector('button[id="btnClear"]');
  const $tbody = document.querySelector("#tbl tbody") || (function () {
    // 兼容老结构
    const t = document.querySelector("table#tbl") || document.querySelector("table");
    return t ? (t.tBodies[0] || t.createTBody()) : null;
  })();
  const $status = document.querySelector("#status") || document.querySelector("div.status");
  const $okbar = document.querySelector("#okbar");

  console.log("[ui-plus] enabled, apiBase =", apiBase);

  let currentRows = [];

  function setStatus(msg, type) {
    if (!$status) return;
    $status.textContent = msg || "";
    $status.className = "status " + (type || "info");
  }

  function asInt(v, d) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
  }

  function buildParseURL(url, limit) {
    const base = apiBase.replace(/\/+$/, "");
    const u = new URL(base + "/catalog/parse");
    u.searchParams.set("url", url);
    if (limit) u.searchParams.set("limit", String(limit));
    return u.toString();
  }

  function imgProxyUrl(raw) {
    const base = apiBase.replace(/\/+$/, "");
    const u = new URL(base + "/image");
    u.searchParams.set("format", "raw");
    u.searchParams.set("url", raw);
    return u.toString();
  }

  function clearTable() {
    currentRows = [];
    if ($tbody) $tbody.innerHTML = "";
    setStatus("Ready", "info");
    if ($okbar) $okbar.style.display = "none";
  }

  // 统一渲染一行
  function renderRow(idx, item) {
    // 结构标准化
    const row = {
      sku: item.sku || "",
      img: item.img || item.image || "",
      title: item.title || item.desc || "",
      price: item.price || "",
      url: item.url || item.href || "",
    };

    const tr = document.createElement("tr");

    // 序号
    const tdIdx = document.createElement("td");
    tdIdx.textContent = String(idx + 1);
    tdIdx.style.width = "48px";
    tr.appendChild(tdIdx);

    // 货号
    const tdSku = document.createElement("td");
    tdSku.textContent = row.sku || "";
    tdSku.style.width = "110px";
    tr.appendChild(tdSku);

    // 图片
    const tdImg = document.createElement("td");
    tdImg.style.width = "110px";
    const img = document.createElement("img");
    img.alt = row.sku || "img";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.style.maxWidth = "90px";
    img.style.maxHeight = "90px";
    // 先走网关代理，失败再回退直链
    const rawImg = row.img || "";
    if (rawImg) {
      img.src = imgProxyUrl(rawImg);
      img.addEventListener("error", () => {
        img.src = rawImg;
      });
    }
    tdImg.appendChild(img);
    tr.appendChild(tdImg);

    // 描述
    const tdTitle = document.createElement("td");
    tdTitle.textContent = row.title || "";
    tr.appendChild(tdTitle);

    // 单价
    const tdPrice = document.createElement("td");
    tdPrice.textContent = row.price || "";
    tdPrice.style.width = "90px";
    tr.appendChild(tdPrice);

    // 打开
    const tdOpen = document.createElement("td");
    tdOpen.style.width = "70px";
    if (row.url) {
      const a = document.createElement("a");
      a.href = row.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "open";
      tdOpen.appendChild(a);
    }
    tr.appendChild(tdOpen);

    if ($tbody) $tbody.appendChild(tr);
    return row;
  }

  async function fetchCatalog() {
    try {
      const url = ($url && $url.value) || "";
      const limit = asInt(($limit && $limit.value), 50);
      if (!url) {
        setStatus("请输入目录链接", "warn");
        return;
      }
      setStatus("抓取中…", "info");

      const parseUrl = buildParseURL(url, limit);
      const resp = await fetch(parseUrl, { mode: "cors" });
      if (!resp.ok) {
        setStatus("抓取失败: " + resp.status, "error");
        return;
      }
      const data = await resp.json();
      // 标准返回：{ ok, url, count, items[], rows[] }
      const items = data.rows || data.items || data.data || [];
      if (!Array.isArray(items) || items.length === 0) {
        setStatus("没有解析到数据", "warn");
        return;
      }

      // 渲染
      if ($tbody) $tbody.innerHTML = "";
      currentRows = [];
      items.forEach((it, i) => {
        const r = renderRow(i, it);
        currentRows.push(r);
      });

      setStatus(`Fetched: ${items.length}/${data.count ?? items.length}`);
      if ($okbar) {
        $okbar.style.display = "";
        $okbar.textContent = "ok";
      }
    } catch (e) {
      setStatus("抓取失败：Failed to fetch", "error");
    }
  }

  async function exportExcel() {
    if (!currentRows.length) {
      setStatus("没有可导出的数据", "warn");
      return;
    }
    setStatus("导出中…", "info");
    try {
      // 优先网关，失败本地
      await window.ExportXlsx.export(
        currentRows,
        "export.xlsx",
        apiBase
      );
      setStatus("导出完成", "info");
    } catch (e) {
      setStatus("导出失败", "error");
    }
  }

  // 事件
  if ($btnFetch) $btnFetch.addEventListener("click", fetchCatalog);
  if ($btnExport) $btnExport.addEventListener("click", exportExcel);
  if ($btnClear) $btnClear.addEventListener("click", clearTable);

  // 语言切换按钮（如果页面上有）
  const $btnLangZh = document.querySelector("#btnLangZh");
  const $btnLangDe = document.querySelector("#btnLangDe");
  const $btnLangEn = document.querySelector("#btnLangEn");
  const saveLang = (v) => localStorage.setItem("mvp_lang", v);
  if ($btnLangZh) $btnLangZh.addEventListener("click", () => saveLang("zh"));
  if ($btnLangDe) $btnLangDe.addEventListener("click", () => saveLang("de"));
  if ($btnLangEn) $btnLangEn.addEventListener("click", () => saveLang("en"));

  // 初始化
  if ($status && !$status.textContent) setStatus("Ready", "info");
})();
