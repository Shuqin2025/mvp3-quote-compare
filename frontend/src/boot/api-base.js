// frontend/src/boot/api-base.js
(() => {
  // 1) 计算 API_BASE：优先 ?api=... → 其次 VITE_API_BASE → 再次固定网关
  const q = new URLSearchParams(location.search);
  const apiParam = q.get("api");

  const fromEnv =
    (typeof import !== "undefined" &&
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE) || "";

  const FALLBACK = "https://yunivera-gateway.onrender.com";
  const API_DEFAULT = fromEnv || FALLBACK;
  const API_BASE =
    apiParam && /^https?:\/\//i.test(apiParam) ? apiParam : API_DEFAULT;

  // 2) 暴露到 window，方便你在 Console 里检查
  window.__API_BASE_EFFECTIVE__ = API_BASE;

  // 3) 需要被重写的历史主机（旧硬编码）
  const OLD_HOSTS = [
    "https://yunivera-mvp2-cwyr.onrender.com",
    // 如果有其它历史 host，也可以加到这里
    // "https://yunivera-mvp2-private.onrender.com",
  ];

  // 4) 打补丁：把相对 /v1/... 或旧 host 的请求统一改写到 API_BASE
  const prefix = API_BASE.replace(/\/$/, "");
  const origFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    let url = typeof input === "string" ? input : input && input.url;

    if (!url) return origFetch(input, init);

    // 相对路径 "/v1/..." → 直接前缀到 API_BASE
    if (url.startsWith("/v1/")) {
      return origFetch(prefix + url, init);
    }

    // 旧域名 "https://yunivera-mvp2-.../v1/..." → 改写到 API_BASE
    const old = OLD_HOSTS.find((h) => url.startsWith(h + "/v1/"));
    if (old) {
      return origFetch(prefix + url.slice(old.length), init);
    }

    // 其它 URL 不动
    return origFetch(input, init);
  };
})();
