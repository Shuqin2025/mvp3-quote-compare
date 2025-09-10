(function () {
  if (!window.fetch) return;
  const orig = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const lang =
      window.__currentLang ||
      (window.i18n && window.i18n.pickLang && window.i18n.pickLang()) ||
      "de";

    const hdrs = new Headers(init.headers || (input && input.headers) || {});
    hdrs.set("X-Lang", lang);
    init.headers = hdrs;

    try {
      const url =
        typeof input === "string"
          ? new URL(input, location.origin)
          : new URL(input.url || "", location.origin);
      if (url.pathname.startsWith("/v1/api/export/")) {
        url.searchParams.set("lang", lang);
        input = url.toString();
      }
    } catch (e) {
      // ignore
    }
    return orig(input, init);
  };
})();
