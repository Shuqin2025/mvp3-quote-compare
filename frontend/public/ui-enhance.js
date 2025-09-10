/**
 * ui-enhance v3 （纯 JS）
 * - 文案匹配 + 位置兜底（URL 输入右侧按钮：1抓取/2预览/3Excel/4PDF）
 * - 主/次按钮、箭头、抓取加载态、开发者模式隐藏
 * - 同父级时：controls 在上、preview 在下（仅加 class，不搬动 DOM）
 * - 控制台日志前缀 [ui-enhance]
 */
(function () {
  const log = (...a) => { try { console.log("[ui-enhance]", ...a); } catch(e){} };
  log("loaded v3");

  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const findBtnByText = (patterns) =>
    $all("button").find((b) => patterns.some((re) => re.test((b.textContent || "").trim())));

  function isDevMode() {
    const url = new URL(location.href);
    if (url.searchParams.get("dev") === "1") localStorage.setItem("dev", "1");
    return localStorage.getItem("dev") === "1";
  }
  function applyDevMode() {
    document.body.classList.toggle("yx-devmode", isDevMode());
  }

  function findToolbar() {
    const urlInput = document.querySelector("input[type='text'], input");
    if (!urlInput) return null;
    const parent = urlInput.parentElement;
    if (!parent) return null;
    let btns = Array.from(parent.querySelectorAll("button"));
    if (btns.length >= 3) return { toolbar: parent, btns };

    let sib = urlInput.nextElementSibling;
    while (sib && sib !== parent && !sib.querySelector("button")) sib = sib.nextElementSibling;
    if (sib) {
      btns = Array.from(sib.querySelectorAll("button"));
      if (btns.length >= 3) return { toolbar: sib, btns };
    }
    return null;
  }

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

    if (btnFetch)   { btnFetch.classList.add("btn-primary", "step"); log("Fetch:", btnFetch.textContent.trim()); }
    if (btnPreview) { btnPreview.classList.add("btn-secondary", "step"); log("Preview:", btnPreview.textContent.trim()); }
    if (btnExcel)   { btnExcel.classList.add("btn-secondary", "step", "is-last"); log("Excel:", btnExcel.textContent.trim()); }
    if (btnPdf)     { btnPdf.classList.add("btn-secondary"); log("PDF:", btnPdf.textContent.trim()); }

    const btnHealth = findBtnByText([/Backend-?Check|健康/i]);
    const btnPing   = findBtnByText([/^PING/i, /尚未检查/i]);
    [btnHealth, btnPing].forEach(b => {
      if (!b) return;
      b.classList.add("yx-devonly");
      if (!isDevMode()) b.style.display = "none";
      log("dev-only:", b.textContent.trim());
    });
  }

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
        const url = typeof input === "string" ? new URL(input, location.origin)
                  : new URL(input.url || "", location.origin);
        if (/\/v1\/api\/catalog\/parse/i.test(url.pathname)) isCatalogCall = true;
      } catch {}
      if (isCatalogCall) startLoading();
      try {
