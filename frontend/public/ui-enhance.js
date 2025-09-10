/**
 * ui-enhance v3.1  —— 纯 JS（修复 Unexpected end of input）
 * - 文案匹配 + 位置兜底（URL 输入右侧：1抓取/2预览/3Excel/4PDF）
 * - 主/次按钮、步骤箭头、抓取加载态、开发者模式隐藏
 * - 同父级时：controls 在上、preview 在下（仅加 class，不搬动 DOM）
 * - 控制台日志前缀 [ui-enhance]
 */
(function () {
  const log = (...a) => { try { console.log("[ui-enhance]", ...a); } catch(e){} };
  log("loaded v3.1");

  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const findBtnByText = (patterns) =>
    $all("button").find((b) => patterns.some((re) => re.test((b.textContent || "").trim())));

  /* ---------- 开发者模式 ---------- */
  function isDevMode() {
    try {
      const url = new URL(location.href);
      if (url.searchParams.get("dev") === "1") localStorage.setItem("dev", "1");
      return localStorage.getItem("dev") === "1";
    } catch (e) { return false; }
  }
  function applyDevMode() {
    document.body.classList.toggle("yx-devmode", isDevMode());
  }

  /* ---------- 找到“URL 输入 + 一排按钮”的容器（用于位置兜底） ---------- */
  function findToolbar() {
    const urlInput = document.querySelector("input[type='text'], input");
    if (!urlInput) return null;

    // 同父
    const p = urlInput.parentElement;
    if (p) {
      const btns = Array.from(p.querySelectorAll("button"));
      if (btns.length >= 3) return { toolbar: p, btns };
    }
    // 兄弟
    let sib = urlInput.nextElementSibling;
    while (sib && !sib.querySelector("button")) sib = sib.nextElementSibling;
    if (sib) {
      const btns = Array.from(sib.querySelectorAll("button"));
      if (btns.length >= 3) return { toolbar: sib, btns };
    }
    return null;
  }

  /* ---------- 给按钮加样式（文案优先，失败则位置兜底） ---------- */
  function styleButtons() {
    let btnFetch   = findBtnByText([/抓取|Abrufen|^Fetch$/i]);
    let btnPreview = findBtnByText([/预览|目录写入|einfügen|Write/i]);
    let btnExcel   = findBtnByText([/导出\s*Excel|Excel exportieren|Export\s*Excel/i]);
    let btnPdf     = findBtnByText([/表格\s*PDF|PDF\s*erzeugen|Generate\s*PDF|Tabelle.*PDF/i]);

    if (!(btnFetch && btnPreview && btnExcel)) {
      const tb = findToolbar();
      if (tb) {
        const visible = tb.btns.filter(b => b.offsetParent !== null);
        if (visible.length >= 3) {
          btnFetch   = btnFetch   || visible[0];
          btnPreview = btnPreview || visible[1];
          btnExcel   = btnExcel   || visible[2];
          btnPdf     = btnPdf     || visible[3];
          log("fallback by position:", visible.map(b => b.textContent.trim()));
        }
      }
    }

    if (btnFetch)   { btnFetch.classList.add("btn-primary","step"); log("Fetch:", btnFetch.textContent.trim()); }
    if (btnPreview) { btnPreview.classList.add("btn-secondary","step"); log("Preview:", btnPreview.textContent.trim()); }
    if (btnExcel)   { btnExcel.classList.add("btn-secondary","step","is-last"); log("Excel:", btnExcel.textContent.trim()); }
    if (btnPdf)     { btnPdf.classList.add("btn-secondary"); log("PDF:", btnPdf.textContent.trim()); }

    // 开发者按钮隐藏
    const btnHealth = findBtnByText([/Backend-?Check|健康/i]);
    const btnPing   = findBtnByText([/^PING/i, /尚未检查/i]);
    [btnHealth, btnPing].forEach(b=>{
      if (!b) return;
      b.classList.add("yx-devonly");
      if (!isDevMode()) b.style.display = "none";
      log("dev-only:", b.textContent.trim());
    });
  }

  /* ---------- 抓取加载态 ---------- */
  function installFetchLoading() {
    if (!window.fetch) return;
    const orig = window.fetch.bind(window);

    let btnFetch = findBtnByText([/抓取|Abrufen|^Fetch$/i]);
    if (!btnFetch) {
      const tb = findToolbar();
      if (tb) btnFetch = tb.btns[0];
    }
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
      } catch (e) {}
      if (isCatalogCall) startLoading();
      try {
        const res = await orig(input, init);
        if (isCatalogCall) stopLoading(true);
        return res;
      } catch (e) {
        if (isCatalogCall) stopLoading(false);
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
      pc.classList.add("yx-workbench");
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

    window.addEventListener("langchange", () => styleButtons());

    setTimeout(() => { styleButtons(); reorderIfSameParent(); }, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(); // EOF ui-enhance v3.1
