/**
 * ui-enhance v3.4
 * - 仅隐藏具体元素，不隐藏父容器（避免把整个 UI 藏掉）
 * - 等主 UI 出现后再执行隐藏/美化（解决时序）
 * - 只保留下方 PDF；主/次按钮+箭头；?dev=1 显示开发区块
 */
(function () {
  const log = (...a) => { try { console.log("[ui-enhance]", ...a); } catch(e){} };
  log("loaded v3.4");

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const txt = (n) => (n?.textContent || "").trim();

  /* ---------------- dev mode ---------------- */
  function isDev() {
    try {
      const u = new URL(location.href);
      if (u.searchParams.get("dev") === "1") localStorage.setItem("dev", "1");
      return localStorage.getItem("dev") === "1";
    } catch { return false; }
  }
  function showIfDev(el){ if (!el) return; el.style.display = isDev() ? "" : "none"; }
  function hideIfNotDev(el){ if (!el) return; if (!isDev()) el.style.display = "none"; }

  /* ---------------- wait until UI appears ---------------- */
  function uiReady() {
    // 判定：出现“抓取/预览/Excel/URL 输入框/正文文本域”之一，即认为 UI 已挂载
    const hasFetch   = $$("button").some(b => /抓取|Abrufen|^Fetch$/i.test(txt(b)));
    const hasPreview = $$("button").some(b => /预览|目录写入|einfügen|Write/i.test(txt(b)));
    const hasExcel   = $$("button").some(b => /导出\s*Excel|Excel exportieren|Export\s*Excel/i.test(txt(b)));
    const hasInput   = $("input[type='text'], input");
    const hasText    = $("textarea");
    return hasFetch || hasPreview || hasExcel || hasInput || hasText;
  }
  function waitForUI(cb, timeout=6000){
    const start = Date.now();
    const tick = () => {
      if (uiReady() || Date.now() - start > timeout) cb();
      else requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------------- 按钮获取 ---------------- */
  function findBtn(reList){
    return $$("button").find(b => reList.some(re => re.test(txt(b))));
  }

  /* ---------------- 主/次按钮 + 只保留下方 PDF ---------------- */
  function styleButtons(){
    let btnFetch   = findBtn([/抓取|Abrufen|^Fetch$/i]);
    let btnPreview = findBtn([/预览|目录写入|einfügen|Write/i]);
    let btnExcel   = findBtn([/导出\s*Excel|Excel exportieren|Export\s*Excel/i]);

    if (btnFetch)   btnFetch.classList.add("btn-primary","step");
    if (btnPreview) btnPreview.classList.add("btn-secondary","step");
    if (btnExcel)   btnExcel.classList.add("btn-secondary","step");

    const pdfBtns = $$("button").filter(b => /表格\s*PDF|PDF\s*erzeugen|Generate\s*PDF|Tabelle.*PDF/i.test(txt(b)));
    if (pdfBtns.length) {
      // 优先保留和 Excel 同父节点的那一个，否则保留最后一个
      let keep = btnExcel ? pdfBtns.find(b => b.parentElement === btnExcel.parentElement) : null;
      keep = keep || pdfBtns[pdfBtns.length - 1];
      pdfBtns.forEach(b => { if (b !== keep) b.remove(); });
      if (keep) keep.classList.add("btn-secondary","is-last");
    }
  }

  /* ---------------- 抓取加载态（仍“快则不显示”） ---------------- */
  function installFetchLoading(){
    if (!window.fetch) return;
    const orig = window.fetch.bind(window);
    let btnFetch = findBtn([/抓取|Abrufen|^Fetch$/i]);
    const previewBox = (()=>{
      const input = $("input[type='text'], input");
      if (!input) return null;
      // URL 框后面的第一个预览区域（pre/textarea）
      const list = $$("pre, textarea");
      for (const el of list){
        const pos = input.compareDocumentPosition(el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return el;
      }
      return null;
    })();

    function start(){
      if (btnFetch){ btnFetch.classList.add("btn-loading"); btnFetch.disabled = true; }
      if (previewBox){
        const hint = "正在抓取产品信息，请稍候…";
        if (previewBox.tagName === "TEXTAREA") previewBox.placeholder = hint;
        else if (!txt(previewBox)) previewBox.textContent = hint;
      }
    }
    function stop(ok){
      if (btnFetch){ btnFetch.classList.remove("btn-loading"); btnFetch.disabled = false; }
      if (previewBox && !ok){
        const err = "⚠️ 抓取失败，请检查网址或稍后再试。";
        if (previewBox.tagName === "TEXTAREA") previewBox.placeholder = err;
        else previewBox.textContent = err;
      }
    }

    window.fetch = async (input, init={})=>{
      let isCatalog = false;
      try{
        const url = new URL(typeof input==="string" ? input : (input.url||""), location.origin);
        if (/\/v1\/api\/catalog\/parse/i.test(url.pathname)) isCatalog = true;
      }catch{}
      if (isCatalog) start();
      try{
        const res = await orig(input, init);
        if (isCatalog) stop(true);
        return res;
      }catch(e){
        if (isCatalog) stop(false);
        throw e;
      }
    };
  }

  /* ---------------- 更保守的隐藏：只隐藏“具体元素” ---------------- */
  function hideExtras(){
    // 1) Backend-Check、PING：仅隐藏按钮/文本本身
    const btnHealth = findBtn([/Backend-?Check|健康/i]);
    const pingNode  = $$("*").find(n => /^PING\b/i.test(txt(n)) || /尚未检查/i.test(txt(n)));

    hideIfNotDev(btnHealth);
    hideIfNotDev(pingNode);

    // 2) API 基址行：只隐藏那一行文本节点
    const apiLine = $$("*").find(n => /API\s*基址|API\s*Basis/i.test(txt(n)));
    hideIfNotDev(apiLine);

    // 3) JSON 预览：隐藏 URL 输入后的第一个 pre/textarea
    const input = $("input[type='text'], input");
    if (input){
      const pr = $$("pre, textarea").find(el=>{
        const pos = input.compareDocumentPosition(el);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      hideIfNotDev(pr);
    }
  }

  /* ---------------- boot：等待 UI → 美化 & 隐藏 ---------------- */
  function boot(){
    waitForUI(()=>{
      styleButtons();
      installFetchLoading();
      hideExtras();

      // 监听后续变动（比如重新渲染）
      const mo = new MutationObserver(()=>{
        styleButtons();
        hideExtras();
      });
      mo.observe(document.body, { childList:true, subtree:true });

      window.addEventListener("langchange", ()=>{
        styleButtons();
        hideExtras();
      });

      setTimeout(()=>{ styleButtons(); hideExtras(); }, 600);
      log("mounted");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
