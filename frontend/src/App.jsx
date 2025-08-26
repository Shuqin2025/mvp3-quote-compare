// frontend/src/App.jsx
import React, { useState } from "react";

const API = (import.meta.env.VITE_API_BASE || "http://localhost:5190").replace(/\/+$/, "");

export default function App() {
  const [title, setTitle] = useState("测试报价单");
  const [content, setContent] = useState("这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。");
  const [log, setLog] = useState("就绪。");

  async function ping() {
    try {
      const res = await fetch(`${API}/v1/api/hello`);
      const txt = await res.text();
      setLog(`[PING] ${txt}`);
      alert(`后端响应：\n${txt}`);
    } catch (e) {
      setLog(`[PING-ERR] ${e.message}`);
      alert(`健康检查失败：${e.message}`);
    }
  }

  async function generatePdf() {
    try {
      setLog("开始生成 PDF …");

      const res = await fetch(`${API}/v1/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      });

      const ct = res.headers.get("content-type") || "";
      setLog((p) => `${p}\n[COMPARE] status=${res.status} ct=${ct}`);

      // 后端直接返回 application/pdf
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // 方式A：新窗口打开预览
      window.open(url, "_blank");

      // 方式B：强制下载（如果你更想下载用下面三行，替换掉上面那行 window.open）
      // const a = document.createElement("a");
      // a.href = url; a.download = "quote.pdf"; a.click();
      // URL.revokeObjectURL(url);
    } catch (e) {
      setLog((p) => `${p}\n[ERR] ${e.message}`);
      alert(`生成失败：${e.message}`);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 820 }}>
      <h2 style={{ marginBottom: 16 }}>MVP3：前端调用 /v1/api/pdf Demo</h2>

      <div style={{ display: "grid", gap: 8 }}>
        <label>
          标题：
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            placeholder="请输入标题"
          />
        </label>

        <label>
          正文：
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            placeholder="请输入内容"
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={ping}>后端健康检查</button>
        <button onClick={generatePdf}>生成 PDF</button>
      </div>

      <p style={{ color: "#666", marginTop: 8 }}>API = {API}</p>

      <pre style={{ background: "#f7f7f7", border: "1px solid #ddd", padding: 12, whiteSpace: "pre-wrap" }}>
        {log}
      </pre>
    </div>
  );
}
