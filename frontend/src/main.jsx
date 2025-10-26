// frontend/src/main.jsx
// 挂 React 根节点 + 调试输出 API_BASE 给 window（避免 Tree-shaking）

import { API_BASE } from "./api-base";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// 把当前生效的 API_BASE 暴露到 window 方便我们在浏览器 Console 里验证
window.__API_BASE_EFFECTIVE__ = API_BASE;
window.API_BASE = API_BASE; // 兼容 app-simple.js 里尝试读取 window.API_BASE

// 找页面上的 <div id="root">
const el = document.getElementById("root");
if (!el) {
  const msg = "找不到 #root，请检查 index.html 中的 <div id='root'></div>";
  console.error(msg);
  document.body.innerHTML =
    `<pre style="padding:16px;color:#c00">${msg}</pre>`;
} else {
  createRoot(el).render(<App />);
}
