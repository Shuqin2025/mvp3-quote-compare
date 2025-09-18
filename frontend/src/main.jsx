// frontend/src/main.jsx

// ① 必须放在第一行：导入 boot 并“使用”导出的常量，避免构建器 Tree-shaking
import { API_BASE } from "./boot/api-base";

// ② 显式挂到 window，便于在浏览器 Console 验证
window.__API_BASE_EFFECTIVE__ = API_BASE;

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// —— 挂载根节点（保留你原来的保护逻辑）——
const el = document.getElementById("root");
if (!el) {
  const msg = "找不到 #root，请检查 index.html 中的 <div id=\"root\"></div>";
  console.error(msg);
  document.body.innerHTML = `<pre style="padding:16px;color:#c00">${msg}</pre>`;
} else {
  createRoot(el).render(<App />);
}
