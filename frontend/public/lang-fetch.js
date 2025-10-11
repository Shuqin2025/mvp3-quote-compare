/**
 * feature/restore - lang-fetch.js
 * 作用：
 *  1) 给所有 fetch 请求自动带上 X-Lang 头（和 /v1/api/export/* 的 lang 查询串）
 *  2) 其余不改动原有 fetch 行为，保持最小侵入
 */
(function () {
  if (!window.fetch) return;
  const orig = window.fetch.bind(window);

  // 语言来源优先顺序：手工切换 -> i18n.pickLang() -> 默认 “de”
  function pickLang() {
    try {
      return (
        window.__currentLang ||
        (window.i18n && window.i18n.pickLang && window.i18n.pickLang()) ||
        "de"
      );
    } catch {
      return "de";
    }
  }

  window.fetch = (input, init = {}) => {
    const lang = pickLang();

    // 合并/注入 X-Lang 头
    const hdrs = new Headers((init && init.headers) || {});
    hdrs.set("X-Lang", lang);
    init.headers = hdrs;

    // 给 /v1/api/export/* 的请求补上 lang=xx，便于导出接口侧识别
    try {
      const url =
        typeof input === "string"
          ? new URL(input, location.origin)
          : new URL(input.url || "", location.origin);

      if (url.pathname.startsWith("/v1/api/export/")) {
        url.searchParams.set("lang", lang);
        input = url.toString();
      }
    } catch {
      /* 忽略 URL 解析异常 */
    }

    return orig(input, init);
  };
})();
