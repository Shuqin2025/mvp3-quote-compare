<script>
(function(){
  if (!window.fetch) return;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const lang = (window.__currentLang || (window.i18n && window.i18n.pickLang && window.i18n.pickLang()) || "de");
    const hdrs = new Headers(init.headers || (input && input.headers) || {});
    hdrs.set("X-Lang", lang);                  // 后端也会识别这个头
    init.headers = hdrs;

    try {
      const url = typeof input === "string" ? new URL(input, location.origin)
                : new URL(input.url || "", location.origin);
      // 仅对导出接口追加 ?lang=xx
      if (url.pathname.startsWith("/v1/api/export/")) {
        url.searchParams.set("lang", lang);
        input = url.toString();
      }
    } catch (e) {}
    return orig(input, init);
  };
})();
</script>
