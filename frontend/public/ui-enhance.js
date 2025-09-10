<script>
/**
 * 轻量 UI 增强：不改 React，不改业务逻辑。
 * - 识别常见按钮文字，自动加主/次样式 + 箭头
 * - 抓取时加加载态；在预览框输出提示
 * - 后端健康检查/PING 按钮仅在 dev 模式可见（?dev=1 或 localStorage.dev=1）
 * - 若 controls 与 preview 在同父级，自动把 controls 放上、preview 放下
 */
(function () {
  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const findBtn = (patterns) =>
    $all("button").find((b) => patterns.some((re) => re.test((b.textContent || "").trim())));

  // 语言：沿用你现有的选择
  const getLang = () =>
    (window.__currentLang ||
      (window.i18n && window.i18n.pickLang && window.i18n.pickLang()) ||
      "de");

  /* ---------- 开发者模式 ---------- */
  function isDevMode() {
    const url = new URL(location.href);
    if (url.searchParams.get("dev") === "1") {
      localStorage.setItem("dev", "1");
      return true;
    }
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
    const btnPreview = findBtn([/预览|einfügen|Write/i]);   // 预览/写入（前50条）
    const btnExcel   = findBtn([/导出\s*Excel|Excel exportieren|Export\s*Excel/i]);
    const btnPdf     = findBtn([/生成\s*PDF|PDF\s*erzeugen|Generate\s*PDF/i]);

    if (btnFetch)   { btnFetch.classList.add("btn-primary","step"); }
    if (btnPreview) { btnPreview.classList.add("btn-secondary","step"); }
    if (btnExcel)   { btnExcel.classList.add("btn-secondary","step","is-last"); }
    if (btnPdf)     { btnPdf.classList.add("btn-secondary"); }

    // 开发者模式的两个按钮
    const btnHealth  = findBtn([/Backend-?Check|健康/i]);
    const btnPing    = findBtn([/^PING/i, /尚未检查/i]);
    [btnHealth, btnPing].forEach((b) => b && b.classList.add("yx-devonly"));
  }

  /* ---------- 抓取时的加载态和提示 ---------- */
  function installFetchLoading() {
    if (!window.fetch) return;
    const orig = window.fetch.bind(window);

    // 找元素：抓取按钮、预览区（pre 或 textarea）
    const btnFetch   = findBtn([/抓取|Abrufen|^Fetch$/i]);
    const previewBox = document.querySelector("pre, textarea");

    function startLoading() {
      if (btnFetch) { btnFetch.classList.add("btn-loading"); btnFetch.disabled = true; }
      if (previewBox && previewBox.tagName === "TEXTAREA") {
        previewBox.placeholder = "正在抓取产品信息，请稍候…";
      } else if (previewBox && !previewBox.textContent.trim()) {
        previewBox.textContent = "正在抓取产品信息，请稍候…";
      }
    }
    function stopLoading(success) {
      if (btnFetch) { btnFetch.classList.remove("btn-loading"); btnFetch.disabled = false; }
      if (previewBox && !success) {
        if (previewBox.tagName === "TEXTAREA") {
          previewBox.placeholder = "⚠️ 抓取失败，请检查网址或稍后再试。";
        } else {
          previewBox.textContent = "⚠️ 抓取失败，请检查网址或稍后再试。";
        }
      }
    }

    window.fetch = async (input, init = {}) => {
      let isCatalogCall = false;
      try {
        const url = typeof input === "string"
          ? new URL(input, location.origin)
          : new URL(input.url || "", location.origin);
        // 识别“目录抓取接口”
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

  /* ---------- 目录抓取栏在上、预览在下（同父级时） ---------- */
  function reorderIfSameParent() {
    const preview = document.querySelector("pre, textarea");
    const urlInput = document.querySelector("input[type='text'], input");
    if (!preview || !urlInput) return;
    const pc = preview.parentElement;
    const ic = urlInput.parentElement;
    if (!pc || !ic) return;
    if (pc === ic) {
      // 给共同父级加“工作台”类，并标注两个区块
      const parent = pc;
      parent.classList.add("yx-workbench");
      // 粗略标注：离 URL 输入更近的容器作为 controls
      ic.classList.add("yx-controls");
      pc.classList.add("yx-preview");
      // 如果顺序已经相反，CSS 会处理；不强制搬动 DOM，保证安全
    }
  }

  /* ---------- 启动：等 DOM 就绪后执行，之后监听变化（React 更新） ---------- */
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

    // 语言切换后也重跑一次（你已有 i18n.setLang 会触发 langchange 可复用）
    window.addEventListener("langchange", () => {
      styleButtons();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
</script>
