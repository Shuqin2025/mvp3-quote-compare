// frontend/src/boot/api-base.js
// 极简锁死版：所有请求都走公开网关，不再尝试聪明推理

// 我们已经验证过这个网关会正确转发到私有后端并返回抓取结果 ✅
const API_BASE = 'https://yunivera-gateway.onrender.com';

// 暴露到 window，方便在浏览器 Console 里肉眼确认
try {
  window.__API_BASE_EFFECTIVE__ = API_BASE;
  console.log('[api-base:minimal] Using API_BASE =', API_BASE);
} catch (e) {
  console.warn('[api-base:minimal] failed to set window var:', e);
}

// 某些旧代码里还可能直接去请求私有后端（例如 http://yunivera-mvp2-private:10000）
// 我们在这里做一个非常直接的“改写器”
// 逻辑是：只要目标 URL 是指向那个私有后端，就把它换成 API_BASE 保留 path+query
function rewriteToGateway(url) {
  try {
    const u = new URL(url, location.origin);

    // 这里枚举“我们不想在浏览器里直接打的主机名”
    const isPrivateBackend =
      /yunivera-mvp2-private/i.test(u.hostname) ||
      /yunivera-mvp2/i.test(u.hostname); // 保险一点，把带 yunivera-mvp2 的都算进去

    if (!isPrivateBackend) {
      // 不是私有后端，就不用改
      return url;
    }

    // 把 path 和 search 接到公开网关上
    const base = new URL(API_BASE);
    const rewritten = base.origin + u.pathname + u.search;
    return rewritten;
  } catch {
    // URL() 失败就保留原样
    return url;
  }
}

// 最后一步：hook fetch
// 这样即使老代码还在用 fetch("http://yunivera-mvp2-private:10000/xxx")
// 浏览器里最终也会改成 fetch("https://yunivera-gateway.onrender.com/xxx")
(function patchFetchToGateway() {
  if (typeof window === 'undefined' || !window.fetch) return;
  const origFetch = window.fetch;

  window.fetch = function (input, init) {
    let out = input;

    if (typeof input === 'string') {
      out = rewriteToGateway(input);
    } else if (input && typeof input === 'object' && input.url) {
      const newUrl = rewriteToGateway(input.url);
      if (newUrl !== input.url) {
        // 重新构造 Request，把原 headers/method/body 都保留
        out = new Request(newUrl, input);
      }
    }

    return origFetch.call(this, out, init);
  };
})();

// 给其它模块用：默认导出 API_BASE 本身
export { API_BASE };
export default API_BASE;
