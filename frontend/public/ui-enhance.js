// public/ui-enhance.js
(function () {
  // ------- DOM 缓存（安全获取，避免空指针） -------
  const $ = (id) => document.getElementById(id);
  const $url = $("txtUrl");
  const $btnFetch = $("btnFetch");
  const $btnExport = $("btnExport");
  const $btnClear = $("btnClear");
  const $pageSize = $("selPreview");
  const $tbl = $("tbl");
  const $tbody = $("tblBody");
  const $empty = $("selPreviewSkeleton");

  function T(k, v) {
    return (window.i18n && i18n.t(k, v)) || k;
  }

  // ------- UI 文案应用 -------
  function applyI18n() {
    const $title = $("appTitle");
    if ($title) $title.textContent = T("app_name");
    if ($url) $url.placeholder = T("placeholder");
    if ($btnFetch) $btnFetch.textContent = T("btn_fetch");
    if ($btnExport) $btnExport.textContent = T("btn_export");
    if ($btnClear) $btnClear.textContent = T("btn_clear");
    const $linkHeaders = document.querySelectorAll("[data-i18n=link_text]");
    $linkHeaders.forEach((el) => (el.textContent = T("link_text")));
  }

  // ------- Toast -------
  function showToast(ok, msg) {
    let box = $("toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast";
      box.style.cssText =
        "position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 12px;border-radius:8px;font-size:14px";
      document.body.appendChild(box);
    }
    box.style.background = ok ? "#e6ffed" : "#fff7e6"; // 成功绿 / 警告橙
    box.style.border = ok ? "1px solid #b7eb8f" : "1px solid #ffd591";
    box.textContent = msg;
    clearTimeout(box.__tid);
    box.__tid = setTimeout(() => (box.style.display = "none"), 2600);
    box.style.display = "block";
  }

  // ------- 表格渲染 -------
  function render(rows) {
    $tbody.innerHTML = "";
    if (!rows || !rows.length) {
      $tbl.style.display = "none";
      $empty.style.display = "block"; // 留空白
      return;
    }
    $empty.style.display = "none";
    $tbl.style.display = "table";
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.sku || ""}</td>
        <td><img src="${r.img || ""}" style="height:36px"></td>
        <td>${r.title || ""}</td>
        <td>${r.moq || ""}</td>
        <td>${r.price || ""}</td>
        <td><a href="${r.url || "#"}" target="_blank">${T("link_text")}</a></td>
      `;
      $tbody.appendChild(tr);
    });
  }

  // ------- 数据状态 -------
  let cache = []; // 最近一次“抓取目录”的完整数据（用于导出）

  // ------- 抓取 -------
  async function handleFetch() {
    if (!$url) {
      showToast(false, "toast_fail: #txtUrl not found");
      return;
    }
    const url = ($url.value || "").trim();
    if (!url) {
      render([]);
      showToast(true, T("toast_zero"));
      return;
    }
    const apiBase =
      new URLSearchParams(location.search).get("api") ||
      (window.__API_BASE || "");

    try {
      const resp = await fetch(
        `${apiBase}/v1/api/catalog/parse?url=${encodeURIComponent(url)}`
      );
      if (!resp.ok) throw new Error(resp.status + " " + resp.statusText);
      const data = await resp.json();

      // 统一 rows：优先 items，没有就用 products
      const rows = Array.isArray(data.items) && data.items.length
        ? data.items
        : Array.isArray(data.products)
        ? data.products
        : [];

      cache = rows;
      render(rows.slice(0, parseInt($pageSize.value || "50", 10)));
      if (!rows.length) {
        showToast(true, T("toast_zero"));
      } else {
        showToast(true, T("toast_ok", { n: rows.length, m: $pageSize.value || 50 }));
      }
    } catch (e) {
      showToast(false, T("toast_fail_prefix") + (e && e.message ? e.message : e));
      render([]);
    }
  }

  // ------- 导出 -------
  async function handleExport() {
    if (!cache.length) {
      showToast(false, T("toast_fail_prefix") + "No data");
      return;
    }
    showToast(true, T("toast_exporting"));
    // 这里调用现有导出逻辑（你项目里已有），只需要继续使用 cache 即可。
    // 如果你的导出实现放在别处，这里保留触发点：
    if (window.__exportToXlsx) {
      await window.__exportToXlsx(cache);
    } else {
      // 占位：避免完全空操作
      const blob = new Blob(
        ["Yunivera DataBridge\n" + JSON.stringify(cache.slice(0, 3), null, 2)],
        { type: "text/plain;charset=utf-8" }
      );
      const a = document.createElement("a");
      a.download = "yunivera-demo.txt";
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  // ------- 清空 -------
  function handleClear() {
    cache = [];
    render([]);
  }

  // ------- 事件 -------
  if ($btnFetch) $btnFetch.addEventListener("click", handleFetch);
  if ($btnExport) $btnExport.addEventListener("click", handleExport);
  if ($btnClear) $btnClear.addEventListener("click", handleClear);
  window.addEventListener("langchange", applyI18n);

  // 初次渲染文案
  applyI18n();
})();
