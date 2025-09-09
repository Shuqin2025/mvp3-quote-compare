<script>
(function(){
  const LANGS = ["zh","de","en"];
  function pick(){
    const s = (localStorage.getItem("lang") || "").toLowerCase();
    return LANGS.includes(s) ? s : "de";        // 默认德语，你也可改成 "zh" 或 "en"
  }
  function set(lang){
    if(!LANGS.includes(lang)) lang = "de";
    localStorage.setItem("lang", lang);
    window.__currentLang = lang;
    // 如果将来要做 UI 翻译，可以监听这个事件
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }
  window.i18n = { setLang: set, pickLang: pick };
  window.__currentLang = pick();
})();
</script>
