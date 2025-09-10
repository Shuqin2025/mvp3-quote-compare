(function () {
  const LANGS = ["zh", "de", "en"];

  function pick() {
    const s = (localStorage.getItem("lang") || "").toLowerCase();
    return LANGS.includes(s) ? s : "de"; // 默认德语；需要可改成 "zh" 或 "en"
  }

  function set(lang) {
    if (!LANGS.includes(lang)) lang = "de";
    localStorage.setItem("lang", lang);
    window.__currentLang = lang;
    // 供 UI i18n 监听
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  window.i18n = { setLang: set, pickLang: pick };
  window.__currentLang = pick();
})();
