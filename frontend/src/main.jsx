import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// 入口只做一件事：把 <App/> 挂到 #root
const el = document.getElementById("root");
if (!el) {
  // 理论上不会发生；防御一下
  const msg = "找不到 #root。请检查 index.html 中的 <div id=\"root\"></div>";
  console.error(msg);
  document.body.innerHTML = `<pre style="padding:16px;color:#c00">${msg}</pre>`;
} else {
  createRoot(el).render(<App />);
}
