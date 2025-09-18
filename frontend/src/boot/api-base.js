// frontend/src/boot/api-base.js
// 统一计算 API_BASE（优先级：?api → window.__API_BASE__ → VITE_API_BASE → 兜底）
const FROM_QUERY = new URLSearchParams(location.search).get('api');

const FROM_RUNTIME =
  (typeof window !== 'undefined'
   && typeof window.__API_BASE__ === 'string'
   && /^https?:\/\//i.test(window.__API_BASE__))
    ? window.__API_BASE__
    : '';

const FROM_ENV =
  (typeof import.meta !== 'undefined'
   && import.meta?.env?.VITE_API_BASE
   && /^https?:\/\//i.test(import.meta.env.VITE_API_BASE))
    ? import.meta.env.VITE_API_BASE
    : '';

const FALLBACK = 'https://yunivera-gateway.onrender.com';

const API_BASE =
  (FROM_QUERY && /^https?:\/\//i.test(FROM_QUERY) && FROM_QUERY)
  || FROM_RUNTIME
  || FROM_ENV
  || FALLBACK;

// 暴露给控制台方便核对
try { Object.defineProperty(window, '__API_BASE_EFFECTIVE__', { value: API_BASE }); } catch {}

// 需要被“替换掉”的旧后端域名（可按需扩充）
const OLD_HOST_PATTERNS = [
  /\/\/yunivera-mvp2-[^/]+\.onrender\.com/i, // 任何 yunivera-mvp2-*.onrender.com
  /\/\/yunivera-mvp2-cwyr\.onrender\.com/i   // 你之前看到的具体那个
];

// 把指向“旧后端”的绝对 URL 改写到 API_BASE（保留原 pathname+search）
function rewriter(url) {
  try {
    const u = new URL(url, location.origin);
    const hit = OLD_HOST_PATTERNS.some((re) => re.test(u.href));
    if (!hit) return url; // 不是旧后端，原样返回
    const base = new URL(API_BASE);
    return base.origin + u.pathname + u.search;
  } catch {
    return url;
  }
}

// ---- patch fetch：入口最早执行，自动改写指向旧后端的请求 ----
(function patchFetch() {
  if (typeof window === 'undefined' || !window.fetch) return;
  const orig = window.fetch;
  window.fetch = function (input, init) {
    let url = (typeof input === 'string') ? input : input?.url;
    if (url) {
      const newUrl = rewriter(url);
      if (newUrl !== url) {
        input = (typeof input === 'string') ? newUrl : new Request(newUrl, input);
      }
    }
    return orig.call(this, input, init);
  };
})();
