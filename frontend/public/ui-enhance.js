/**
 * ui-enhance v3.3
 * - 更保守的隐藏策略：仅隐藏必要节点，避免误隐藏大容器
 * - 默认隐藏：开发按钮(Backend-Check/PING)、API 基址行、下方 JSON 预览；?dev=1 显示
 * - 只保留下方 PDF；主/次按钮、箭头、加载态
 * - 同父级时：controls 在上、preview 在下（加 class，不搬 DOM）
 */
(function () {
  const log = (...a) => { try { console.log("[ui-enhance]", ...a); } catch(e){} };
  log("loaded v3.3");

  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const findBtnByText = (patterns) =>
    $all("button").find(b => patterns.some(re => re.test((b.textContent || "").trim())));

  /* ---------- dev mode ---------- */
  function isDevMode() {
    try {
      const url = new URL(location.href);
      if (url.searchParams.get("dev") === "1") localStorage.setItem("dev", "1");
      return localStorage.getItem("dev") === "1";
    } catch { return false; }
  }
  function applyDevMode() {
    document.body.classList.toggle("yx-devmode", isDevMode());
  }
  function hideDevOnly(el) {
    if (!el) return;
    el.classList.add("yx-devonly");
    if (!isDevMode()) el.style.display = "none";
  }

  /* ---------- toolbar（URL + 按钮） ---------- */
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

  /* ---------- controls/preview 的温柔布局 ---------- */
  function findJsonPreview() {
    const urlInput = document.querySelector("input[type='text'], input");
    if (!urlInput) return null;
    const candidates = $all("pre, textarea");
    for (const el of candidates) {
      const pos = urlInput.compareDocumentPosition(el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return el;
    }
    return null;
  }
  function reorderIfSameParent() {
    const preview = findJsonPreview();
    const urlInput = document.querySelector("input[type='text'], input");
    if (!preview || !urlInput) return;
    const pc = preview.parentElement, ic = urlInput.parentElement;
    if (pc && ic && pc === ic) {
      pc.classList.add("yx-workbench");
      ic.classList.add("yx-controls");
      pc.classList.add("yx-preview");
    }
  }

  /* ---------- 判断一个容器是否含有主流程元素 ---------- */
  function hasMainControls(container) {
    if (!container) return false;
    const txt = (n) => (n.textContent || "").trim();
    const hasFetch   = !!findInside(container, btn => /抓取|Abrufen|^Fetch$/i.test(txt(btn)));
    const hasPreview = !!findInside(container, btn => /预览|目录写入|einfügen|Write/i.test(txt(btn)));
    const hasExcel   = !!findInside(container, btn => /导出\s*Excel|Excel exportieren|Export\s*Excel/i.test(txt(btn)));
    const hasPdf     = !!findInside(container, btn => /表格\s*PDF|PDF\s*erzeugen|Generate\s*PDF|Tabelle.*PDF/i.test(txt(btn)));
    const hasInput   = container.querySelector("input[type='text'], input");
    const hasText    = container.querySelector("textarea");
    return !!(hasFetch || hasPreview || hasExcel || hasPdf || hasInput || hasText);
  }
  function findInside(container, predicate) {
    return Array.from(container.querySelectorAll("button")).find(predicate);
  }

  /* ---------- 主/次按钮 + 只保留与 Excel 并列的 PDF ---------- */
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
        }
      }
    }

    if (btnFetch)   btnFetch.classList.add("btn-primary","step");
    if (btnPreview) btnPreview.classList.add("btn-secondary","step");
    if (btnExcel)   btnExcel.classList.add("btn-secondary","step");

    // 只保留与 Excel 并列的 PDF
    const pdfBtns = $all("button").filter(b => /表格\s*PDF|PDF\s*erzeugen|Generate\s*PDF|Tabelle.*PDF/i.test((b.textContent||"").trim()));
    if (pdfBtns.length) {
      let keep = null;
      if (btnExcel) keep = pdfBtns.find(b => b.parentElement === btnExcel.parentElement);
      keep = keep || pdfBtns[pdfBtns.length - 1];
      pdfBtns.forEach(b => { if (b !== keep) b.remove(); });
      if (keep) keep.classList.add("btn-secondary","is-last");
    }
  }

  /* ---------- 抓取加载态（仍保持“快就不显示”） ---------- */
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

  /* ---------- 隐藏（更保守） ---------- */
  function hideExtraForUser() {
    // 1) 开发按钮：只隐藏按钮本身；如需再隐藏“近邻容器”，须保证不含主流程元素
    const btnHealth = findBtnByText([/Backend-?Check|健康/i]);
    const btnPing   = findBtnByText([/^PING/i, /尚未检查/i]);

    [btnHealth, btnPing].forEach(b => { hideDevOnly(b); });

    [btnHealth, btnPing].forEach(b => {
      if (!b) return;
      // 限定在浅层容器里（最多上溯到含有按钮行的块级元素）
      const wrapper = b.closest("div,section,article,p") || b.parentElement;
      if (wrapper && !hasMainControls(wrapper)) hideDevOnly(wrapper);
    });

    // 2) API 基址：只隐藏“包含 API 基址文字”的那个节点（不再隐藏祖先）
    try {
      const nodes = $all("body *");
      const apiNode = nodes.find(n => /API\s*基址|API\s*Basis/i.test((n.textContent || "").trim()));
      if (apiNode) hideDevOnly(apiNode);
    } catch {}

    // 3) 下方 JSON 预览（URL 输入后出现的 pre/textarea）
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
})(); // EOF v3.3
