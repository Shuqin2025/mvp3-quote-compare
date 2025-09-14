/* public/ui-enhance.js  —  最小可用并带容错的版本（去掉 /v1 前缀） */

/** 获取 i18n 词条（容错） */
function t(key, fallback) {
  try {
    return (window.i18n && typeof window.i18n.t === "function")
      ? window.i18n.t(key) ?? fallback ?? key
      : (fallback ?? key);
  } catch {
    return fallback ?? key;
  }
}

/** 简单的吐司提示（可替换为你页面上的提示组件） */
function toast(msg) {
  console.log("[toast]", msg);
  try {
    const bar = document.getElementById("toast-bar");
    if (bar) {
      bar.textContent = msg;
      bar.style.display = "block";
      clearTimeout(bar._h);
      bar._h = setTimeout(() => (bar.style.display = "none"), 3000);
    }
  } catch {}
}

/** 读取并规范化 ?api= 参数，或使用同源 */
function getApiBase() {
  const sp = new URLSearchParams(location.search);
  let base = (sp.get("api") || "").trim();

  // 如果没传 api，用同源
  if (!base) return location.origin;

  // 如果只给了域名，补 https://
  if (!/^https?:\/\//i.test(base)) {
    base = "https://" + base;
  }

  // 去掉末尾的斜杠
  base = base.replace(/\/+$/, "");
  return base;
}

/** 构建后端解析接口完整 URL（注意：没有 /v1 前缀） */
function buildParseUrl(targetUrl) {
  const apiBase = getApiBase();
  const PATH_PARSE = "/api/parse";     // ← 关键：使用 /api/parse，而不是 /v1/api/parse
  const url = encodeURIComponent(targetUrl);
  return `${apiBase}${PATH_PARSE}?url=${url}`;
}

/** 抓取按钮点击 */
async function handleFetch() {
  const input = document.getElementById("urlInput") || document.querySelector("input[type=text]");
  if (!input) {
    toast(t("toast_fail_prefix", "抓取失败：") + "找不到输入框");
    return;
  }

  const raw = (input.value || "").trim();
  if (!raw) {
    toast(t("toast_fail_prefix", "抓取失败：") + t("ui.input_hint", "请输入或粘贴一个目录/列表页链接"));
    return;
  }

  // 允许用户把 API 放在输入里（你当前 UI 就是这样用的）
  // 例如： https://你的前端/?api=https://你的后端.com
  // 这里只解析 “?api=” 在当前页面的 query，不再从 input 的文本里再拆 api，避免混乱

  const fetchUrl = buildParseUrl(raw);
  console.log("[fetch] ->", fetchUrl);

  try {
    const res = await fetch(fetchUrl, { method: "GET", credentials: "omit" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json().catch(() => ({}));

    // 统计或数据展示
    const count = (data.count ?? data.items?.length ?? data.products?.length ?? 0);
    toast(t("toast_success_prefix", "抓取成功，共 ") + count + " 条");

    // 渲染空白区（如果有）
    const box = document.getElementById("resultBox") || document.querySelector(".result-box");
    if (box) {
      box.innerHTML = ""; // 清空
      const pre = document.createElement("pre");
      pre.style.margin = "8px";
      pre.style.whiteSpace = "pre-wrap";
      pre.textContent = JSON.stringify(
        { ok: true, count, sample: (data.items ?? data.products ?? []).slice(0, 5) },
        null, 2
      );
      box.appendChild(pre);
    }
  } catch (err) {
    console.error(err);
    toast(t("toast_fail_prefix", "抓取失败：") + (err?.message || "网络错误"));
  }
}

/** 导出 Excel（保留原行为：需要后端提供 /api/export 或前端本地导出逻辑） */
async function handleExport() {
  try {
    // 这里先给出占位提示，等你后端导出就绪后再补
    toast(t("export_not_ready", "导出功能暂未接入后端"));
  } catch (err) {
    console.error(err);
    toast(t("toast_fail_prefix", "导出失败：") + (err?.message || "未知错误"));
  }
}

/** 清空数据展示区 */
function handleClear() {
  const box = document.getElementById("resultBox") || document.querySelector(".result-box");
  if (box) box.innerHTML = "";
  toast(t("cleared", "已清空数据"));
}

/** 绑定事件 */
function bind() {
  const btnFetch  = document.getElementById("btnFetch")  || document.querySelector('[data-role="fetch"]');
  const btnExport = document.getElementById("btnExport") || document.querySelector('[data-role="export"]');
  const btnClear  = document.getElementById("btnClear")  || document.querySelector('[data-role="clear"]');

  btnFetch  && btnFetch.addEventListener("click", handleFetch);
  btnExport && btnExport.addEventListener("click", handleExport);
  btnClear  && btnClear.addEventListener("click", handleClear);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bind);
} else {
  bind();
}
