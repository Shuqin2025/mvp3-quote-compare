// frontend/src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  // 如不需要严格模式，可去掉 <React.StrictMode>
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
