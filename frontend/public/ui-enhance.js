/**
 * ui-enhance v3.2
 * - 文案匹配 + 位置兜底（URL 输入右侧：1抓取/2预览/3Excel/4PDF）
 * - 主/次按钮、步骤箭头、抓取加载态、开发者模式隐藏
 * - 只保留下方的 PDF（与 Excel 并列）；上方 PDF 隐藏
 * - 默认隐藏：开发者按钮行 / API 基址行 / 原始 JSON（?dev=1 才显示）
 * - 同父级时：controls 在上、preview 在下（仅加 class，不搬动 DOM）
 */
(function () {
  const log = (...a) => { try { console.log("[ui-enhance]", ...a); } catch(e){} };
  log("loaded v3.2");

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
  function hideDevOnly(el) {
    if (!el) return;
    el.classList.add("yx-devonly");
    if (!isDevMode()) el.style.display = "none";
  }

  /* ---------- 找“URL 输入 + 一排按钮”的容器（位置兜底） ---------- */
  function findToolbar() {
    const urlInput = document.querySelector("input[type='text'], input");
    if (!urlInput) return null;

    const p = urlInput.parentElement;
    if (p) {
      const btns = Array.from(p.querySelectorAll("button"));
      if (btns.length >= 3) return { toolbar: p, btns };
    }
    let sib = urlInput.nextElementSibling;
    while (sib && !sib.querySelector("button")) sib = sib.nextElementSibling;
    if (sib) {
      const btns = Array.from(sib.querySelectorAll("button"));
      if (btns.length >= 3) return { toolbar: sib, btns };
    }
    return null;
  }

  /* ---------- 同父级时：controls 在上，preview 在下 ---------- */
  function reorderIfSameParent() {
    const preview = findJsonPreview(); // 仅找到“下方 JSON”
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

  /* ---------- 找“下方 JSON 预览区”（URL 输入之后出现的 pre/textarea） ---------- */
  function findJsonPreview() {
    const urlInput = document.querySelector("input[type='text'], input");
    if (!urlInput) return null;
    const candidates = $all("pre, textarea");
    for (const el of candidates) {
      // 只取出现在 URL 输入之后的那个（避免拿到顶部的“正文 / Text”）
      const pos = urlInput.compareDocumentPosition(el);
      const after = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      if (after) return el;
    }
    return null;
  }

  /* ---------- 主/次按钮 + 只保留下方 PDF ---------- */
  function styleButtons() {
    let btnFetch   = findBtnByText([/抓取|Abrufen|^Fetch$/i]);
    let btnPreview = findBtnByText([/预览|目录写入|einfügen|Write/i]);
    let btnExcel   = findBtnByText([/导出\s*Excel|Excel exportieren|Export\s*Excel/i]);

    if (!(btnFetch && btnPreview && btnExcel)) {
      const tb = findToolbar();
      if (tb) {
        const visible = tb.btns.filter(b => b.offsetParent !== null);
        if (visible.length >= 3) {
          btnFetch   = btnFetch   || visible[0];
          btnPreview = btnPreview || visible[1];
          btnExcel   = btnExcel   || visible[2];
          log("fallback by position:", visible.map(b => b.textContent.trim()));
        }
      }
    }

    if (btnFetch)   { btnFetch.classList.add("btn-primary","step"); }
    if (btnPreview) { btnPreview.classList.add("btn-secondary","step"); }
    if (btnExcel)   { btnExcel.classList.add("btn-secondary","step"); }

    // 只保留与 Excel 并列的 PDF
    const pdfBtns = $all("button").filter(b => /表格\s*PDF|PDF\s*erzeugen|Generate\s*PDF|Tabelle.*PDF/i.test((b.textContent||"").trim()));
    if (pdfBtns.length) {
      let keep = null;
      if (btnExcel) {
        // 保留同父级、位置在 Excel 附近的 PDF
        keep = pdfBtns.find(b => b.parentElement === btnExcel.parentElement);
      }
      keep = keep || pdfBtns[pdfBtns.length - 1]; // 兜底：保留最后一个
      pdfBtns.forEach(b => {
        if (b !== keep) {
          b.remove(); // 直接移除上方重复 PDF
          log("remove duplicated PDF:", b.textContent.trim());
        }
      });
      if (keep) {
        keep.classList.add("btn-secondary","is-last");
        log("keep PDF:", keep.textContent.trim());
      }
    }

    // 开发者按钮隐藏（以及整行隐藏）
    const btnHealth = findBtnByText([/Backend-?Check|健康/i]);
    const btnPing   = findBtnByText([/^PING/i, /尚未检查/i]);
    // 整行（包含两者的最近公共祖先）
    if (btnHealth || btnPing) {
      const set = new Set();
      let p = btnHealth ? btnHealth.parentElement : null;
      while (p && p !== document.body) { set.add(p); p = p.parentElement; }
      p = btnPing ? btnPing.parentElement : null;
      let common = null;
      while (p && p !== document.body) { if (set.has(p)) { common = p; break; } p = p.parentElement; }
      if (common) { hideDevOnly(common); }
      hideDevOnly(btnHealth);
      hideDevOnly(btnPing);
    }
  }

  /* ---------- 抓取加载态（保持无延迟，快就不显示） ---------- */
  function installFetchLoading() {
    if (!window.fetch) return;
    const orig = window.fetch.bind(window);

    let btnFetch = findBtnByText([/抓取|Abrufen|^Fetch$/i]);
    if (!btnFetch) {
      const tb = findToolbar();
      if (tb) btnFetch = tb.btns[0];
    }
    const previewBox = findJsonPreview();

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

  /* ---------- 隐藏 API 基址 + 隐藏 JSON 预览（非 dev） ---------- */
  function hideExtraForUser() {
    // API 基址行
    try {
      const nodes = $all("body *");
      const hit = nodes.find(n => /API\s*基址|API\s*Basis/i.test((n.textContent || "").trim()));
      if (hit) hideDevOnly(hit);
    } catch (e) {}

    // 下方 JSON 预览
    const jsonEl = findJsonPreview();
    if (jsonEl) hideDevOnly(jsonEl);
  }

  function boot() {
    applyDevMode();
    styleButtons();
    installFetchLoading();
    hideExtraForUser();
    reorderIfSameParent();

    const mo = new MutationObserver(() => {
      applyDevMode();
      styleButtons();
      hideExtraForUser();
      reorderIfSameParent();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("langchange", () => {
      styleButtons();
      hideExtraForUser();
    });

    setTimeout(() => {
      styleButtons();
      hideExtraForUser();
      reorderIfSameParent();
    }, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(); // EOF v3.2
