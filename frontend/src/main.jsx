// frontend/src/main.jsx
import "./boot/api-base";                // ✅ 入口最先引入，安装 fetch 改写补丁
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// ——— 挂载根节点（保留你原来的保护逻辑）———
const el = document.getElementById("root");
if (!el) {
  const msg = "找不到 #root，请检查 index.html 中的 <div id=\"root\"></div>";
  console.error(msg);
  document.body.innerHTML = `<pre style="padding:16px;color:#c00">${msg}</pre>`;
} else {
  createRoot(el).render(<App />);
}
