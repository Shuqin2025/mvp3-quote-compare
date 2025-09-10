<script>
/**
 * ui-enhance.js (robust v2)
 * - 自检日志：加载/匹配到的按钮都会在控制台输出
 * - 主/次按钮 + 箭头
 * - 抓取加载态（自动识别 /v1/api/catalog/parse）
 * - 开发者模式 dev=1 才显示“后台检查”“PING”；否则隐藏
 * - 同父级时：抓取栏在上、预览在下（仅加 class，不强制搬动 DOM）
 */
(function () {
  const log = (...a) => { try { console.log("[ui-enhance]", ...a); } catch(e){} };
  window.__uiEnhanceLoaded = true; log("loaded");

  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const findBtn = (patterns) =>
    $all("button").find((b) => patterns.some((re) => re.test((b.textContent || "").trim())));

  const getLang = () =>
    (window.__currentLang ||
      (window.i18n && window.i18n.pickLang && window.i18n.pickLang()) ||
      "de");

  /* ---------- 开发者模式 ---------- */
  function isDevMode() {
    const url = new URL(location.href);
    if (url.searchParams.get("dev") === "1") localStorage.setItem("dev", "1");
    return localStorage.getItem("dev") === "1";
  }
  function applyDevMode() {
    const root = document.body;
    if (isDevMode()) root.classList.add("yx-devmode");
    else root.classList.remove("yx-devmode");
  }

  /* ---------- 识别并标注按钮 ---------- */
  function styleButtons() {
    const btnFetch   = findBtn([/抓取|Abrufen|^Fetch$/i]);
    const btnPreview = findBtn([/预览|目录写入|einfügen|Write/i]);   // 兼容“目录写入正文（前50条）”
    const btnExcel   = findBtn([/导出\s*Excel|Excel exportieren|Export\s*Excel/i]);
    const btnPdf     = findBtn([/生成\s*PDF|PDF\s*erzeugen|Generate\s*PDF/i]);

    if (btnFetch)   { btnFetch.classList.add("btn-primary","step"); log("found Fetch:", btnFetch.textContent.trim()); }
    if (btnPreview) { btnPreview.classList.add("btn-secondary","step"); log("found Preview:", btnPreview.textContent.trim()); }
    if (btnExcel)   { btnExcel.classList.add("btn-secondary","step","is-last"); log("found Excel:", btnExcel.textContent.trim()); }
    if (btnPdf)     { btnPdf.classList.add("btn-secondary"); log("found PDF:", btnPdf.textContent.trim()); }

    // 开发者模式按钮
    const btnHealth  = findBtn([/Backend-?Check|健康/i]);
    const btnPing    = findBtn([/^PING/i, /尚未检查/i]);

    [btnHealth, btnPing].forEach((b) => {
      if (!b) return;
      b.classList.add("yx-devonly");
      log("dev-only button:", b.textContent.trim());
      // 如果不是 dev 模式，立刻隐藏（即使 CSS 没生效也兜底）
      if (!isDevMode()) b.style.display = "none";
    });
  }

  /* ---------- 抓取时加载态与提示 ---------- */
  function installFetchLoading() {
    if (!window.fetch) return;
    const orig = window.fetch.bind(window);

    const btnFetch   = findBtn([/抓取|Abrufen|^Fetch$/i]);
    const previewBox = document.querySelector("pre, textarea");

    function startLoading() {
      if (btnFetch) { btnFetch.classList.add("btn-loading"); btnFetch.disabled = true; }
      if (previewBox) {
        const hint = "正在抓取产品信息，请稍候…";
        if (previewBox.tagName === "TEXTAREA") previewBox.placeholder = hint;
        else if (!previewBox.textContent.trim()) previewBox.textContent = hint;
      }
    }
    function stopLoading(success) {
      if (btnFetch) { btnFetch.classList.remove("btn-loading"); btnFetch.disabled = false; }
      if (previewBox && !success) {
        const err = "⚠️ 抓取失败，请检查网址或稍后再试。";
        if (previewBox.tagName === "TEXTAREA") previewBox.placeholder = err;
        else previewBox.textContent = err;
      }
    }

    window.fetch = async (input, init = {}) => {
      let isCatalogCall = false;
      try {
        const url = typeof input === "string"
          ? new URL(input, location.origin)
          : new URL(input.url || "", location.origin);
        if (/\/v1\/api\/catalog\/parse/i.test(url.pathname)) isCatalogCall = true;
      } catch {}

      if (isCatalogCall) { log("catalog fetching…"); startLoading(); }
      try {
        const res = await orig(input, init);
        if (isCatalogCall) { log("catalog fetched"); stopLoading(true); }
        return res;
      } catch (e) {
        if (isCatalogCall) { log("catalog fetch error:", e); stopLoading(false); }
        throw e;
      }
    };
  }

  /* ---------- 同父级时：controls 在上，preview 在下 ---------- */
  function reorderIfSameParent() {
    const preview = document.querySelector("pre, textarea");
    const urlInput = document.querySelector("input[type='text'], input");
    if (!preview || !urlInput) return;
    const pc = preview.parentElement;
    const ic = urlInput.parentElement;
    if (pc && ic && pc === ic) {
      const parent = pc;
      parent.classList.add("yx-workbench");
      ic.classList.add("yx-controls");
      pc.classList.add("yx-preview");
      log("reorder via class on same parent");
    }
  }

  function boot() {
    applyDevMode();
    styleButtons();
    installFetchLoading();
    reorderIfSameParent();

    const mo = new MutationObserver(() => {
      applyDevMode();
      styleButtons();
      reorderIfSameParent();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("langchange", () => {
      styleButtons();
    });

    // 二次兜底：1 秒后再跑一次（防止首屏时机太早）
    setTimeout(() => { styleButtons(); reorderIfSameParent(); }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>
